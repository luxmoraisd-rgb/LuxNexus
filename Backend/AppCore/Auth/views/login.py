import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from django.contrib.auth.hashers import check_password
from pymongo import ReturnDocument
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ...api_utils import validation_error
from ...db import get_database
from ...models import MongoUser
from ..serializers import LoginSerializer
from ..utils import create_token, get_client_ip, user_payload

MAX_LOGIN_FAILURES = 5
LOGIN_LOCKOUT_DURATION = timedelta(minutes=5)
LOGIN_ATTEMPT_WINDOW = timedelta(minutes=15)


def _login_identifier_key(identifier):
    normalized_identifier = identifier.strip().lower()
    return hashlib.sha256(normalized_identifier.encode("utf-8")).hexdigest()


def _blocked_response():
    message = "Your id is blocked. Try again after 5 minutes."
    response = Response(
        {
            "error": message,
            "message": message,
            "retry_after_seconds": int(LOGIN_LOCKOUT_DURATION.total_seconds()),
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )
    response["Retry-After"] = str(int(LOGIN_LOCKOUT_DURATION.total_seconds()))
    return response


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return validation_error(serializer)

        values = serializer.validated_data
        identifier = (values.get("email") or "").strip() or (
            values.get("username") or ""
        ).strip()
        query_field = "email" if "@" in identifier else "username"
        database = get_database()
        now = datetime.now(timezone.utc)
        attempts_collection = database.login_attempts

        def record_failed_attempt():
            next_blocked_until = now + LOGIN_LOCKOUT_DURATION
            window_cutoff = now - LOGIN_ATTEMPT_WINDOW
            attempts_in_window = {
                "$cond": [
                    {
                        "$gt": [
                            {"$ifNull": ["$window_started_at", now]},
                            window_cutoff,
                        ]
                    },
                    {"$ifNull": ["$attempts", 0]},
                    0,
                ]
            }
            attempt = attempts_collection.find_one_and_update(
                {"_id": attempt_key},
                [
                    {
                        "$set": {
                            "attempts": {"$add": [attempts_in_window, 1]},
                            "created_at": {"$ifNull": ["$created_at", now]},
                            "window_started_at": {
                                "$cond": [
                                    {
                                        "$gt": [
                                            {"$ifNull": ["$window_started_at", now]},
                                            window_cutoff,
                                        ]
                                    },
                                    {"$ifNull": ["$window_started_at", now]},
                                    now,
                                ]
                            },
                            "last_attempt_at": now,
                            "updated_at": now,
                            "blocked_until": {
                                "$cond": [
                                    {
                                        "$gt": [
                                            {"$add": [attempts_in_window, 1]},
                                            MAX_LOGIN_FAILURES,
                                        ]
                                    },
                                    {"$ifNull": ["$blocked_until", next_blocked_until]},
                                    "$blocked_until",
                                ]
                            },
                        }
                    }
                ],
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
            blocked_until = attempt.get("blocked_until")
            return bool(blocked_until and blocked_until > now)

        user_document = database.users.find_one({query_field: identifier.lower()})
        if user_document is None:
            alternative = "username" if query_field == "email" else "email"
            user_document = database.users.find_one(
                {alternative: identifier.lower()}
            )

        attempt_identity = (
            f"user:{user_document['_id']}"
            if user_document
            else f"identifier:{identifier}"
        )
        attempt_key = _login_identifier_key(attempt_identity)
        existing_attempt = attempts_collection.find_one({"_id": attempt_key})
        blocked_until = existing_attempt.get("blocked_until") if existing_attempt else None
        if isinstance(blocked_until, datetime):
            if blocked_until.tzinfo is None:
                blocked_until = blocked_until.replace(tzinfo=timezone.utc)
            if blocked_until > now:
                return _blocked_response()
            attempts_collection.delete_one({"_id": attempt_key})

        if user_document is None:
            if record_failed_attempt():
                return _blocked_response()
            message = (
                "This account is not registered in our database. "
                "Please check your credentials or sign up."
            )
            return Response(
                {"error": message, "message": message, "errors": {"email": [message]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not check_password(values["password"], user_document["password_hash"]):
            if record_failed_attempt():
                return _blocked_response()
            message = "Incorrect password. Please try again or reset your password."
            return Response(
                {
                    "error": message,
                    "message": message,
                    "errors": {"password": [message]},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user_document.get("is_active", True):
            message = "This user account is disabled."
            return Response(
                {
                    "error": message,
                    "message": message,
                    "errors": {"username": [message]},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        attempts_collection.delete_one({"_id": attempt_key})
        user = MongoUser.from_document(user_document)
        client_ip = get_client_ip(request)
        user_agent = request.META.get("HTTP_USER_AGENT", "")
        token = create_token(
            user.id,
            database,
            ip=client_ip,
            user_agent=user_agent,
        )
        return Response(
            {
                "message": "Login successful",
                "user": user_payload(user),
                "token": token,
                "ip": client_ip,
            },
            status=status.HTTP_200_OK,
        )
