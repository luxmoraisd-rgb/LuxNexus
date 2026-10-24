import os
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from django.conf import settings
from django.core.mail import send_mail
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

    # Derive consistent team name
    team_name = (
        profile.get("team")
        or (profile.get("teams")[0] if isinstance(profile.get("teams"), list) and profile.get("teams") else None)
        or doc.get("team")
    )
    if not team_name:
        if role == "admin":
            team_name = "Core Platform Engineering"
        else:
            available_squads = [
                "Frontend & UI Experience",
                "Core Platform Engineering",
                "DevOps & Cloud Reliability",
                "Product Strategy & Agile Operations",
            ]
            team_name = available_squads[index % len(available_squads)]

    teams_list = profile.get("teams")
    if not isinstance(teams_list, list) or not teams_list:
        teams_list = [team_name]
    elif team_name not in teams_list:
        teams_list = [team_name] + teams_list

    initials = "".join([part[0] for part in name.split()[:2]]).upper() or "NX"
    color = DEFAULT_AVATAR_COLORS[index % len(DEFAULT_AVATAR_COLORS)]

    created_at = doc.get("created_at")
    joined_date = (
        created_at.strftime("%b %Y")
        if isinstance(created_at, datetime)
        else "Oct 2026"
    )

    return {
        "id": user_id,
        "username": username,
        "email": email,
        "name": name,
        "firstName": first,
        "lastName": last,
        "role": role,
        "team": team_name,
        "teams": teams_list,
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
    }


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
        viewer_role = request.GET.get("viewer_role", "").strip().lower()
        viewer_team = request.GET.get("viewer_team", "").strip()

        # Determine admin status & current user's team
        is_admin = False
        current_user_team = viewer_team or None

        req_user = getattr(request, "user", None)
        if req_user and getattr(req_user, "is_authenticated", False):
            u_role = (getattr(req_user, "role", "user") or "user").lower()
            if u_role == "admin" or getattr(req_user, "is_staff", False) or getattr(req_user, "is_superuser", False):
                is_admin = True

            user_doc = None
            if hasattr(req_user, "id"):
                try:
                    user_doc = db.users.find_one({"_id": ObjectId(str(req_user.id))})
                except Exception:
                    pass
            if not user_doc and hasattr(req_user, "email"):
                user_doc = db.users.find_one({"email": req_user.email})
            if not user_doc and hasattr(req_user, "username"):
                user_doc = db.users.find_one({"username": req_user.username})

            if user_doc:
                if (user_doc.get("role") or "").lower() == "admin":
                    is_admin = True
                if not current_user_team:
                    p = user_doc.get("profile") or {}
                    current_user_team = (
                        p.get("team")
                        or (p.get("teams")[0] if p.get("teams") else None)
                        or user_doc.get("team")
                    )

        if viewer_role == "admin":
            is_admin = True

        users_cursor = db.users.find(query).sort("created_at", 1)
        people_list = []

        for idx, doc in enumerate(users_cursor):
            person = _format_user(doc, idx)

            # Non-admin users ONLY see members of their own team!
            # Admin sees all members across all teams.
            if not is_admin and current_user_team:
                p_team = person.get("team") or ""
                p_teams = person.get("teams") or []
                is_same_team = (
                    p_team.lower() == current_user_team.lower()
                    or any(t.lower() == current_user_team.lower() for t in p_teams)
                )
                is_self = (
                    str(doc.get("_id")) == str(getattr(req_user, "id", ""))
                    or (hasattr(req_user, "email") and doc.get("email") == getattr(req_user, "email", None))
                )
                if not is_same_team and not is_self:
                    continue

            # Apply in-memory filtering for rich fields
            if search:
                text_corpus = f"{person['name']} {person['username']} {person['email']} {person['jobTitle']} {person['department']} {person.get('team', '')} {person['location']}".lower()
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
        team = data.get("team") or data.get("teamName") or "Frontend & UI Experience"
        department = data.get("department", "Engineering")
        job_title = data.get("jobTitle", "Team Member")
        location = data.get("location", "Remote")
        bio = data.get("bio", "Nexus collaborator")

        if not email:
            return Response(
                {"error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = db.users.find_one({"email": email})
        if existing:
            # Update existing profile
            db.users.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "role": role,
                        "profile.team": team,
                        "profile.teams": [team],
                        "profile.department": department,
                        "profile.jobTitle": job_title,
                        "profile.location": location,
                        "profile.bio": bio,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
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
                "team": team,
                "teams": [team],
                "department": department,
                "jobTitle": job_title,
                "location": location,
                "bio": bio,
                "status": "active",
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
        for key in ["jobTitle", "department", "location", "phone", "bio", "status", "team"]:
            if key in data:
                profile_updates[f"profile.{key}"] = data[key]
                if key == "team":
                    profile_updates["profile.teams"] = [data["team"]]

        update_fields.update(profile_updates)
        db.users.update_one(target, {"$set": update_fields})

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
            teams_list.append(
                {
                    "id": str(doc.get("_id", "")),
                    "name": doc.get("name"),
                    "description": doc.get("description", ""),
                    "department": doc.get("department", "Engineering"),
                    "lead": doc.get("lead", "Team Lead"),
                    "memberCount": doc.get("member_count", 3),
                    "tags": doc.get("tags", []),
                }
            )
        return Response(teams_list, status=status.HTTP_200_OK)

    def post(self, request):
        db = get_database()
        data = request.data or {}
        name = data.get("name", "").strip()
        if not name:
            return Response(
                {"error": "Team name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_team = {
            "name": name,
            "description": data.get("description", "Nexus operational squad."),
            "department": data.get("department", "Engineering"),
            "lead": data.get("lead", "Team Lead"),
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
            days_left = max(0, (exp - now).days)
            invites.append(
                {
                    "id": str(inv.get("_id", "")),
                    "email": inv.get("email"),
                    "role": inv.get("role", "user"),
                    "department": inv.get("department", "Engineering"),
                    "team": inv.get("team", "Frontend & UI Experience"),
                    "createdAt": inv.get("created_at").strftime("%b %d, %Y")
                    if isinstance(inv.get("created_at"), datetime)
                    else "Recent",
                    "expiresIn": f"{days_left} days left" if days_left > 0 else "Expiring soon",
                    "status": "pending",
                }
            )
        return Response(invites, status=status.HTTP_200_OK)

    def post(self, request):
        db = get_database()
        data = request.data or {}
        email = data.get("email", "").strip().lower()
        role = data.get("role", "user")
        department = data.get("department", "Engineering")
        team = data.get("team", "Frontend & UI Experience")

        if not email:
            return Response(
                {"error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        invitation = {
            "email": email,
            "role": role,
            "department": department,
            "team": team,
            "token_hash": secrets.token_hex(16),
            "created_at": now,
            "expires_at": now + timedelta(days=7),
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
                "team": team,
                "expiresIn": "7 days left",
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
        return Response(
            {"message": f"Invitation for {target_email} revoked"},
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
        pending_invites = db.team_invitations.count_documents(
            {"expires_at": {"$gt": now}, "accepted_at": {"$exists": False}}
        )
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
