from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return Response(
            {
                "error": (
                    "Google authentication is not configured. "
                    "Configure a verified Google OAuth flow before enabling sign-in."
                )
            },
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )
