from datetime import datetime, timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ...db import get_database
from ..utils import create_token, normalize_username, user_payload


class GoogleAuthView(APIView):
    """
    Authenticate or register a user via Google OAuth / Google Account Chooser.
    Stores and reads user documents strictly in MongoDB 'users' collection.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        name = str(request.data.get("name", "")).strip()
        provider = str(request.data.get("provider", "google")).strip()

        if not email:
            return Response(
                {"error": "Email is required.", "message": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        database = get_database()
        user_document = database.users.find_one({"email": email})

        now = datetime.now(timezone.utc)
        if user_document is None:
            # Create new user in MongoDB
            username_source = name or email.split("@")[0]
            base_username = normalize_username(username_source)
            username = base_username
            suffix = 1
            while database.users.find_one({"username": username}):
                username = f"{base_username[:140]}{suffix}"
                suffix += 1

            user_document = {
                "username": username,
                "email": email,
                "first_name": name,
                "last_name": "",
                "provider": provider,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
            user_document["_id"] = database.users.insert_one(user_document).inserted_id
        else:
            updates = {"updated_at": now}
            if name and not user_document.get("first_name"):
                updates["first_name"] = name
            if "provider" not in user_document:
                updates["provider"] = provider
            database.users.update_one({"_id": user_document["_id"]}, {"$set": updates})
            user_document = database.users.find_one({"_id": user_document["_id"]})

        client_ip = (
            request.data.get("client_ip")
            or (request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() if request.META.get("HTTP_X_FORWARDED_FOR") else None)
            or request.META.get("REMOTE_ADDR", "").strip()
            or "127.0.0.1"
        )
        user_agent = request.META.get("HTTP_USER_AGENT", "")
        token = create_token(
            user_document["_id"],
            database,
            now,
            ip=client_ip,
            user_agent=user_agent,
        )

        return Response(
            {
                "message": "Google authentication successful",
                "user": user_payload(user_document),
                "token": token,
                "ip": client_ip,
            },
            status=status.HTTP_200_OK,
        )

