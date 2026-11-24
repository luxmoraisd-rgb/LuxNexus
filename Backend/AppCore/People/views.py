import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from django.conf import settings
from django.core.mail import send_mail
from pymongo.errors import DuplicateKeyError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..Auth.utils import user_payload
from ..Auth.role_permissions import (
    ROLE_LABELS,
    RoleModulePermission,
    is_configured_admin,
)
from ..Auth.serializers.signup import EMPLOYEE_ID_PATTERN
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

def _format_user(doc, index=0):
    user_id = str(doc.get("_id", ""))
    first = doc.get("first_name", "").strip()
    last = doc.get("last_name", "").strip()
    username = doc.get("username", "").strip()
    email = doc.get("email", "").strip()

    name = f"{first} {last}".strip() or first or username or email.split("@")[0]
    profile = doc.get("profile", {}) or {}

    role = doc.get("role", "user")
    job_title = profile.get("jobTitle", "")
    department = profile.get("department", "")
    location = profile.get("location", "")
    status_state = profile.get("status") or "active"

    initials = "".join([part[0] for part in name.split()[:2]]).upper() or "NX"
    color = DEFAULT_AVATAR_COLORS[index % len(DEFAULT_AVATAR_COLORS)]

    created_at = doc.get("created_at")
    joined_date = (
        created_at.strftime("%b %Y")
        if isinstance(created_at, datetime)
        else ""
    )

    return {
        "id": user_id,
        "username": username,
        "email": email,
        "employeeId": doc.get("employee_id", ""),
        "name": name,
        "firstName": first,
        "lastName": last,
        "role": role,
        "jobTitle": job_title,
        "department": department,
        "location": location,
        "phone": profile.get("mobile", ""),
        "bio": profile.get("bio", ""),
        "avatar": profile.get("photo") or initials,
        "avatarColor": color,
        "status": status_state,
        "joinedDate": joined_date,
        "tasksCount": profile.get("tasksCount", 0),
        "teams": profile.get("teams", []),
    }


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
            person["can_edit_employee_id"] = is_configured_admin(request.user)

            # Apply in-memory filtering for rich fields
            if search:
                text_corpus = f"{person['name']} {person['username']} {person['email']} {person['employeeId']} {person['jobTitle']} {person['department']} {person['location']}".lower()
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
        if role not in ROLE_LABELS:
            return Response(
                {"role": "Choose a valid workspace role."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if role == "admin" and email not in settings.NEXUS_ADMIN_EMAILS:
            return Response(
                {"role": "Only configured Admin identities can be assigned the Admin role."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        department = data.get("department", "Engineering")
        job_title = data.get("jobTitle", "")
        location = data.get("location", "")
        bio = data.get("bio", "")

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
        person = _format_user(doc)
        person["can_edit_employee_id"] = is_configured_admin(request.user)
        return Response(person, status=status.HTTP_200_OK)

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

        has_employee_id = "employeeId" in data or "employee_id" in data
        employee_id_sequence = None
        update_fields = {"updated_at": datetime.now(timezone.utc)}
        if has_employee_id:
            if not is_configured_admin(request.user):
                return Response(
                    {"error": "Only admins can change Employee ID."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            employee_id = data.get("employeeId", data.get("employee_id"))
            if not isinstance(employee_id, str):
                return Response(
                    {"error": "Employee ID must be a string."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            employee_id = employee_id.strip().upper()
            if not re.fullmatch(EMPLOYEE_ID_PATTERN, employee_id):
                return Response(
                    {
                        "error": (
                            "Use LUX-SD-CHN-001 through LUX-SD-CHN-999, replacing "
                            "CHN with BNG or HYD for your branch."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            employee_id_sequence = int(employee_id[-3:])
            update_fields["employee_id"] = employee_id
            update_fields["employee_id_sequence"] = employee_id_sequence

        if "role" in data:
            if data["role"] not in ROLE_LABELS:
                return Response(
                    {"role": "Choose a valid workspace role."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            target_email = str(existing.get("email", "")).strip().lower()
            if data["role"] == "admin" and target_email not in settings.NEXUS_ADMIN_EMAILS:
                return Response(
                    {"role": "Only configured Admin identities can be assigned the Admin role."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            update_fields["role"] = data["role"]
        if "name" in data and data["name"]:
            parts = data["name"].split()
            update_fields["first_name"] = parts[0]
            update_fields["last_name"] = " ".join(parts[1:]) if len(parts) > 1 else ""

        profile_updates = {}
        for key in ["jobTitle", "department", "location", "phone", "bio", "status"]:
            if key in data:
                profile_updates[f"profile.{key}"] = data[key]

        update_fields.update(profile_updates)
        if employee_id_sequence is not None and db.users.find_one(
            {
                "employee_id_sequence": employee_id_sequence,
                "_id": {"$ne": existing["_id"]},
            }
        ):
            return Response(
                {"error": "This employee ID number is already assigned."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            db.users.update_one(target, {"$set": update_fields})
        except DuplicateKeyError:
            return Response(
                {"error": "This employee ID number is already assigned."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = db.users.find_one(target)
        person = _format_user(updated)
        person["can_edit_employee_id"] = is_configured_admin(request.user)
        return Response(person, status=status.HTTP_200_OK)

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
        teams_cursor = db.teams.find({}).sort("name", 1)
        teams_list = []
        for doc in teams_cursor:
            teams_list.append(
                {
                    "id": str(doc.get("_id", "")),
                    "name": doc.get("name"),
                    "description": doc.get("description", ""),
                    "department": doc.get("department", "Engineering"),
                    "lead": doc.get("lead", ""),
                    "memberCount": doc.get("member_count", 0),
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
            "description": data.get("description", ""),
            "department": data.get("department", "Engineering"),
            "lead": data.get("lead", ""),
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

    permission_classes = [IsAuthenticated, RoleModulePermission]

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
        email = data.get("email", "").strip().lower()
        role = data.get("role", "user")
        department = data.get("department", "Engineering")

        if not email:
            return Response(
                {"error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if role not in ROLE_LABELS:
            return Response(
                {"role": "Choose a valid workspace role."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if role == "admin" and email not in settings.NEXUS_ADMIN_EMAILS:
            return Response(
                {"role": "Only configured Admin identities can be assigned the Admin role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=7)
        invitation = {
            "email": email,
            "role": role,
            "department": department,
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
        total_teams = db.teams.count_documents({})
        active_members = db.users.count_documents(
            {"is_active": True, "profile.status": "active"}
        )

        return Response(
            {
                "totalMembers": total_members,
                "activeNow": active_members,
                "totalTeams": total_teams,
                "pendingInvitations": pending_invites,
            },
            status=status.HTTP_200_OK,
        )
