import secrets

from django.contrib.auth.hashers import check_password
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ...api_utils import validation_error
from ...db import get_database
from ...models import MongoUser
from ..serializers import LoginSerializer
from ..utils import create_token, user_payload


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
        user_document = database.users.find_one({query_field: identifier.lower()})
        if user_document is None:
            alternative = "username" if query_field == "email" else "email"
            user_document = database.users.find_one(
                {alternative: identifier.lower()}
            )
        if user_document is None:
            message = (
                "This account is not registered in our database. "
                "Please check your credentials or sign up."
            )
            return Response(
                {"error": message, "message": message, "errors": {"email": [message]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not check_password(values["password"], user_document["password_hash"]):
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

        user = MongoUser.from_document(user_document)
        client_ip = (
            request.data.get("client_ip")
            or (request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() if request.META.get("HTTP_X_FORWARDED_FOR") else None)
            or request.META.get("REMOTE_ADDR", "").strip()
            or "127.0.0.1"
        )
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

