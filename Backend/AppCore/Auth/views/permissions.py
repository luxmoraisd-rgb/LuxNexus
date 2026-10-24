from datetime import datetime, timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ...db import get_database
from ..role_permissions import (
    DEFAULT_ROLE_POLICIES,
    PERMISSION_DEFINITIONS,
    PERMISSION_KEYS,
    ROLE_LABELS,
    ROLE_POLICY_ID,
)


class RolePermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        document = get_database().settings.find_one({"_id": ROLE_POLICY_ID})
        policies = (
            document["policies"]
            if document is not None
            else {role: value.copy() for role, value in DEFAULT_ROLE_POLICIES.items()}
        )
        policies = {role: value.copy() for role, value in policies.items()}
        policies["admin"] = DEFAULT_ROLE_POLICIES["admin"].copy()
        return Response(
            {
                "current_role": request.user.role,
                "roles": ROLE_LABELS,
                "permissions": PERMISSION_DEFINITIONS,
                "policies": policies,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        if request.user.role != "admin":
            return Response(
                {"detail": "Only an Admin can update role permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        policies = request.data.get("policies")
        if not isinstance(policies, dict) or set(policies) != set(ROLE_LABELS):
            return Response(
                {"policies": "Provide permission settings for Admin, Team Lead, and User."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        validated = {}
        for role in ROLE_LABELS:
            role_policy = policies[role]
            if (
                not isinstance(role_policy, dict)
                or set(role_policy) != set(PERMISSION_KEYS)
                or any(type(value) is not bool for value in role_policy.values())
            ):
                return Response(
                    {"policies": f"Provide a boolean value for every permission in {ROLE_LABELS[role]}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            validated[role] = (
                DEFAULT_ROLE_POLICIES["admin"].copy()
                if role == "admin"
                else role_policy.copy()
            )

        database = get_database()
        database.settings.update_one(
            {"_id": ROLE_POLICY_ID},
            {
                "$set": {
                    "policies": validated,
                    "updated_at": datetime.now(timezone.utc),
                    "updated_by": request.user.id,
                }
            },
            upsert=True,
        )
        return Response(
            {
                "current_role": request.user.role,
                "roles": ROLE_LABELS,
                "permissions": PERMISSION_DEFINITIONS,
                "policies": validated,
            },
            status=status.HTTP_200_OK,
        )
