from datetime import datetime, timezone

from django.contrib.auth.hashers import make_password
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ...api_utils import validation_error
from ...db import get_database
from ..serializers import SignupSerializer
from ..utils import create_token, normalize_username, user_payload
from .invitations import _get_valid_invitation, _token_hash


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if not serializer.is_valid():
            return validation_error(serializer)

        values = serializer.validated_data
        database = get_database()
        email = values["email"]
        if database.users.find_one({"email": email}) is not None:
            message = (
                "An account with this email address already exists. Please sign in."
            )
            return Response(
                {"error": message, "message": message, "errors": {"email": [message]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invitation_token = values.get("invitation_token") or ""
        invitation = None
        if invitation_token:
            invitation = _get_valid_invitation(database, invitation_token)
            if invitation is None or invitation["email"].lower() != email:
                return Response(
                    {"invitation_token": ["This invitation is invalid, expired, or addressed to a different email."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        raw_name = (values.get("fullName") or values.get("name") or "").strip()
        username_source = values.get("username") or raw_name or email.split("@")[0]
        base_username = normalize_username(username_source)
        username = base_username
        suffix = 1
        while database.users.find_one({"username": username}):
            username = f"{base_username[:140]}{suffix}"
            suffix += 1

        now = datetime.now(timezone.utc)
        user_document = {
            "username": username,
            "email": email,
            "password_hash": make_password(values["password"]),
            "first_name": raw_name,
            "last_name": "",
            "role": invitation["role"] if invitation else "user",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        if invitation:
            invitation = database.team_invitations.find_one_and_update(
                {
                    "email": email,
                    "token_hash": _token_hash(invitation_token),
                    "expires_at": {"$gt": now},
                    "accepted_at": {"$exists": False},
                },
                {
                    "$set": {
                        "accepted_at": now,
                        "accepted_by_email": email,
                    }
                },
                return_document=ReturnDocument.AFTER,
            )
            if invitation is None:
                return Response(
                    {"invitation_token": ["This invitation has already been accepted or expired."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            user_document["_id"] = database.users.insert_one(user_document).inserted_id
        except DuplicateKeyError:
            if invitation:
                database.team_invitations.update_one(
                    {"email": email, "token_hash": _token_hash(invitation_token)},
                    {"$unset": {"accepted_at": "", "accepted_by_email": ""}},
                )
            message = (
                "An account with this email address already exists. Please sign in."
            )
            return Response(
                {"error": message, "message": message, "errors": {"email": [message]}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            if invitation:
                database.team_invitations.update_one(
                    {"email": email, "token_hash": _token_hash(invitation_token)},
                    {"$unset": {"accepted_at": "", "accepted_by_email": ""}},
                )
            raise

        token = create_token(
            user_document["_id"],
            database,
            now,
        )
        return Response(
            {
                "message": "Signup successful",
                "user": user_payload(user_document),
                "token": token,
                "invitation_accepted": invitation is not None,
            },
            status=status.HTTP_201_CREATED,
        )
