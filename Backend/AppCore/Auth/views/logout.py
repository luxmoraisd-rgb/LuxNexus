import hashlib

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ...db import get_database
from ..utils import end_session


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token_hash = hashlib.sha256(request.auth.encode("utf-8")).hexdigest()
        database = get_database()
        token_document = database.tokens.find_one({"token_hash": token_hash})
        if token_document:
            end_session(database, token_document)
            database.tokens.delete_one({"_id": token_document["_id"]})
        return Response(
            {"message": "Logout successful"},
            status=status.HTTP_200_OK,
        )
