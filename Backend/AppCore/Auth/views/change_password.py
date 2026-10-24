import hashlib
import logging
import re
from datetime import datetime, timezone
from bson import ObjectId

from django.contrib.auth.hashers import check_password, make_password
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ...api_utils import validation_error
from ...db import get_database
from ..serializers.change_password import ChangePasswordSerializer
from ..utils import create_token, is_valid_otp

logger = logging.getLogger(__name__)


class ChangePasswordView(APIView):
    """
    Dedicated view for changing account password.
    Directly updates and stores the hashed password in MongoDB (Compass database 'nexusapp' -> 'users' collection).
    Supports:
      1. Authenticated user changing password via current_password.
      2. User with verified OTP changing password (forgot-password reset flow).
      3. Direct user identification via Bearer token, session user, email, or username.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return validation_error(serializer)

        data = serializer.validated_data
        current_password = data.get("current_password") or data.get("old_password") or request.data.get("current_password") or request.data.get("old_password")
        new_password = data.get("new_password") or request.data.get("new_password")
        confirm_password = data.get("confirm_password") or request.data.get("confirm_password")
        otp = (data.get("otp") or request.data.get("otp") or "").strip()
        email = (data.get("email") or request.data.get("email") or "").strip().lower()
        username = (data.get("username") or request.data.get("username") or "").strip()
        user_id_param = request.data.get("user_id") or request.data.get("userId")

        database = get_database()
        user = None

        # 1. Try to find user from authenticated request.user
        if getattr(request, "user", None) and getattr(request.user, "is_authenticated", False):
            req_user_id = getattr(request.user, "id", None)
            if req_user_id:
                try:
                    obj_id = ObjectId(req_user_id) if ObjectId.is_valid(str(req_user_id)) else req_user_id
                    user = database.users.find_one({"_id": obj_id})
                except Exception as ex:
                    logger.debug("Lookup by request.user.id failed: %s", ex)

            if user is None and getattr(request.user, "email", None):
                user = database.users.find_one({"email": str(request.user.email).lower()})
            if user is None and getattr(request.user, "username", None):
                user = database.users.find_one({"username": str(request.user.username)})

        # 2. Try to find user from Bearer token in request header if not resolved yet
        if user is None and request.auth and isinstance(request.auth, str):
            token_hash = hashlib.sha256(request.auth.encode("utf-8")).hexdigest()
            now = datetime.now(timezone.utc)
            token_doc = database.tokens.find_one({"token_hash": token_hash, "expires_at": {"$gt": now}})
            if token_doc and token_doc.get("user_id"):
                tok_uid = token_doc["user_id"]
                try:
                    obj_id = ObjectId(tok_uid) if ObjectId.is_valid(str(tok_uid)) else tok_uid
                    user = database.users.find_one({"_id": obj_id})
                except Exception:
                    pass

        # 3. Try to find user from explicit user_id_param, email, or username
        if user is None and user_id_param:
            try:
                obj_id = ObjectId(user_id_param) if ObjectId.is_valid(str(user_id_param)) else user_id_param
                user = database.users.find_one({"_id": obj_id})
            except Exception:
                pass

        if user is None and email:
            escaped_email = re.escape(email)
            user = database.users.find_one({
                "$or": [
                    {"email": {"$regex": f"^{escaped_email}$", "$options": "i"}},
                    {"username": {"$regex": f"^{escaped_email}$", "$options": "i"}},
                ]
            })

        if user is None and username:
            escaped_username = re.escape(username)
            user = database.users.find_one({
                "$or": [
                    {"username": {"$regex": f"^{escaped_username}$", "$options": "i"}},
                    {"email": {"$regex": f"^{escaped_username}$", "$options": "i"}},
                ]
            })

        # 4. Fallback search in auth_user collection if present
        auth_doc = None
        if user is None and (email or username):
            ident = email or username
            escaped_ident = re.escape(ident)
            auth_doc = database.auth_user.find_one({
                "$or": [
                    {"email": {"$regex": f"^{escaped_ident}$", "$options": "i"}},
                    {"username": {"$regex": f"^{escaped_ident}$", "$options": "i"}},
                ]
            })

        if user is None and auth_doc is None:
            return Response(
                {
                    "error": "User account was not found in the database.",
                    "message": "User account was not found in the database. Please verify your account.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Primary user document target
        target_doc = user or auth_doc
        target_email = target_doc.get("email") or email

        # Password matching & length validations
        if not new_password or len(new_password) < 8:
            return Response(
                {
                    "error": "New password must be at least 8 characters long.",
                    "message": "New password must be at least 8 characters long.",
                    "new_password": ["Use at least 8 characters."],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_password:
            return Response(
                {
                    "error": "New password and confirmation do not match.",
                    "message": "New password and confirmation do not match.",
                    "confirm_password": ["The new passwords do not match."],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verification: OTP or Current Password
        if otp:
            if not is_valid_otp(target_email, otp):
                return Response(
                    {
                        "error": "Invalid or expired reset code.",
                        "message": "Invalid or expired reset code. Please generate a new code.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            if not current_password or not isinstance(current_password, str):
                return Response(
                    {
                        "error": "Current password is required to change your password.",
                        "message": "Current password is required to change your password.",
                        "current_password": ["Current password is required."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            stored_hash = target_doc.get("password_hash") or target_doc.get("password") or ""
            if not stored_hash or not check_password(current_password, stored_hash):
                return Response(
                    {
                        "error": "The current password is incorrect.",
                        "message": "The current password is incorrect. Please try again.",
                        "current_password": ["The current password is incorrect."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if current_password == new_password:
                return Response(
                    {
                        "error": "New password cannot be the same as the current password.",
                        "message": "New password cannot be the same as your current password.",
                        "new_password": ["New password must be different from current password."],
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Hash new password using Django make_password (pbkdf2_sha256)
        new_hash = make_password(new_password)
        now = datetime.now(timezone.utc)

        # Update in MongoDB 'users' collection (viewable in MongoDB Compass)
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

        # If user also exists in auth_user, sync it
        if auth_doc or user:
            database.auth_user.update_one(
                {
                    "$or": [
                        {"_id": target_doc["_id"]},
                        {"email": target_email},
                        {"username": target_doc.get("username")},
                    ]
                },
                {"$set": {"password": new_hash}},
            )

        # Sync with Django ORM model if present
        try:
            from django.contrib.auth import get_user_model
            UserModel = get_user_model()
            orm_user = (
                UserModel.objects.filter(email__iexact=target_email).first()
                or UserModel.objects.filter(username__iexact=target_doc.get("username", "")).first()
            )
            if orm_user:
                orm_user.set_password(new_password)
                orm_user.save()
        except Exception as sync_err:
            logger.debug("Django ORM sync skipped: %s", sync_err)

        # Clean up used OTP if one was provided
        if otp:
            database.password_reset_otps.delete_many({
                "$or": [
                    {"email": target_email.lower()},
                    {"email": email.lower()},
                ]
            })

        # Token handling: keep current token alive, invalidate older sessions, or create a fresh token
        active_token = request.auth if isinstance(request.auth, str) else None
        target_uid = str(target_doc["_id"])

        if active_token:
            curr_hash = hashlib.sha256(active_token.encode("utf-8")).hexdigest()
            database.tokens.delete_many({
                "user_id": target_uid,
                "token_hash": {"$ne": curr_hash},
            })
        else:
            active_token = create_token(target_doc["_id"], database, now)

        return Response(
            {
                "success": True,
                "message": "Password changed successfully and stored in MongoDB.",
                "token": active_token,
                "user": {
                    "id": target_uid,
                    "username": target_doc.get("username", ""),
                    "email": target_email,
                },
            },
            status=status.HTTP_200_OK,
        )
