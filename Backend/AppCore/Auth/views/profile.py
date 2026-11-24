import base64
import re
from datetime import datetime, timezone

from pymongo.errors import DuplicateKeyError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ...db import get_database
from ..role_permissions import is_configured_admin
from ..serializers.signup import EMPLOYEE_ID_PATTERN
from ..utils import profile_payload


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_document = get_database().users.find_one({"_id": request.user.id})
        if user_document is None:
            return Response(
                {"detail": "User account is unavailable."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            {
                **profile_payload(user_document),
                "can_edit_employee_id": is_configured_admin(request.user),
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        employee_id_key = (
            "employee_id" if "employee_id" in request.data else "employeeId"
        )
        has_employee_id = (
            "employee_id" in request.data or "employeeId" in request.data
        )
        if has_employee_id and not is_configured_admin(request.user):
            return Response(
                {"error": "Only admins can change Employee ID."},
                status=status.HTTP_403_FORBIDDEN,
            )

        profile_fields = ("jobTitle", "mobile", "location", "birthday", "bio")
        updates = {}
        employee_id_sequence = None
        if has_employee_id:
            employee_id = request.data[employee_id_key]
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
            updates["employee_id"] = employee_id
            updates["employee_id_sequence"] = employee_id_sequence

        for field in profile_fields:
            if field in request.data:
                value = request.data[field]
                if not isinstance(value, str):
                    return Response(
                        {"error": f"{field} must be a string."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                updates[f"profile.{field}"] = value.strip()

        if "name" in request.data:
            name = request.data["name"]
            if not isinstance(name, str) or not name.strip():
                return Response(
                    {"error": "Name must be a non-empty string."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updates["first_name"] = name.strip()

        if not updates:
            return Response(
                {"error": "No profile fields were provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        database = get_database()
        if employee_id_sequence is not None and database.users.find_one(
            {
                "employee_id_sequence": employee_id_sequence,
                "_id": {"$ne": request.user.id},
            }
        ):
            return Response(
                {"error": "This employee ID number is already assigned."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            database.users.update_one(
                {"_id": request.user.id},
                {"$set": {**updates, "updated_at": datetime.now(timezone.utc)}},
            )
        except DuplicateKeyError:
            return Response(
                {"error": "This employee ID number is already assigned."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user_document = database.users.find_one({"_id": request.user.id})
        if user_document is None:
            return Response(
                {"detail": "User account is unavailable."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            {
                **profile_payload(user_document),
                "can_edit_employee_id": is_configured_admin(request.user),
            },
            status=status.HTTP_200_OK,
        )


class ProfileAvatarView(APIView):
    permission_classes = [IsAuthenticated]
    max_photo_size = 5 * 1024 * 1024
    allowed_content_types = {
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
    }

    def post(self, request):
        photo = request.FILES.get("avatar") or request.FILES.get("photo")
        if photo is None:
            return Response(
                {"error": "An image file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if photo.content_type not in self.allowed_content_types:
            return Response(
                {"error": "Use a JPEG, PNG, GIF, or WebP image."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if photo.size > self.max_photo_size:
            return Response(
                {"error": "Profile photos must be 5 MB or smaller."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content = photo.read(self.max_photo_size + 1)
        if len(content) > self.max_photo_size:
            return Response(
                {"error": "Profile photos must be 5 MB or smaller."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        photo_data = (
            f"data:{photo.content_type};base64,"
            f"{base64.b64encode(content).decode('ascii')}"
        )
        get_database().users.update_one(
            {"_id": request.user.id},
            {
                "$set": {
                    "profile.photo": photo_data,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        return Response({"photo": photo_data}, status=status.HTTP_200_OK)
