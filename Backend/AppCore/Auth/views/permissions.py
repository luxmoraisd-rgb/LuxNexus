from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..role_permissions import (
    DEFAULT_ROLE_POLICIES,
    get_effective_role,
    is_configured_admin,
    PERMISSION_DEFINITIONS,
    ROLE_LABELS,
)


class RolePermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        policies = {
            role: permissions.copy()
            for role, permissions in DEFAULT_ROLE_POLICIES.items()
        }
        return Response(
            {
                "current_role": get_effective_role(request.user),
                "roles": ROLE_LABELS,
                "permissions": PERMISSION_DEFINITIONS,
                "policies": policies,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        if not is_configured_admin(request.user):
            return Response(
                {"detail": "Only an Admin can update role permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(
            {"detail": "Role access is fixed by the workspace policy."},
            status=status.HTTP_403_FORBIDDEN,
        )
