import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ...api_utils import validation_error
from ...db import get_database
from ..serializers import ResetPasswordSerializer
from ..utils import is_valid_otp, otp_hash


import logging
import re

logger = logging.getLogger(__name__)


class SendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_email = str(request.data.get("email", "")).strip()
        email = raw_email.lower()
        if not email:
            return Response(
                {"error": "Email is required.", "message": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        database = get_database()
        
        # Case-insensitive query matching email or username
        escaped_input = re.escape(raw_email)
        query = {
            "$or": [
                {"email": {"$regex": f"^{escaped_input}$", "$options": "i"}},
                {"username": {"$regex": f"^{escaped_input}$", "$options": "i"}},
            ]
        }
        user = database.users.find_one(query)
        if user is None:
            user = database.auth_user.find_one(query)

        if user is None:
            message = (
                "This email address is not registered in our database. "
                "Please check your email or sign up."
            )
            return Response(
                {"error": message, "message": message},
                status=status.HTTP_404_NOT_FOUND,
            )

        canonical_email = (user.get("email") or email).strip().lower()
        otp = f"{secrets.randbelow(900000) + 100000:06d}"
        now = datetime.now(timezone.utc)
        expiry = now + timedelta(minutes=10)

        # Store OTP for both canonical_email and input email
        database.password_reset_otps.update_one(
            {"email": canonical_email},
            {
                "$set": {
                    "otp_hash": otp_hash(canonical_email, otp),
                    "created_at": now,
                    "expires_at": expiry,
                }
            },
            upsert=True,
        )
        if email != canonical_email:
            database.password_reset_otps.update_one(
                {"email": email},
                {
                    "$set": {
                        "otp_hash": otp_hash(email, otp),
                        "created_at": now,
                        "expires_at": expiry,
                    }
                },
                upsert=True,
            )

        user_display = user.get("username") or user.get("first_name") or "there"
        email_sent = False
        from_sender = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "noreply@nexusapp.local"
        smtp_configured = bool(getattr(settings, "EMAIL_HOST", ""))

        try:
            sent_count = send_mail(
                subject="Password Reset OTP - NexusApp",
                message=(
                    f"Hello {user_display},\n\n"
                    f"Your password reset OTP is: {otp}\n\n"
                    f"This OTP is valid for 10 minutes.\n\n"
                    "If you did not request this, you can safely ignore this email."
                ),
                from_email=from_sender,
                recipient_list=[canonical_email],
                fail_silently=False,
            )
            email_sent = (sent_count >= 1)
        except Exception as mail_err:
            logger.exception("Failed to deliver password reset OTP email to %s: %s", canonical_email, mail_err)
            print(f"[AUTH OTP] Password Reset OTP for {canonical_email}: {otp}")
            return Response(
                {
                    "error": (
                        "Unable to deliver the OTP email via mail server. Please ensure SMTP settings "
                        "(EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD) "
                        "are configured in Backend/.env."
                    ),
                    "message": "Failed to deliver OTP email.",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not smtp_configured:
            print(f"[AUTH DEV LOG] EMAIL_HOST is not configured in Backend/.env. Django printed OTP to console: {otp}")
        else:
            print(f"[AUTH OTP] Password Reset OTP sent to {canonical_email}")

        return Response(
            {
                "message": f"Verification OTP has been sent to {canonical_email}. Please check your email inbox.",
                "email": canonical_email,
                "email_sent": email_sent,
            },
            status=status.HTTP_200_OK,
        )


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        otp = str(request.data.get("otp", "")).strip()
        if not email or not otp:
            return Response(
                {"error": "Email and OTP are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not is_valid_otp(email, otp):
            return Response(
                {"error": "Invalid or expired verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "message": (
                    "OTP verified successfully. You may now reset your password."
                )
            },
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return validation_error(serializer)
        email = serializer.validated_data["email"].strip().lower()
        otp = serializer.validated_data["otp"].strip()
        password = serializer.validated_data["new_password"]
        database = get_database()
        if not is_valid_otp(email, otp):
            return Response(
                {"error": "Invalid or expired verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        escaped_input = re.escape(email)
        query = {
            "$or": [
                {"email": {"$regex": f"^{escaped_input}$", "$options": "i"}},
                {"username": {"$regex": f"^{escaped_input}$", "$options": "i"}},
            ]
        }
        user = database.users.find_one(query)
        auth_doc = database.auth_user.find_one(query)

        if user is None and auth_doc is None:
            return Response(
                {"error": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        new_hash = make_password(password)
        now = datetime.now(timezone.utc)

        if user:
            database.users.update_one(
                {"_id": user["_id"]},
                {
                    "$set": {
                        "password_hash": new_hash,
                        "updated_at": now,
                    }
                },
            )
            database.tokens.delete_many({"user_id": str(user["_id"])})

        if auth_doc:
            database.auth_user.update_one(
                {"_id": auth_doc["_id"]},
                {
                    "$set": {
                        "password": new_hash,
                    }
                },
            )

        # Sync with Django ORM if applicable
        try:
            from django.contrib.auth import get_user_model
            UserModel = get_user_model()
            orm_user = UserModel.objects.filter(email__iexact=email).first() or UserModel.objects.filter(username__iexact=email).first()
            if orm_user:
                orm_user.set_password(password)
                orm_user.save()
        except Exception:
            pass

        database.password_reset_otps.delete_many({
            "$or": [
                {"email": email},
                {"email": {"$regex": f"^{escaped_input}$", "$options": "i"}},
            ]
        })
        return Response(
            {"message": "Password reset successfully."},
            status=status.HTTP_200_OK,
        )


from .change_password import ChangePasswordView  # Re-export for backwards compatibility

