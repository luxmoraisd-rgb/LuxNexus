import re
from datetime import datetime, timezone

from bson import ObjectId
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..Auth.role_permissions import RoleModulePermission
from .db import get_meetings_collection


def _format_meeting(document):
    meeting = dict(document)
    meeting["id"] = str(meeting.pop("_id", meeting.get("id", "")))
    return meeting


def _duration_minutes(value):
    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\s*", str(value or ""), re.I)
    if not match:
        return 0
    amount = float(match.group(1))
    return round(amount * (60 if match.group(2).lower().startswith(("h", "hr")) else 1))


class MeetingsView(APIView):
    permission_classes = [IsAuthenticated, RoleModulePermission]

    def get(self, request):
        meeting_type = request.query_params.get("type", "").strip().lower()
        search_query = request.query_params.get("search", "").strip().lower()
        meetings = [
            _format_meeting(document)
            for document in get_meetings_collection().find({})
        ]

        if meeting_type in {"recent", "completed"}:
            meetings = [
                meeting for meeting in meetings
                if meeting.get("type") == "recent" or meeting.get("status") == "completed"
            ]
        elif meeting_type in {"upcoming", "scheduled"}:
            meetings = [
                meeting for meeting in meetings
                if meeting.get("type") == "upcoming" or meeting.get("status") == "upcoming"
            ]

        if search_query:
            meetings = [
                meeting for meeting in meetings
                if search_query in meeting.get("title", "").lower()
                or search_query in meeting.get("agenda", "").lower()
                or any(
                    search_query in attendee.get("name", "").lower()
                    for attendee in meeting.get("attendees", [])
                )
            ]

        upcoming_count = sum(
            meeting.get("type") == "upcoming" or meeting.get("status") == "upcoming"
            for meeting in meetings
        )
        recent_meetings = [
            meeting for meeting in meetings
            if meeting.get("type") == "recent" or meeting.get("status") == "completed"
        ]
        recorded_minutes = sum(
            _duration_minutes(meeting.get("duration")) for meeting in recent_meetings
        )

        return Response(
            {
                "success": True,
                "metrics": {
                    "total": len(meetings),
                    "upcoming": upcoming_count,
                    "recent": len(recent_meetings),
                    "hours_recorded": f"{recorded_minutes / 60:g} hrs",
                },
                "meetings": meetings,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        data = request.data or {}
        title = data.get("title", "").strip()
        if not title:
            return Response(
                {"success": False, "message": "Meeting title is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        meeting_type = data.get("type", "upcoming").strip().lower()
        if meeting_type not in {"recent", "upcoming"}:
            meeting_type = "upcoming"

        new_meeting = {
            "_id": f"meet-{ObjectId()}",
            "title": title,
            "type": meeting_type,
            "status": "completed" if meeting_type == "recent" else "upcoming",
            "date": data.get("date", ""),
            "time": data.get("time", ""),
            "duration": data.get("duration", ""),
            "platform": data.get("platform", ""),
            "link": data.get("link", ""),
            "location": data.get("location", ""),
            "agenda": data.get("agenda", ""),
            "key_takeaways": data.get("key_takeaways", ""),
            "action_items": data.get("action_items", []),
            "attendees": data.get("attendees", []),
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        get_meetings_collection().insert_one(dict(new_meeting))

        return Response(
            {
                "success": True,
                "message": "Meeting scheduled successfully",
                "meeting": _format_meeting(new_meeting),
            },
            status=status.HTTP_201_CREATED,
        )


class MeetingDetailView(APIView):
    permission_classes = [IsAuthenticated, RoleModulePermission]

    def delete(self, request, meeting_id):
        identifiers = [meeting_id]
        if ObjectId.is_valid(meeting_id):
            identifiers.append(ObjectId(meeting_id))
        result = get_meetings_collection().delete_one({"_id": {"$in": identifiers}})

        return Response(
            {
                "success": True,
                "message": "Meeting removed",
                "deleted": result.deleted_count > 0,
            },
            status=status.HTTP_200_OK,
        )
