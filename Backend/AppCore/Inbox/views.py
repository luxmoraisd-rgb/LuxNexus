from datetime import datetime, timezone, timedelta
import re

from bson import ObjectId
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from AppCore.db import get_database


DEFAULT_SETTINGS = {
    "mentions": True,
    "comments": True,
    "direct-messages": True,
    "tasks": False,
    "project-updates": True,
    "due-dates": True,
    "reminders": True,
    "security": True,
    "weekly-summary": False,
}


def _user_filter(request):
    uid_str = str(request.user.id)
    candidates = [uid_str]
    if ObjectId.is_valid(uid_str):
        candidates.append(ObjectId(uid_str))
    user_email = getattr(request.user, "email", None)
    if user_email:
        candidates.append(user_email)
    candidates.append("all")
    return {"user_id": {"$in": candidates}}


def _notification_filter(request, notification_id):
    str_id = str(notification_id)
    id_condition = [str_id]
    if ObjectId.is_valid(str_id):
        id_condition.append(ObjectId(str_id))
    return {**_user_filter(request), "_id": {"$in": id_condition}}


def _serialize_notification(document):
    value = dict(document)
    value["id"] = str(value.pop("_id"))
    created_at = value.get("created_at")
    if isinstance(created_at, datetime):
        value["created_at"] = created_at.isoformat()
        if not value.get("time"):
            value["time"] = created_at.strftime("%I:%M %p")
        if not value.get("date"):
            value["date"] = created_at.strftime("%b %d, %Y")
    deleted_at = value.get("deleted_at")
    if isinstance(deleted_at, datetime):
        value["deleted_at"] = deleted_at.isoformat()
    if isinstance(value.get("user_id"), ObjectId):
        value["user_id"] = str(value["user_id"])
    return value


def seed_initial_notifications_for_user(user_id, username="Alex", email=""):
    now = datetime.now(timezone.utc)
    user_key = str(user_id)

    defaults = [
        {
            "user_id": user_key,
            "title": "Sprint 4 Backlog Grooming & Task Estimates",
            "snippet": "Estimate story points for LUXNEX-20 API Integration before tomorrow's team sync.",
            "description": "Please review the active backlog stories assigned for Sprint 4. Ensure story point estimates, dependencies, and acceptance criteria are updated before tomorrow's team sync.",
            "author": "Alex Rivera",
            "author_email": "alex.rivera@nexusapp.io",
            "avatar": "AR",
            "avatarColor": "#8b5cf6",
            "type": "task",
            "unread": True,
            "starred": True,
            "archived": False,
            "deleted": False,
            "mentioned": False,
            "section": "Today",
            "tags": ["Sprint", "Backlog", "Frontend"],
            "time": "10:30 AM",
            "date": now.strftime("%b %d, %Y"),
            "tasks": [
                {
                    "id": "t1",
                    "title": "Estimate story points for LUXNEX-20 API Integration",
                    "date": "Today, 5:00 PM",
                    "color": "purple",
                    "completed": False,
                },
                {
                    "id": "t2",
                    "title": "Verify MongoDB 27017 connection with Django backend",
                    "date": "Today, 6:00 PM",
                    "color": "green",
                    "completed": True,
                },
                {
                    "id": "t3",
                    "title": "Submit PR for review and team approval",
                    "date": "Tomorrow, 11:00 AM",
                    "color": "blue",
                    "completed": False,
                },
            ],
            "replies": [
                {
                    "id": str(ObjectId()),
                    "author": "Alex Rivera",
                    "text": "Hey, let me know if you need any clarification on the sprint backlog items!",
                    "time": "10:35 AM",
                    "date": now.strftime("%b %d, %Y"),
                    "created_at": now.isoformat(),
                }
            ],
            "created_at": now,
        },
        {
            "user_id": user_key,
            "title": "Mentioned in #api-architecture channel",
            "snippet": f"@{username} can you check the MongoDB connection pooling on mongodb://localhost:27017/?",
            "description": f"@{username} the staging environment has been linked to the local MongoDB instance on mongodb://localhost:27017/. All collections (users, notifications, sprints, tasks) are verified.",
            "author": "DevOps Lead",
            "author_email": "devops@nexusapp.io",
            "avatar": "DL",
            "avatarColor": "#10b981",
            "type": "mention",
            "unread": True,
            "starred": False,
            "archived": False,
            "deleted": False,
            "mentioned": True,
            "section": "Today",
            "tags": ["Mention", "DevOps", "Database"],
            "time": "09:15 AM",
            "date": now.strftime("%b %d, %Y"),
            "tasks": [],
            "replies": [],
            "created_at": now,
        },
        {
            "user_id": user_key,
            "title": "Connected Workspace Integrations Live",
            "snippet": "Sync commits, pull requests, and real-time alerts straight into your project board.",
            "description": "Your Nexus Workspace is fully configured with real-time database synchronization on mongodb://localhost:27017/. All inbox actions, star flags, archive status, and replies persist instantly to the database.",
            "author": "Hynux",
            "author_email": "notifications@hynux.io",
            "avatar": "HN",
            "avatarColor": "#6366f1",
            "type": "message",
            "unread": False,
            "starred": False,
            "archived": False,
            "deleted": False,
            "mentioned": False,
            "section": "Yesterday",
            "tags": ["System", "Integrations"],
            "time": "Yesterday",
            "date": "Yesterday",
            "tasks": [],
            "replies": [
                {
                    "id": str(ObjectId()),
                    "author": "Hynux Bot",
                    "text": "Try submitting a reply in this thread to test database persistence!",
                    "time": "04:20 PM",
                    "date": "Yesterday",
                    "created_at": now.isoformat(),
                }
            ],
            "created_at": now,
        },
        {
            "user_id": user_key,
            "title": "Sprint 3 Completion Report & Velocity Stats",
            "snippet": "Sprint 3 closed with 94% story point delivery. Archived for record keeping.",
            "description": "Congratulations to the team! Sprint 3 concluded with 47 of 50 planned story points delivered. Quality metrics: 0 critical regressions, full test coverage on auth and data layers.",
            "author": "Scrum Master",
            "author_email": "scrum@nexusapp.io",
            "avatar": "SM",
            "avatarColor": "#ec4899",
            "type": "message",
            "unread": False,
            "starred": False,
            "archived": True,
            "deleted": False,
            "mentioned": False,
            "section": "Earlier this month",
            "tags": ["Report", "Sprint 3"],
            "time": "Oct 10",
            "date": "Oct 10, 2026",
            "tasks": [],
            "replies": [],
            "created_at": now,
        },
    ]

    collection = get_database().notifications
    collection.insert_many(defaults)


class InboxView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        collection = get_database().notifications
        user_query = _user_filter(request)

        # Check if the user has any notifications; if 0, auto-seed default notifications once
        has_any = collection.count_documents(user_query)
        if has_any == 0:
            seed_initial_notifications_for_user(
                user_id=request.user.id,
                username=getattr(request.user, "username", "Team Member"),
                email=getattr(request.user, "email", ""),
            )

        # Automatically purge trash messages older than 30 days
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        collection.delete_many({
            **_user_filter(request),
            "deleted": True,
            "$or": [
                {"deleted_at": {"$lt": thirty_days_ago}},
                {"deleted_at": {"$exists": False}, "created_at": {"$lt": thirty_days_ago}},
            ],
        })

        query = _user_filter(request)
        folder = request.query_params.get("folder")
        include_deleted = request.query_params.get("include_deleted") == "true"

        if folder == "trash":
            query["deleted"] = True
        elif folder == "archive":
            query["archived"] = True
            query["deleted"] = {"$ne": True}
        elif folder:
            query["archived"] = {"$ne": True}
            query["deleted"] = {"$ne": True}
            if folder == "unread":
                query["unread"] = True
            elif folder == "starred":
                query["starred"] = True
            elif folder == "mentions":
                query["mentioned"] = True
            elif folder == "tasks":
                query["type"] = "task"
        elif not include_deleted:
            query["deleted"] = {"$ne": True}

        if request.query_params.get("type"):
            query["type"] = request.query_params["type"]
        if request.query_params.get("search"):
            search = re.escape(request.query_params["search"].strip())
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"author": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
                {"snippet": {"$regex": search, "$options": "i"}},
            ]
        notifications = collection.find(query).sort("created_at", -1)
        return Response([_serialize_notification(item) for item in notifications])

    def post(self, request):
        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"error": "Invalid payload format."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        title = str(data.get("title", "")).strip()
        if not title:
            return Response(
                {"title": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = datetime.now(timezone.utc)
        doc = {
            "user_id": str(request.user.id),
            "title": title,
            "snippet": data.get("snippet") or str(data.get("description", ""))[:120],
            "description": data.get("description", ""),
            "author": data.get("author") or getattr(request.user, "username", "System"),
            "author_email": data.get("author_email") or getattr(request.user, "email", ""),
            "avatar": data.get("avatar") or (data.get("author", "N")[:2].upper() if data.get("author") else "N"),
            "avatarColor": data.get("avatarColor", "#6366f1"),
            "type": data.get("type", "message"),
            "unread": data.get("unread", True),
            "starred": data.get("starred", False),
            "archived": data.get("archived", False),
            "deleted": False,
            "mentioned": data.get("mentioned", False),
            "section": data.get("section", "Today"),
            "tags": data.get("tags", []),
            "time": data.get("time") or now.strftime("%I:%M %p"),
            "date": data.get("date") or now.strftime("%b %d, %Y"),
            "tasks": data.get("tasks", []),
            "replies": data.get("replies", []),
            "created_at": now,
        }

        result = get_database().notifications.insert_one(doc)
        doc["_id"] = result.inserted_id
        return Response(_serialize_notification(doc), status=status.HTTP_201_CREATED)


class NotificationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, notification_id):
        query = _notification_filter(request, notification_id)
        if query:
            query["deleted"] = {"$ne": True}
        document = get_database().notifications.find_one(query) if query else None
        if document is None:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_notification(document))

    def delete(self, request, notification_id):
        query = _notification_filter(request, notification_id)
        if query is None:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

        collection = get_database().notifications
        existing = collection.find_one(query)
        if existing is None:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

        permanent = request.query_params.get("permanent") == "true" or existing.get("deleted") is True
        if permanent:
            collection.delete_one(query)
            return Response(status=status.HTTP_204_NO_CONTENT)

        now = datetime.now(timezone.utc)
        collection.update_one(query, {"$set": {"deleted": True, "deleted_at": now}})
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, notification_id):
        query = _notification_filter(request, notification_id)
        if query is None:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

        result = get_database().notifications.update_one(
            query,
            {"$set": {"deleted": False}, "$unset": {"deleted_at": ""}},
        )
        if not result.matched_count:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"id": str(notification_id), "deleted": False})

    def post(self, request, notification_id):
        return self.patch(request, notification_id)


class NotificationFlagView(APIView):
    permission_classes = [IsAuthenticated]
    flag_name = ""

    def patch(self, request, notification_id):
        query = _notification_filter(request, notification_id)
        if query is None:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        value = request.data.get(self.flag_name)
        if value is None:
            # Default fallbacks
            if self.flag_name == "unread":
                value = False
            elif self.flag_name == "starred":
                value = True
            elif self.flag_name == "archived":
                value = True
        if not isinstance(value, bool):
            return Response(
                {self.flag_name: ["A boolean value is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = get_database().notifications.update_one(
            query, {"$set": {self.flag_name: value}}
        )
        if not result.matched_count:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"id": str(notification_id), self.flag_name: value})

    def post(self, request, notification_id):
        return self.patch(request, notification_id)


class NotificationReadView(NotificationFlagView):
    flag_name = "unread"


class NotificationStarView(NotificationFlagView):
    flag_name = "starred"


class NotificationArchiveView(NotificationFlagView):
    flag_name = "archived"


class MarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        result = get_database().notifications.update_many(
            {**_user_filter(request), "deleted": {"$ne": True}},
            {"$set": {"unread": False}},
        )
        return Response({"updated": result.modified_count})


class NotificationBulkView(APIView):
    permission_classes = [IsAuthenticated]
    flag_actions = {
        "read": ("unread", False),
        "unread": ("unread", True),
        "star": ("starred", True),
        "archive": ("archived", True),
        "unarchive": ("archived", False),
    }

    def post(self, request):
        action = request.data.get("action")
        collection = get_database().notifications

        if action == "empty_trash":
            result = collection.delete_many({**_user_filter(request), "deleted": True})
            return Response({"deleted": result.deleted_count})

        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            return Response({"ids": ["Provide at least one notification id."]}, status=status.HTTP_400_BAD_REQUEST)

        id_objects = []
        for val in ids:
            s_val = str(val)
            id_objects.append(s_val)
            if ObjectId.is_valid(s_val):
                id_objects.append(ObjectId(s_val))

        query = {**_user_filter(request), "_id": {"$in": id_objects}}
        if action == "delete":
            now = datetime.now(timezone.utc)
            result = collection.update_many(query, {"$set": {"deleted": True, "deleted_at": now}})
        elif action == "restore":
            result = collection.update_many(
                query,
                {"$set": {"deleted": False}, "$unset": {"deleted_at": ""}},
            )
        elif action == "permanent_delete":
            result = collection.delete_many(query)
        elif action in self.flag_actions:
            flag, value = self.flag_actions[action]
            result = collection.update_many(query, {"$set": {flag: value}})
        else:
            return Response({"action": ["Unsupported bulk action."]}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"updated": result.modified_count})


class NotificationTaskView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, notification_id, task_id):
        query = _notification_filter(request, notification_id)
        if query is None:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        completed = request.data.get("completed")
        if not isinstance(completed, bool):
            return Response({"completed": ["A boolean value is required."]}, status=status.HTTP_400_BAD_REQUEST)
        document = get_database().notifications.find_one(query)
        if document is None:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        tasks = document.get("tasks", [])
        task = next((item for item in tasks if str(item.get("id")) == str(task_id)), None)
        if task is None:
            return Response({"detail": "Notification task not found."}, status=status.HTTP_404_NOT_FOUND)
        task["completed"] = completed
        get_database().notifications.update_one(query, {"$set": {"tasks": tasks}})
        return Response(task)

    def post(self, request, notification_id, task_id):
        return self.patch(request, notification_id, task_id)


class NotificationRepliesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        query = _notification_filter(request, notification_id)
        if query is None:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        text = str(request.data.get("text", "")).strip()
        if not text:
            return Response({"text": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        document = get_database().notifications.find_one(query, {"replies": 1})
        if document is None:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        now = datetime.now(timezone.utc)
        reply = {
            "id": str(ObjectId()),
            "author": getattr(request.user, "username", "User"),
            "text": text,
            "time": now.strftime("%I:%M %p"),
            "date": now.strftime("%b %d, %Y"),
            "created_at": now.isoformat(),
        }
        get_database().notifications.update_one(query, {"$push": {"replies": reply}})
        return Response(reply, status=status.HTTP_201_CREATED)


class NotificationSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        document = get_database().notification_settings.find_one(_user_filter(request))
        settings = DEFAULT_SETTINGS.copy()
        if document:
            settings.update(document.get("settings", {}))
        return Response(settings)

    def put(self, request):
        if not isinstance(request.data, dict) or any(
            not isinstance(value, bool) for value in request.data.values()
        ):
            return Response(
                {"error": "Notification settings must contain boolean values."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        settings = DEFAULT_SETTINGS.copy()
        settings.update(request.data)
        get_database().notification_settings.update_one(
            {"user_id": str(request.user.id)},
            {"$set": {"settings": settings, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        return Response(settings)

