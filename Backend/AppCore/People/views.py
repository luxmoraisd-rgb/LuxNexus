import os
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..Auth.utils import user_payload
from ..db import get_database

DEFAULT_AVATAR_COLORS = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#06b6d4",
    "#14b8a6",
]

INVITE_DEPARTMENT_OPTIONS = {
    "Engineering",
    "Software Developer",
    "Software Testing",
    "Data Analyst",
    "Senior Process Executive",
    "Front End Developer",
    "QA Automation",
    "Full Stack Developer",
    "Team Lead",
    "Business Analyst",
    "Python Developer",
}

DEFAULT_TEAMS = [
    {
        "name": "Core Platform Engineering",
        "description": "Architecting the distributed backend, API gateways, and real-time collaboration engines.",
        "department": "Engineering",
        "lead": "Sivakumar",
        "member_count": 4,
        "tags": ["Backend", "MongoDB", "Architecture"],
    },
    {
        "name": "Frontend & UI Experience",
        "description": "Crafting the next-gen web interface, task boards, and interactive team workspaces.",
        "department": "Product Design",
        "lead": "Alex Rivera",
        "member_count": 3,
        "tags": ["React", "CSS3", "Design Systems"],
    },
    {
        "name": "DevOps & Cloud Reliability",
        "description": "Managing automated CI/CD pipelines, container clusters, and observability infrastructure.",
        "department": "Infrastructure",
        "lead": "DevOps Lead",
        "member_count": 2,
        "tags": ["Kubernetes", "Docker", "SRE"],
    },
    {
        "name": "Product Strategy & Agile Operations",
        "description": "Driving sprint roadmaps, client delivery milestones, and cross-functional resourcing.",
        "department": "Product",
        "lead": "Luxmor",
        "member_count": 3,
        "tags": ["Agile", "Sprints", "Strategy"],
    },
]

TEAM_ROLES = ("Team Lead", "Developer", "Admin")


def _format_user(doc, index=0):
    user_id = str(doc.get("_id", ""))
    first = doc.get("first_name", "").strip()
    last = doc.get("last_name", "").strip()
    username = doc.get("username", "").strip()
    email = doc.get("email", "").strip()

    name = f"{first} {last}".strip() or first or username or email.split("@")[0]
    profile = doc.get("profile", {}) or {}

    role = doc.get("role", "user")
    job_title = (
        profile.get("jobTitle")
        or ("Principal Systems Architect" if role == "admin" else "Software Engineer")
    )
    department = (
        profile.get("department")
        or ("Product Architecture" if role == "admin" else "Engineering")
    )
    location = profile.get("location") or "Chennai, India"
    status_state = profile.get("status") or "active"

    initials = "".join([part[0] for part in name.split()[:2]]).upper() or "NX"
    color = DEFAULT_AVATAR_COLORS[index % len(DEFAULT_AVATAR_COLORS)]

    created_at = doc.get("created_at")
    joined_date = (
        created_at.strftime("%b %Y")
        if isinstance(created_at, datetime)
        else "Oct 2026"
    )
    assigned_teams = profile.get("teams")
    if not isinstance(assigned_teams, list):
        legacy_team = profile.get("team")
        assigned_teams = [legacy_team] if isinstance(legacy_team, str) and legacy_team else []
    assigned_teams = [team for team in assigned_teams if isinstance(team, str) and team]

    return {
        "id": user_id,
        "username": username,
        "email": email,
        "name": name,
        "firstName": first,
        "lastName": last,
        "role": role,
        "jobTitle": job_title,
        "department": department,
        "location": location,
        "phone": profile.get("mobile", "+1 (555) 019-2834"),
        "bio": profile.get(
            "bio",
            "Working on Nexus Agile and cross-functional team workflows.",
        ),
        "avatar": profile.get("photo") or initials,
        "avatarColor": color,
        "status": status_state,
        "joinedDate": joined_date,
        "tasksCount": profile.get("tasksCount", 3 + (index * 2) % 7),
        "team": assigned_teams[0] if assigned_teams else "",
        "teams": assigned_teams,
    }


def _validated_team_assignments(db, team_names):
    if not isinstance(team_names, list) or any(
        not isinstance(name, str) or not name.strip() for name in team_names
    ):
        raise ValueError("Teams must be a list of team names.")

    available_teams = {}
    for team in db.teams.find({}, {"name": 1}):
        name = team.get("name")
        if isinstance(name, str) and name.strip():
            available_teams.setdefault(name.casefold(), name)

    assignments = []
    for name in team_names:
        canonical_name = available_teams.get(name.strip().casefold())
        if canonical_name is None:
            raise ValueError("Select only existing teams.")
        if canonical_name not in assignments:
            assignments.append(canonical_name)
    return assignments


def _invitation_days_left(expires_at, now):
    return max(0, (expires_at.date() - now.date()).days - 1)


def _pending_invitation_count(db, now):
    return db.team_invitations.count_documents(
        {"expires_at": {"$gt": now}, "accepted_at": {"$exists": False}}
    )


class PeopleListView(APIView):
    """
    GET /api/people/ - List team members with search, role, and department filters
    POST /api/people/ - Add or update a person profile
    """

    def get(self, request):
        db = get_database()
        query = {}

        # Search parameter
        search = request.GET.get("search", "").strip().lower()
        role_filter = request.GET.get("role", "").strip().lower()
        dept_filter = request.GET.get("department", "").strip().lower()

        users_cursor = db.users.find(query).sort("created_at", 1)
        people_list = []

        for idx, doc in enumerate(users_cursor):
            person = _format_user(doc, idx)

            # Apply in-memory filtering for rich fields
            if search:
                text_corpus = f"{person['name']} {person['username']} {person['email']} {person['jobTitle']} {person['department']} {person['location']}".lower()
                if search not in text_corpus:
                    continue

            if role_filter and role_filter != "all":
                if person["role"].lower() != role_filter:
                    continue

            if dept_filter and dept_filter != "all":
                if dept_filter not in person["department"].lower():
                    continue

            people_list.append(person)

        return Response(people_list, status=status.HTTP_200_OK)

    def post(self, request):
        db = get_database()
        data = request.data or {}

        email = data.get("email", "").strip().lower()
        name = data.get("name", "").strip()
        role = data.get("role", "user")
        department = data.get("department", "Engineering")
        job_title = data.get("jobTitle", "Team Member")
        location = data.get("location", "Remote")
        bio = data.get("bio", "Nexus collaborator")
        team_assignment_requested = "teams" in data or "team" in data
        if team_assignment_requested:
            requested_teams = data["teams"] if "teams" in data else [data["team"]]
            try:
                assigned_teams = _validated_team_assignments(db, requested_teams)
            except ValueError as error:
                return Response(
                    {"teams": [str(error)]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not email:
            return Response(
                {"error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = db.users.find_one({"email": email})
        if existing:
            # Update existing profile
            update_document = {
                "$set": {
                    "role": role,
                    "profile.department": department,
                    "profile.jobTitle": job_title,
                    "profile.location": location,
                    "profile.bio": bio,
                    "updated_at": datetime.now(timezone.utc),
                }
            }
            if team_assignment_requested:
                update_document["$set"]["profile.teams"] = assigned_teams
                update_document["$unset"] = {"profile.team": ""}
            db.users.update_one({"_id": existing["_id"]}, update_document)
            updated = db.users.find_one({"_id": existing["_id"]})
            return Response(_format_user(updated), status=status.HTTP_200_OK)

        # Create new member record
        now = datetime.now(timezone.utc)
        username = email.split("@")[0].replace(".", "_")
        first_name = name.split()[0] if name else username
        last_name = " ".join(name.split()[1:]) if len(name.split()) > 1 else ""

        new_doc = {
            "username": username,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "role": role,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            "profile": {
                "department": department,
                "jobTitle": job_title,
                "location": location,
                "bio": bio,
                "status": "active",
                "teams": assigned_teams if team_assignment_requested else [],
            },
        }
        res = db.users.insert_one(new_doc)
        new_doc["_id"] = res.inserted_id
        return Response(_format_user(new_doc), status=status.HTTP_201_CREATED)


class PeopleDetailView(APIView):
    """
    GET /api/people/<user_id>/ - Get single member details
    PATCH /api/people/<user_id>/ - Update member info / role
    DELETE /api/people/<user_id>/ - Deactivate / remove member
    """

    def get(self, request, user_id):
        db = get_database()
        try:
            doc = db.users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            doc = db.users.find_one({"username": user_id})

        if not doc:
            return Response(
                {"error": "Member not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_format_user(doc), status=status.HTTP_200_OK)

    def patch(self, request, user_id):
        db = get_database()
        data = request.data or {}

        try:
            target = {"_id": ObjectId(user_id)}
        except Exception:
            target = {"username": user_id}

        existing = db.users.find_one(target)
        if not existing:
            return Response(
                {"error": "Member not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        update_fields = {"updated_at": datetime.now(timezone.utc)}
        if "role" in data:
            update_fields["role"] = data["role"]
        if "name" in data and data["name"]:
            parts = data["name"].split()
            update_fields["first_name"] = parts[0]
            update_fields["last_name"] = " ".join(parts[1:]) if len(parts) > 1 else ""

        profile_updates = {}
        for key in ["jobTitle", "department", "location", "phone", "bio", "status"]:
            if key in data:
                profile_updates[f"profile.{key}"] = data[key]

        team_assignment_requested = "teams" in data or "team" in data
        if team_assignment_requested:
            requested_teams = data["teams"] if "teams" in data else [data["team"]]
            try:
                profile_updates["profile.teams"] = _validated_team_assignments(
                    db, requested_teams
                )
            except ValueError as error:
                return Response(
                    {"teams": [str(error)]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        update_fields.update(profile_updates)
        update_document = {"$set": update_fields}
        if team_assignment_requested:
            update_document["$unset"] = {"profile.team": ""}
        db.users.update_one(target, update_document)

        updated = db.users.find_one(target)
        return Response(_format_user(updated), status=status.HTTP_200_OK)

    def delete(self, request, user_id):
        db = get_database()
        try:
            target = {"_id": ObjectId(user_id)}
        except Exception:
            target = {"username": user_id}

        result = db.users.delete_one(target)
        if result.deleted_count == 0:
            return Response(
                {"error": "Member not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            {"message": "Member removed successfully"},
            status=status.HTTP_200_OK,
        )


class TeamListView(APIView):
    """
    GET /api/people/teams/ - List teams & departments
    POST /api/people/teams/ - Create a new team
    """

    def get(self, request):
        db = get_database()
        if "teams" not in db.list_collection_names() or db.teams.count_documents({}) == 0:
            # Seed default teams
            for t in DEFAULT_TEAMS:
                db.teams.insert_one(
                    {
                        **t,
                        "created_at": datetime.now(timezone.utc),
                    }
                )

        teams_cursor = db.teams.find({}).sort("name", 1)
        teams_list = []
        for doc in teams_cursor:
            team_name = doc.get("name")
            member_count = 0
            if "users" in db.list_collection_names():
                for user in db.users.find({}, {"profile.teams": 1, "profile.team": 1}):
                    profile = user.get("profile") or {}
                    assigned = profile.get("teams")
                    if not isinstance(assigned, list):
                        legacy_team = profile.get("team")
                        assigned = [legacy_team] if legacy_team else []
                    if any(
                        isinstance(name, str)
                        and name.strip().casefold() == str(team_name).strip().casefold()
                        for name in assigned
                    ):
                        member_count += 1

            created_at = doc.get("created_at")
            created_date = None
            if isinstance(created_at, datetime):
                month_names = (
                    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
                )
                created_date = f"{month_names[created_at.month - 1]} {created_at.day}, {created_at.year}"

            teams_list.append(
                {
                    "id": str(doc.get("_id", "")),
                    "name": team_name,
                    "description": doc.get("description", ""),
                    "department": doc.get("department", "Engineering"),
                    "lead": doc.get("lead", "Team Lead"),
                    "role": doc.get("role", "Team Lead"),
                    "memberCount": member_count or doc.get("member_count", 0),
                    "tags": doc.get("tags", []),
                    "createdDate": created_date,
                }
            )
        return Response(teams_list, status=status.HTTP_200_OK)

    def post(self, request):
        db = get_database()
        data = request.data or {}
        raw_name = data.get("name", "")
        if not isinstance(raw_name, str):
            return Response(
                {"error": "Team name must be text."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        name = raw_name.strip()
        if not name:
            return Response(
                {"error": "Team name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if "@" in name:
            return Response(
                {"error": "Email addresses are not allowed in team names."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        role = data.get("role", "Team Lead")
        if role not in TEAM_ROLES:
            return Response(
                {"error": "Select a valid team role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_team = {
            "name": name,
            "description": data.get("description", "Nexus operational squad."),
            "department": data.get("department", "Engineering"),
            "lead": data.get("lead", "Team Lead"),
            "role": role,
            "member_count": int(data.get("memberCount", 1)),
            "tags": data.get("tags", ["Active"]),
            "created_at": datetime.now(timezone.utc),
        }
        res = db.teams.insert_one(new_team)
        new_team["id"] = str(res.inserted_id)
        new_team.pop("_id", None)
        return Response(new_team, status=status.HTTP_201_CREATED)


class TeamDetailView(APIView):
    """
    GET /api/people/teams/<team_id>/
    PUT /api/people/teams/<team_id>/
    DELETE /api/people/teams/<team_id>/
    """

    def put(self, request, team_id):
        db = get_database()
        data = request.data or {}
        raw_name = data.get("name", "")
        if not isinstance(raw_name, str):
            return Response(
                {"error": "Team name must be text."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        name = raw_name.strip()
        if not name:
            return Response(
                {"error": "Team name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if "@" in name:
            return Response(
                {"error": "Email addresses are not allowed in team names."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for field in ("description", "department", "lead", "role"):
            if field in data and not isinstance(data[field], str):
                return Response(
                    {"error": f"{field.capitalize()} must be text."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        role = data.get("role", "Team Lead")
        if role not in TEAM_ROLES:
            return Response(
                {"error": "Select a valid team role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tags = data.get("tags", [])
        if not isinstance(tags, list) or any(
            not isinstance(tag, str) for tag in tags
        ):
            return Response(
                {"error": "Tags must be a list of text values."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target = (
            {"_id": ObjectId(team_id)}
            if ObjectId.is_valid(team_id)
            else {"name": team_id}
        )
        update_fields = {
            "name": name,
            "description": data.get("description", ""),
            "department": data.get("department", "Engineering"),
            "role": role,
            "tags": tags,
        }
        result = db.teams.update_one(target, {"$set": update_fields})
        if result.matched_count == 0:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        updated_team = db.teams.find_one(target)
        return Response(
            {
                "id": str(updated_team.get("_id", "")),
                "name": updated_team.get("name"),
                "description": updated_team.get("description", ""),
                "department": updated_team.get("department", "Engineering"),
                "lead": updated_team.get("lead", "Team Lead"),
                "role": updated_team.get("role", "Team Lead"),
                "memberCount": updated_team.get("member_count", 0),
                "tags": updated_team.get("tags", []),
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, team_id):
        db = get_database()
        try:
            target = {"_id": ObjectId(team_id)}
        except Exception:
            target = {"name": team_id}

        db.teams.delete_one(target)
        return Response(
            {"message": "Team removed"},
            status=status.HTTP_200_OK,
        )


class PeopleInvitationsView(APIView):
    """
    GET /api/people/invitations/ - List pending invitations
    POST /api/people/invitations/ - Send a new invitation
    DELETE /api/people/invitations/<email>/ - Revoke invitation
    """

    def get(self, request):
        db = get_database()
        now = datetime.now(timezone.utc)
        cursor = db.team_invitations.find(
            {
                "expires_at": {"$gt": now},
                "accepted_at": {"$exists": False},
            }
        ).sort("created_at", -1)

        invites = []
        for inv in cursor:
            exp = inv.get("expires_at", now)
            days_left = _invitation_days_left(exp, now)
            invites.append(
                {
                    "id": str(inv.get("_id", "")),
                    "email": inv.get("email"),
                    "role": inv.get("role", "user"),
                    "department": inv.get("department", "Engineering"),
                    "teams": inv.get(
                        "teams",
                        [inv["team"]] if inv.get("team") else [],
                    ),
                    "createdAt": inv.get("created_at").strftime("%b %d, %Y")
                    if isinstance(inv.get("created_at"), datetime)
                    else "Recent",
                    "expiresIn": f"{days_left} days left" if days_left > 0 else "Expiring soon",
                    "expiresAt": exp.isoformat(),
                    "status": "pending",
                }
            )
        return Response(invites, status=status.HTTP_200_OK)

    def post(self, request):
        db = get_database()
        data = request.data or {}
        email = str(data.get("email", "")).strip().lower()
        role = data.get("role", "user")
        department = str(data.get("department", "")).strip()
        requested_teams = data.get("teams")
        if requested_teams is None and "team" in data:
            requested_teams = [data["team"]]

        if not email:
            return Response(
                {"error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if department not in INVITE_DEPARTMENT_OPTIONS:
            return Response(
                {"error": "Select a valid department"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {"error": "Invalid Email"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if email.rsplit("@", 1)[-1] not in {"gmail.com", "gmaail.com"}:
            return Response(
                {"error": "Invalid Email"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        db = get_database()
        try:
            assigned_teams = _validated_team_assignments(db, requested_teams)
        except ValueError as error:
            return Response(
                {"teams": [str(error)]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not assigned_teams:
            return Response(
                {"teams": ["Select at least one team or squad."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=7)
        invitation = {
            "email": email,
            "role": role,
            "department": department,
            "teams": assigned_teams,
            "token_hash": secrets.token_hex(16),
            "created_at": now,
            "expires_at": expires_at,
        }
        db.team_invitations.update_one(
            {"email": email},
            {"$set": invitation, "$unset": {"accepted_at": "", "accepted_by": ""}},
            upsert=True,
        )

        return Response(
            {
                "message": f"Invitation successfully issued to {email}",
                "email": email,
                "role": role,
                "department": department,
                "teams": assigned_teams,
                "expiresIn": f"{_invitation_days_left(expires_at, now)} days left",
                "expiresAt": expires_at.isoformat(),
                "status": "pending",
            },
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, email=None):
        db = get_database()
        target_email = email or request.GET.get("email", "")
        if not target_email:
            return Response(
                {"error": "Email required to revoke invitation"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        db.team_invitations.delete_one({"email": target_email.lower()})
        pending_invites = _pending_invitation_count(db, datetime.now(timezone.utc))
        return Response(
            {
                "message": f"Invitation for {target_email} revoked",
                "pendingInvitations": pending_invites,
            },
            status=status.HTTP_200_OK,
        )


class PeopleStatsView(APIView):
    """
    GET /api/people/stats/ - Summary counts for people directory
    """

    def get(self, request):
        db = get_database()
        now = datetime.now(timezone.utc)
        total_members = db.users.count_documents({})
        pending_invites = _pending_invitation_count(db, now)
        total_teams = db.teams.count_documents({}) if "teams" in db.list_collection_names() else len(DEFAULT_TEAMS)

        return Response(
            {
                "totalMembers": total_members,
                "activeNow": max(1, total_members),
                "totalTeams": max(total_teams, 4),
                "pendingInvitations": pending_invites,
            },
            status=status.HTTP_200_OK,
        )
