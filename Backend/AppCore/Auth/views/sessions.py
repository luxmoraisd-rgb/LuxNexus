import hashlib
from datetime import datetime, timezone

from bson import ObjectId
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ...db import get_database
from ..utils import (
    SESSION_HISTORY_LIMIT,
    end_session,
    get_client_ip,
    parse_device,
    sync_session_history,
)


class SessionHistoryView(APIView):
    """
    Lists the five most recent active and ended sessions and terminates active
    sessions.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        database = get_database()
        user_id = str(request.user.id)
        now = datetime.now(timezone.utc)

        current_token = request.auth
        current_token_hash = (
            hashlib.sha256(current_token.encode("utf-8")).hexdigest()
            if current_token
            else None
        )
        current_client_ip = get_client_ip(request)

        try:
            from zoneinfo import ZoneInfo
            tz = ZoneInfo("Asia/Kolkata")
        except Exception:
            tz = timezone.utc

        if current_token_hash:
            database.tokens.update_one(
                {"token_hash": current_token_hash, "user_id": user_id},
                {"$set": {"last_used_at": now}},
            )

        sessions = sync_session_history(database, user_id, now)

        results = []
        for doc in sessions:
            is_active = doc.get("status") == "active"
            is_current = is_active and doc.get("token_hash") == current_token_hash
            created_at = doc.get("created_at")
            if isinstance(created_at, datetime) and created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)

            last_used_at = now if is_current else (doc.get("last_used_at") or created_at)
            if isinstance(last_used_at, datetime) and last_used_at.tzinfo is None:
                last_used_at = last_used_at.replace(tzinfo=timezone.utc)
            ended_at = doc.get("ended_at")
            if isinstance(ended_at, datetime) and ended_at.tzinfo is None:
                ended_at = ended_at.replace(tzinfo=timezone.utc)

            if isinstance(last_used_at, datetime):
                local_last_used = last_used_at.astimezone(tz)
                last_usage_str = local_last_used.strftime("%d %b, %Y")
                time_str = local_last_used.strftime("%I:%M %p").lstrip("0")
            else:
                now_local = datetime.now(tz)
                last_usage_str = now_local.strftime("%d %b, %Y")
                time_str = now_local.strftime("%I:%M %p").lstrip("0")

            results.append(
                {
                    "id": str(doc["_id"]),
                    "device": doc.get("device") or parse_device(doc.get("user_agent")),
                    "location": doc.get("location") or "Current Location",
                    "ip": current_client_ip if is_current else doc.get("ip") or "127.0.0.1",
                    "lastUsage": last_usage_str,
                    "time": time_str,
                    "status": doc.get("status", "ended"),
                    "isActive": is_active,
                    "isCurrent": is_current,
                    "createdAt": created_at.isoformat() if isinstance(created_at, datetime) else None,
                    "lastUsedAt": last_used_at.isoformat() if isinstance(last_used_at, datetime) else None,
                    "endedAt": ended_at.isoformat() if isinstance(ended_at, datetime) else None,
                    "endReason": doc.get("end_reason"),
                }
            )

        response = Response(results, status=status.HTTP_200_OK)
        response["X-Session-History-Limit"] = str(SESSION_HISTORY_LIMIT)
        return response

    def delete(self, request, session_id=None):
        database = get_database()
        user_id = str(request.user.id)

        if session_id:
            if not ObjectId.is_valid(session_id):
                return Response(
                    {"error": "Invalid session ID"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token_document = database.tokens.find_one(
                {"_id": ObjectId(session_id), "user_id": user_id}
            )
            if token_document:
                end_session(database, token_document)
                database.tokens.delete_one(
                    {"_id": token_document["_id"], "user_id": user_id}
                )
        else:
            current_token = request.auth
            if current_token:
                token_hash = hashlib.sha256(current_token.encode("utf-8")).hexdigest()
                token_document = database.tokens.find_one(
                    {"token_hash": token_hash, "user_id": user_id}
                )
                if token_document:
                    end_session(database, token_document)
                    database.tokens.delete_one(
                        {"_id": token_document["_id"], "user_id": user_id}
                    )

        return Response(
            {"message": "Session terminated successfully"},
            status=status.HTTP_200_OK,
        )
