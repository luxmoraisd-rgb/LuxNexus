import re
from datetime import datetime, timezone
from bson import ObjectId
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .db import get_meetings_collection


DEFAULT_MEETINGS = [
    # Upcoming Meetings
    {
        "_id": "meet-up-1",
        "title": "Sprint 24 Planning & Story Point Estimation",
        "type": "upcoming",
        "status": "upcoming",
        "date": "Today, Oct 23, 2026",
        "time": "3:30 PM - 4:30 PM",
        "duration": "60 mins",
        "platform": "Google Meet",
        "link": "https://meet.google.com/nex-sprint-plan",
        "agenda": "Prioritize sprint backlog items, estimate story points, assign engineering leads, and set sprint velocity targets.",
        "key_takeaways": "Pending meeting execution.",
        "action_items": [
            "Confirm frontend component dependencies",
            "Finalize API contract for user notifications",
            "Lock sprint commitment by 5:00 PM",
        ],
        "attendees": [
            {"name": "Jagadeep", "role": "VP of Engineering", "initials": "JA", "color": "#6366f1"},
            {"name": "Alex Rivera", "role": "Lead Frontend Engineer", "initials": "AR", "color": "#3b82f6"},
            {"name": "Sarah Chen", "role": "Security Director", "initials": "SC", "color": "#10b981"},
            {"name": "Elena Rostova", "role": "Principal Product Designer", "initials": "ER", "color": "#ec4899"},
        ],
        "created_at": "2026-10-22T08:00:00Z",
        "updated_at": "2026-10-23T10:00:00Z",
    },
    {
        "_id": "meet-up-2",
        "title": "Executive Product Roadmap & Q4 Alignment",
        "type": "upcoming",
        "status": "upcoming",
        "date": "Tomorrow, Oct 24, 2026",
        "time": "10:00 AM - 11:00 AM",
        "duration": "60 mins",
        "platform": "Zoom",
        "link": "https://zoom.us/j/nexus-product-sync",
        "agenda": "Review customer feedback on beta releases, evaluate feature adoption metrics, and align engineering capacity for Q4 deliverables.",
        "key_takeaways": "Strategic review scheduled with leadership.",
        "action_items": [
            "Prepare Q3 metric deck with user retention graph",
            "Review customer satisfaction scores",
            "Circulate roadmap slides prior to call",
        ],
        "attendees": [
            {"name": "Jagadeep", "role": "VP of Engineering", "initials": "JA", "color": "#6366f1"},
            {"name": "Marcus Vance", "role": "VP of Product", "initials": "MV", "color": "#8b5cf6"},
            {"name": "Sarah Chen", "role": "Security Director", "initials": "SC", "color": "#10b981"},
        ],
        "created_at": "2026-10-21T14:00:00Z",
        "updated_at": "2026-10-22T09:30:00Z",
    },
    {
        "_id": "meet-up-3",
        "title": "Security Governance & SOC-2 Audit Preparation",
        "type": "upcoming",
        "status": "upcoming",
        "date": "Mon, Oct 26, 2026",
        "time": "1:00 PM - 2:00 PM",
        "duration": "60 mins",
        "platform": "Microsoft Teams",
        "link": "https://teams.microsoft.com/l/meetup-join/nexus-audit",
        "agenda": "Audit log retention verification, access control policy review, and automated vulnerability scan validation.",
        "key_takeaways": "Pre-audit readiness validation.",
        "action_items": [
            "Export session history audit log sample",
            "Validate encryption at rest configurations",
        ],
        "attendees": [
            {"name": "Sarah Chen", "role": "Security Director", "initials": "SC", "color": "#10b981"},
            {"name": "David Kim", "role": "DevOps Architect", "initials": "DK", "color": "#f59e0b"},
            {"name": "Jagadeep", "role": "VP of Engineering", "initials": "JA", "color": "#6366f1"},
        ],
        "created_at": "2026-10-22T16:00:00Z",
        "updated_at": "2026-10-23T08:00:00Z",
    },

    # Recent Meetings
    {
        "_id": "meet-rec-1",
        "title": "Sprint 23 Retrospective & Continuous Improvement",
        "type": "recent",
        "status": "completed",
        "date": "Oct 22, 2026",
        "time": "11:00 AM - 12:00 PM",
        "duration": "60 mins",
        "platform": "Google Meet",
        "link": "https://meet.google.com/nex-sprint-retro",
        "agenda": "Review Sprint 23 completion rate, discuss engineering friction points, and identify process adjustments.",
        "key_takeaways": "Automated deployment pipeline reduced release verification time by 42%. Frontend component tests passed 100% of pre-commit hooks.",
        "action_items": [
            "Improve Cypress end-to-end test flakiness in CI",
            "Document newly introduced API endpoints in Postman collection",
        ],
        "attendees": [
            {"name": "Jagadeep", "role": "VP of Engineering", "initials": "JA", "color": "#6366f1"},
            {"name": "Alex Rivera", "role": "Lead Frontend Engineer", "initials": "AR", "color": "#3b82f6"},
            {"name": "Sarah Chen", "role": "Security Director", "initials": "SC", "color": "#10b981"},
            {"name": "Elena Rostova", "role": "Principal Product Designer", "initials": "ER", "color": "#ec4899"},
        ],
        "created_at": "2026-10-20T10:00:00Z",
        "updated_at": "2026-10-22T12:05:00Z",
    },
    {
        "_id": "meet-rec-2",
        "title": "Architecture Review: Event-Driven Pipeline",
        "type": "recent",
        "status": "completed",
        "date": "Oct 21, 2026",
        "time": "2:30 PM - 3:30 PM",
        "duration": "60 mins",
        "platform": "Zoom",
        "link": "https://zoom.us/j/nexus-event-arch",
        "agenda": "Evaluate message broker options (Kafka vs Redis Streams) for live notification delivery and task events.",
        "key_takeaways": "Agreed to adopt Redis Streams for lightweight in-app messaging and Kafka partitioned topics for persistent analytics.",
        "action_items": [
            "Deploy staging Redis cluster with persistence enabled",
            "Write load testing benchmark script for 10k concurrent clients",
        ],
        "attendees": [
            {"name": "Jagadeep", "role": "VP of Engineering", "initials": "JA", "color": "#6366f1"},
            {"name": "David Kim", "role": "DevOps Architect", "initials": "DK", "color": "#f59e0b"},
            {"name": "Priya Patel", "role": "Backend Engineer", "initials": "PP", "color": "#14b8a6"},
        ],
        "created_at": "2026-10-19T09:00:00Z",
        "updated_at": "2026-10-21T15:35:00Z",
    },
    {
        "_id": "meet-rec-3",
        "title": "Nexus Design System 2.0 Token Sync",
        "type": "recent",
        "status": "completed",
        "date": "Oct 20, 2026",
        "time": "10:00 AM - 10:45 AM",
        "duration": "45 mins",
        "platform": "Google Meet",
        "link": "https://meet.google.com/nex-design-sync",
        "agenda": "Audit dark and light theme tokens, verify contrast compliance, and review new button and chip components.",
        "key_takeaways": "Approved HSL color scales and WCAG AAA compliance tokens for inputs, badges, and progress meters across both themes.",
        "action_items": [
            "Update Figma token library to match CSS variables",
            "Release component showcase in documentation site",
        ],
        "attendees": [
            {"name": "Elena Rostova", "role": "Principal Product Designer", "initials": "ER", "color": "#ec4899"},
            {"name": "Marcus Vance", "role": "VP of Product", "initials": "MV", "color": "#8b5cf6"},
            {"name": "Jagadeep", "role": "VP of Engineering", "initials": "JA", "color": "#6366f1"},
        ],
        "created_at": "2026-10-18T11:00:00Z",
        "updated_at": "2026-10-20T10:50:00Z",
    },
]

_IN_MEMORY_MEETINGS = None


def _get_in_memory_meetings():
    global _IN_MEMORY_MEETINGS
    if _IN_MEMORY_MEETINGS is None:
        _IN_MEMORY_MEETINGS = [dict(m) for m in DEFAULT_MEETINGS]
    return _IN_MEMORY_MEETINGS


def _format_meeting(doc):
    item = dict(doc)
    item["id"] = str(item.pop("_id", item.get("id", "")))
    return item


class MeetingsView(APIView):
    """
    GET  /api/meetings/ -> list all meetings, supports ?type=recent|upcoming & ?search=...
    POST /api/meetings/ -> create/schedule a new meeting
    """
    permission_classes = [AllowAny]

    def get(self, request):
        meeting_type = request.query_params.get("type", "").strip().lower()
        search_query = request.query_params.get("search", "").strip().lower()

        try:
            coll = get_meetings_collection()
            if coll.count_documents({}) == 0:
                coll.insert_many([dict(m) for m in DEFAULT_MEETINGS])
            raw_meetings = list(coll.find({}))
            meetings = [_format_meeting(m) for m in raw_meetings]
        except Exception:
            meetings = [_format_meeting(m) for m in _get_in_memory_meetings()]

        # Filter by type
        if meeting_type in ["recent", "completed"]:
            meetings = [m for m in meetings if m.get("type") == "recent" or m.get("status") == "completed"]
        elif meeting_type in ["upcoming", "scheduled"]:
            meetings = [m for m in meetings if m.get("type") == "upcoming" or m.get("status") == "upcoming"]

        # Search filter
        if search_query:
            meetings = [
                m for m in meetings
                if search_query in m.get("title", "").lower()
                or search_query in m.get("agenda", "").lower()
                or any(search_query in att.get("name", "").lower() for att in m.get("attendees", []))
            ]

        # Calculate metrics
        total = len(meetings)
        upcoming_count = sum(1 for m in meetings if m.get("type") == "upcoming" or m.get("status") == "upcoming")
        recent_count = sum(1 for m in meetings if m.get("type") == "recent" or m.get("status") == "completed")

        return Response(
            {
                "success": True,
                "metrics": {
                    "total": total,
                    "upcoming": upcoming_count,
                    "recent": recent_count,
                    "hours_recorded": "18.5 hrs",
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
        if meeting_type not in ["recent", "upcoming"]:
            meeting_type = "upcoming"

        meeting_id = f"meet-{ObjectId()}"
        new_meeting = {
            "_id": meeting_id,
            "title": title,
            "type": meeting_type,
            "status": "completed" if meeting_type == "recent" else "upcoming",
            "date": data.get("date", "Today"),
            "time": data.get("time", "12:00 PM - 1:00 PM"),
            "duration": data.get("duration", "60 mins"),
            "platform": data.get("platform", "Google Meet"),
            "link": data.get("link", "https://meet.google.com/nex-sync"),
            "agenda": data.get("agenda", ""),
            "key_takeaways": data.get("key_takeaways", ""),
            "action_items": data.get("action_items", []),
            "attendees": data.get("attendees", [
                {"name": "Jagadeep", "role": "Host", "initials": "JA", "color": "#6366f1"}
            ]),
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        try:
            coll = get_meetings_collection()
            coll.insert_one(dict(new_meeting))
        except Exception:
            _get_in_memory_meetings().insert(0, dict(new_meeting))

        return Response(
            {
                "success": True,
                "message": "Meeting scheduled successfully",
                "meeting": _format_meeting(new_meeting),
            },
            status=status.HTTP_201_CREATED,
        )


class MeetingDetailView(APIView):
    """
    DELETE /api/meetings/<id>/
    """
    permission_classes = [AllowAny]

    def delete(self, request, meeting_id):
        try:
            coll = get_meetings_collection()
            res = coll.delete_one({"$or": [{"_id": meeting_id}, {"_id": ObjectId(meeting_id) if ObjectId.is_valid(meeting_id) else meeting_id}]})
            deleted = res.deleted_count > 0
        except Exception:
            mem = _get_in_memory_meetings()
            initial_len = len(mem)
            _IN_MEMORY_MEETINGS[:] = [m for m in mem if str(m.get("_id")) != str(meeting_id)]
            deleted = len(_IN_MEMORY_MEETINGS) < initial_len

        return Response(
            {"success": True, "message": "Meeting removed", "deleted": deleted},
            status=status.HTTP_200_OK,
        )
