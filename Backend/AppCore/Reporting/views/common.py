from bson import ObjectId
from rest_framework import status
from rest_framework.response import Response

STAGES = ["Planning", "In Progress", "Review", "On Hold", "Complete"]
PRIORITIES = ["Low", "Medium", "High", "Critical"]


def get_logged_in_user_id(request):
    """Return a stable string representation of the logged-in Django user ID."""
    if hasattr(request, "user") and request.user and getattr(request.user, "is_authenticated", False):
        return str(getattr(request.user, "id", getattr(request.user, "pk", "guest")))
    return "guest"


def convert_dashboard(document):
    title = document.get("title", document.get("name", ""))
    return {
        "id": str(document["_id"]),
        "name": title,
        "title": title,
        "description": document.get("description", ""),
        "type": document.get("type", "purple"),
        "starred": bool(document.get("starred", False)),
        "icon": document.get("icon", "chart"),
        "created_at": document.get("created_at"),
        "updated_at": document.get("updated_at"),
    }


def get_object_id(value):
    if not ObjectId.is_valid(value):
        return None
    return ObjectId(value)


def database_unavailable(message):
    return Response({"error": message}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
