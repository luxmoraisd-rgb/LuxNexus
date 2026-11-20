from datetime import datetime, timezone
import logging
import mimetypes
import re
from pathlib import PurePosixPath

from bson import ObjectId
from django.http import FileResponse
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from gridfs import GridFSBucket
from gridfs.errors import NoFile

from AppCore.Auth.role_permissions import RoleModulePermission
from AppCore.db import get_database


logger = logging.getLogger(__name__)


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


def _serialize_reply(reply):
    value = dict(reply)
    attachments = value.get("attachments")
    if isinstance(attachments, list):
        value["attachments"] = [
            {
                key: item
                for key, item in attachment.items()
                if key != "gridfs_id"
            }
            for attachment in attachments
            if isinstance(attachment, dict)
        ]
    return value


def _serialize_notification(document):
    value = dict(document)
    value["id"] = str(value.pop("_id"))
    replies = value.get("replies")
    if isinstance(replies, list):
        value["replies"] = [
            _serialize_reply(reply) if isinstance(reply, dict) else reply
            for reply in replies
        ]
    created_at = value.get("created_at")
    if isinstance(created_at, datetime):
        value["created_at"] = created_at.isoformat()
        if not value.get("time"):
            value["time"] = created_at.strftime("%I:%M %p")
        if not value.get("date"):
            value["date"] = created_at.strftime("%b %d, %Y")
    if isinstance(value.get("user_id"), ObjectId):
        value["user_id"] = str(value["user_id"])
    return value


class InboxView(APIView):
    permission_classes = [IsAuthenticated, RoleModulePermission]

    def get(self, request):
        collection = get_database().notifications
        user_query = _user_filter(request)

        query = _user_filter(request)
        folder = request.query_params.get("folder")
        if folder == "archive":
            query["archived"] = True
        elif folder:
            query["archived"] = {"$ne": True}
            if folder == "unread":
                query["unread"] = True
            elif folder == "starred":
                query["starred"] = True
            elif folder == "mentions":
                query["mentioned"] = True
            elif folder == "tasks":
                query["type"] = "task"
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
        query["deleted"] = {"$ne": True}
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
    permission_classes = [IsAuthenticated, RoleModulePermission]

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
        result = get_database().notifications.update_one(
            query or {"_id": None}, {"$set": {"deleted": True}}
        )
        if not result.matched_count:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationFlagView(APIView):
    permission_classes = [IsAuthenticated, RoleModulePermission]
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
    permission_classes = [IsAuthenticated, RoleModulePermission]

    def post(self, request):
        result = get_database().notifications.update_many(
            {**_user_filter(request), "deleted": {"$ne": True}},
            {"$set": {"unread": False}},
        )
        return Response({"updated": result.modified_count})


class NotificationBulkView(APIView):
    permission_classes = [IsAuthenticated, RoleModulePermission]
    flag_actions = {
        "read": ("unread", False),
        "unread": ("unread", True),
        "star": ("starred", True),
        "archive": ("archived", True),
        "unarchive": ("archived", False),
    }

    def post(self, request):
        ids = request.data.get("ids")
        action = request.data.get("action")
        if not isinstance(ids, list) or not ids:
            return Response({"ids": ["Provide at least one notification id."]}, status=status.HTTP_400_BAD_REQUEST)
        
        id_objects = []
        for val in ids:
            s_val = str(val)
            id_objects.append(s_val)
            if ObjectId.is_valid(s_val):
                id_objects.append(ObjectId(s_val))

        collection = get_database().notifications
        query = {**_user_filter(request), "_id": {"$in": id_objects}}
        if action == "delete":
            result = collection.update_many(query, {"$set": {"deleted": True}})
        elif action in self.flag_actions:
            flag, value = self.flag_actions[action]
            result = collection.update_many(query, {"$set": {flag: value}})
        else:
            return Response({"action": ["Unsupported bulk action."]}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"updated": result.modified_count})


class NotificationTaskView(APIView):
    permission_classes = [IsAuthenticated, RoleModulePermission]

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
    permission_classes = [IsAuthenticated, RoleModulePermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    max_file_size = 25 * 1024 * 1024
    max_total_size = 100 * 1024 * 1024

    def post(self, request, notification_id):
        query = _notification_filter(request, notification_id)
        if query is None:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        text = str(request.data.get("text", "")).strip()
        files = request.FILES.getlist("files")
        if not text and not files:
            return Response({"text": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        if any(upload.size > self.max_file_size for upload in files):
            return Response(
                {"files": ["Each attachment must be 25 MB or smaller."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if sum(upload.size for upload in files) > self.max_total_size:
            return Response(
                {"files": ["The combined attachments must be 100 MB or smaller."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        document = get_database().notifications.find_one(query, {"replies": 1})
        if document is None:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)
        now = datetime.now(timezone.utc)
        reply_id = str(ObjectId())
        reply = {
            "id": reply_id,
            "sender_id": str(request.user.id),
            "author": getattr(request.user, "username", "User"),
            "text": text,
            "time": now.strftime("%I:%M %p"),
            "date": now.strftime("%b %d, %Y"),
            "created_at": now.isoformat(),
            "attachments": [],
        }
        database = get_database()
        bucket = GridFSBucket(database, bucket_name="inbox_attachments")
        stored_file_ids = []
        try:
            for uploaded in files:
                filename = PurePosixPath(uploaded.name.replace("\\", "/")).name or "attachment"
                content_type = uploaded.content_type or mimetypes.guess_type(filename)[0]
                content_type = content_type or "application/octet-stream"
                attachment_id = str(ObjectId())
                gridfs_id = bucket.upload_from_stream(
                    filename,
                    uploaded,
                    metadata={
                        "content_type": content_type,
                        "notification_id": str(notification_id),
                        "reply_id": reply_id,
                    },
                )
                stored_file_ids.append(gridfs_id)
                reply["attachments"].append(
                    {
                        "id": attachment_id,
                        "filename": filename,
                        "size": uploaded.size,
                        "content_type": content_type,
                        "gridfs_id": gridfs_id,
                        "download_url": (
                            f"/api/inbox/{notification_id}/replies/{reply_id}/"
                            f"attachments/{attachment_id}/"
                        ),
                    }
                )

            result = database.notifications.update_one(query, {"$push": {"replies": reply}})
            if not result.matched_count:
                for gridfs_id in stored_file_ids:
                    bucket.delete(gridfs_id)
                return Response(
                    {"detail": "Notification not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        except Exception:
            logger.exception("Unable to save Inbox reply or its attachments.")
            for gridfs_id in stored_file_ids:
                bucket.delete(gridfs_id)
            return Response(
                {"detail": "Unable to save the reply and its attachments."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(_serialize_reply(reply), status=status.HTTP_201_CREATED)


class NotificationReplyAttachmentView(APIView):
    permission_classes = [IsAuthenticated, RoleModulePermission]

    def get(self, request, notification_id, reply_id, attachment_id):
        query = _notification_filter(request, notification_id)
        query["replies"] = {
            "$elemMatch": {
                "id": reply_id,
                "attachments.id": attachment_id,
            }
        }
        document = get_database().notifications.find_one(query)
        if document is None:
            return Response(
                {"detail": "Reply attachment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        reply = next(
            (item for item in document.get("replies", []) if item.get("id") == reply_id),
            None,
        )
        attachment = next(
            (
                item
                for item in (reply or {}).get("attachments", [])
                if item.get("id") == attachment_id
            ),
            None,
        )
        if attachment is None:
            return Response(
                {"detail": "Reply attachment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            file_stream = GridFSBucket(
                get_database(), bucket_name="inbox_attachments"
            ).open_download_stream(attachment["gridfs_id"])
        except NoFile:
            return Response(
                {"detail": "Stored attachment data is missing."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return FileResponse(
            file_stream,
            as_attachment=True,
            filename=attachment["filename"],
            content_type=attachment.get("content_type") or "application/octet-stream",
        )


class NotificationSettingsView(APIView):
    permission_classes = [IsAuthenticated, RoleModulePermission]

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

