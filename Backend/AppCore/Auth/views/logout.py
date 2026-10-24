import hashlib

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ...db import get_database


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token_hash = hashlib.sha256(request.auth.encode("utf-8")).hexdigest()
        get_database().tokens.delete_one({"token_hash": token_hash})
        return Response(
            {"message": "Logout successful"},
            status=status.HTTP_200_OK,
        )
