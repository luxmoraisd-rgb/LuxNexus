import hashlib
from datetime import datetime, timezone

from bson import ObjectId
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ...db import get_database
from ..utils import parse_device


class SessionHistoryView(APIView):
    """
    Manages active user sessions stored in MongoDB tokens collection.
    Allows listing active sessions with IP, device, and active usage times,
    as well as terminating sessions.
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

        tokens = list(
            database.tokens.find(
                {"user_id": user_id, "expires_at": {"$gt": now}}
            ).sort("created_at", -1)
        )

        try:
            from zoneinfo import ZoneInfo
            tz = ZoneInfo("Asia/Kolkata")
        except Exception:
            tz = timezone.utc

        if current_token_hash:
            database.tokens.update_one(
                {"token_hash": current_token_hash},
                {"$set": {"last_used_at": now}},
            )

        results = []
        for doc in tokens:
            is_current = doc.get("token_hash") == current_token_hash
            created_at = doc.get("created_at")
            if isinstance(created_at, datetime) and created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)

            last_used_at = now if is_current else (doc.get("last_used_at") or created_at)
            if isinstance(last_used_at, datetime) and last_used_at.tzinfo is None:
                last_used_at = last_used_at.replace(tzinfo=timezone.utc)

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
                    "ip": doc.get("ip") or "127.0.0.1",
                    "lastUsage": last_usage_str,
                    "time": time_str,
                    "isCurrent": is_current,
                    "createdAt": created_at.isoformat() if isinstance(created_at, datetime) else None,
                    "lastUsedAt": last_used_at.isoformat() if isinstance(last_used_at, datetime) else None,
                }
            )

        if not results:
            now_local = datetime.now(tz)
            results.append(
                {
                    "id": "current",
                    "device": parse_device(request.META.get("HTTP_USER_AGENT", "")),
                    "location": "Current Location",
                    "ip": request.META.get("REMOTE_ADDR", "127.0.0.1"),
                    "lastUsage": now_local.strftime("%d %b, %Y"),
                    "time": now_local.strftime("%I:%M %p").lstrip("0"),
                    "isCurrent": True,
                    "createdAt": now.isoformat(),
                    "lastUsedAt": now.isoformat(),
                }
            )

        return Response(results, status=status.HTTP_200_OK)

    def delete(self, request, session_id=None):
        database = get_database()
        user_id = str(request.user.id)

        if session_id:
            try:
                database.tokens.delete_one(
                    {"_id": ObjectId(session_id), "user_id": user_id}
                )
            except Exception:
                pass
        else:
            current_token = request.auth
            if current_token:
                token_hash = hashlib.sha256(current_token.encode("utf-8")).hexdigest()
                database.tokens.delete_one(
                    {"token_hash": token_hash, "user_id": user_id}
                )

        return Response(
            {"message": "Session terminated successfully"},
            status=status.HTTP_200_OK,
        )
