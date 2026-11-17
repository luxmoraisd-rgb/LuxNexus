from datetime import datetime, timezone

from pymongo import ASCENDING
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..Auth.role_permissions import ROLE_LABELS
from ..db import get_database


CONVERSATION_ID = "admin-chat"
MAX_MESSAGE_LENGTH = 2000


class ChatAccessPermission(BasePermission):
    def has_permission(self, request, view):
        role = getattr(request.user, "role", None)
        if request.method in {"GET", "HEAD", "OPTIONS"}:
            return role in ROLE_LABELS
        if request.method == "POST":
            return role == "team_lead"
        return False


class ChatViewerPermission(BasePermission):
    def has_permission(self, request, view):
        return getattr(request.user, "role", None) in ROLE_LABELS


class AdminChatView(APIView):
    permission_classes = [IsAuthenticated, ChatAccessPermission]

    def get(self, request):
        query = {"conversation_id": CONVERSATION_ID}
        after = request.query_params.get("after")
        if after:
            try:
                after_timestamp = datetime.fromisoformat(after.replace("Z", "+00:00"))
            except ValueError:
                return Response(
                    {"after": "Provide a valid ISO-8601 timestamp."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if after_timestamp.tzinfo is None:
                after_timestamp = after_timestamp.replace(tzinfo=timezone.utc)
            query["created_at"] = {"$gte": after_timestamp}

        database = get_database()
        _ensure_conversation(database)
        messages = list(
            database.chat_messages.find(query).sort("created_at", ASCENDING)
        )
        sender_ids = {message["sender_id"] for message in messages}
        users = (
            database.users.find({"_id": {"$in": list(sender_ids)}})
            if sender_ids
            else []
        )
        users_by_id = {user["_id"]: user for user in users}

        return Response(
            {
                "messages": [
                    _serialize_message(message, users_by_id.get(message["sender_id"]))
                    for message in messages
                ],
                "unread_count": _unread_count(database, request.user.id),
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        content = request.data.get("content")
        if not isinstance(content, str):
            return Response(
                {"content": "Message content must be a string."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        content = content.strip()
        if not content:
            return Response(
                {"content": "Message content cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(content) > MAX_MESSAGE_LENGTH:
            return Response(
                {"content": f"Messages must be {MAX_MESSAGE_LENGTH} characters or fewer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        database = get_database()
        _ensure_conversation(database)
        message = {
            "conversation_id": CONVERSATION_ID,
            "sender_id": request.user.id,
            "content": content,
            "created_at": datetime.now(timezone.utc),
            "read_by": [request.user.id],
        }
        message["_id"] = database.chat_messages.insert_one(message).inserted_id
        sender = database.users.find_one({"_id": request.user.id})
        return Response(
            {"message": _serialize_message(message, sender)},
            status=status.HTTP_201_CREATED,
        )


class AdminChatUnreadView(APIView):
    permission_classes = [IsAuthenticated, ChatViewerPermission]

    def get(self, request):
        database = get_database()
        return Response(
            {"unread_count": _unread_count(database, request.user.id)},
            status=status.HTTP_200_OK,
        )


class AdminChatReadView(APIView):
    permission_classes = [IsAuthenticated, ChatViewerPermission]

    def post(self, request):
        database = get_database()
        _ensure_conversation(database)
        database.chat_messages.update_many(
            {
                "conversation_id": CONVERSATION_ID,
                "sender_id": {"$ne": request.user.id},
                "read_by": {"$ne": request.user.id},
            },
            {"$addToSet": {"read_by": request.user.id}},
        )
        return Response(
            {"unread_count": _unread_count(database, request.user.id)},
            status=status.HTTP_200_OK,
        )


def _ensure_conversation(database):
    database.chat_conversations.update_one(
        {"_id": CONVERSATION_ID},
        {
            "$set": {
                "name": "Chat",
                "allowed_roles": list(ROLE_LABELS),
            },
            "$setOnInsert": {
                "created_at": datetime.now(timezone.utc),
            },
            "$unset": {"admins_only": ""},
        },
        upsert=True,
    )


def _unread_count(database, user_id):
    return database.chat_messages.count_documents(
        {
            "conversation_id": CONVERSATION_ID,
            "sender_id": {"$ne": user_id},
            "read_by": {"$ne": user_id},
        }
    )


def _serialize_message(message, sender):
    sender = sender or {}
    created_at = message["created_at"]
    return {
        "id": str(message["_id"]),
        "sender": {
            "id": str(message["sender_id"]),
            "name": " ".join(
                part
                for part in (
                    sender.get("first_name", ""),
                    sender.get("last_name", ""),
                )
                if part
            )
            or sender.get("username", "Team member"),
            "photo": sender.get("profile", {}).get("photo", ""),
        },
        "content": message["content"],
        "created_at": created_at.isoformat(),
    }
