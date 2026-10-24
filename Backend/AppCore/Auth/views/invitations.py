import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.core.mail import send_mail
from pymongo import ReturnDocument
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ...db import get_database
from ..role_permissions import ROLE_LABELS, has_role_permission
from ..serializers import CreateInvitationSerializer, InvitationTokenSerializer
from ..utils import user_payload


logger = logging.getLogger(__name__)
INVITATION_TTL = timedelta(days=7)


def _token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _get_valid_invitation(database, token, now=None):
    return database.team_invitations.find_one(
        {
            "token_hash": _token_hash(token),
            "expires_at": {"$gt": now or datetime.now(timezone.utc)},
            "accepted_at": {"$exists": False},
        }
    )


class TeamInvitationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not has_role_permission(request.user, "manage_team"):
            return Response(
                {"detail": "You do not have permission to manage team invitations."},
                status=status.HTTP_403_FORBIDDEN,
            )

        now = datetime.now(timezone.utc)
        invitations = get_database().team_invitations.find(
            {
                "expires_at": {"$gt": now},
                "accepted_at": {"$exists": False},
            },
            {"_id": 0, "token_hash": 0},
        ).sort("created_at", -1)
        return Response(
            [
                {
                    "email": invitation["email"],
                    "role": invitation["role"],
                    "created_at": invitation["created_at"],
                    "expires_at": invitation["expires_at"],
                }
                for invitation in invitations
            ],
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        if not has_role_permission(request.user, "manage_team"):
            return Response(
                {"detail": "You do not have permission to invite team members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CreateInvitationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data["email"]
        role = serializer.validated_data["role"]
        if email == request.user.email.lower():
            return Response(
                {"email": ["You cannot invite your own account."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if role == "admin" and request.user.role != "admin":
            return Response(
                {"role": ["Only an Admin can invite another Admin."]},
                status=status.HTTP_403_FORBIDDEN,
            )
        if request.user.role != "admin" and role != "user":
            return Response(
                {"role": ["Only an Admin can invite Team Leads or Admins."]},
                status=status.HTTP_403_FORBIDDEN,
            )

        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        invitation = {
            "email": email,
            "role": role,
            "token_hash": _token_hash(token),
            "invited_by": str(request.user.id),
            "created_at": now,
            "expires_at": now + INVITATION_TTL,
        }
        database = get_database()
        database.team_invitations.update_one(
            {"email": email},
            {"$set": invitation, "$unset": {"accepted_at": "", "accepted_by": ""}},
            upsert=True,
        )

        invite_url = f"{settings.FRONTEND_URL}/accept-invite?token={token}"
        role_name = ROLE_LABELS[role]
        message = (
            f"You have been invited to join Nexus as {role_name}.\n\n"
            f"Accept your invitation within 7 days:\n{invite_url}\n\n"
            "If you were not expecting this invitation, you can ignore this email."
        )
        try:
            sent_count = send_mail(
                subject=f"Invitation to join Nexus as {role_name}",
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
            if sent_count != 1:
                raise RuntimeError("Email backend did not deliver the invitation.")
        except Exception:
            logger.exception("Failed to deliver a Nexus team invitation to %s.", email)
            database.team_invitations.delete_one(
                {"email": email, "token_hash": invitation["token_hash"]}
            )
            return Response(
                {"detail": "The invitation email could not be sent. Check the email server configuration and try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {"message": f"Invitation sent to {email}.", "email": email, "role": role},
            status=status.HTTP_201_CREATED,
        )


class InvitationPreviewView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        serializer = InvitationTokenSerializer(data={"token": request.query_params.get("token", "")})
        if not serializer.is_valid():
            return Response(
                {"detail": "This invitation link is invalid or expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invitation = _get_valid_invitation(get_database(), serializer.validated_data["token"])
        if invitation is None:
            return Response(
                {"detail": "This invitation link is invalid or expired."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            {"email": invitation["email"], "role": invitation["role"]},
            status=status.HTTP_200_OK,
        )


class AcceptInvitationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = InvitationTokenSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        database = get_database()
        token = serializer.validated_data["token"]
        invitation = _get_valid_invitation(database, token)
        if invitation is None:
            return Response(
                {"detail": "This invitation link is invalid, expired, or already accepted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if request.user.email.lower() != invitation["email"].lower():
            return Response(
                {"detail": "Sign in with the email address this invitation was sent to."},
                status=status.HTTP_403_FORBIDDEN,
            )

        now = datetime.now(timezone.utc)
        accepted = database.team_invitations.find_one_and_update(
            {
                "email": invitation["email"],
                "token_hash": _token_hash(token),
                "expires_at": {"$gt": now},
                "accepted_at": {"$exists": False},
            },
            {
                "$set": {
                    "accepted_at": now,
                    "accepted_by": str(request.user.id),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if accepted is None:
            return Response(
                {"detail": "This invitation link is invalid, expired, or already accepted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        database.users.update_one(
            {"_id": request.user.id},
            {"$set": {"role": accepted["role"], "updated_at": now}},
        )
        user_document = database.users.find_one({"_id": request.user.id})
        if user_document is None:
            return Response(
                {"detail": "The invitation was accepted, but the account could not be loaded."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(
            {
                "message": "Invitation accepted.",
                "user": user_payload(user_document),
            },
            status=status.HTTP_200_OK,
        )
