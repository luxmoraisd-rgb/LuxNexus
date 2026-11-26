from django.http import JsonResponse
from pymongo.errors import PyMongoError
from rest_framework import status

from ..db import ping_database


def health_check(_request):
    try:
        ping_database()
    except PyMongoError:
        return JsonResponse(
            {"status": "error", "message": "MongoDB is unavailable"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return JsonResponse(
        {"status": "ok", "message": "NexusApp backend is running"}
    )
