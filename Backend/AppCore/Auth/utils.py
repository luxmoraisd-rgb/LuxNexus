import hashlib
import hmac
import ipaddress
import re
import secrets
from datetime import datetime, timedelta, timezone

from django.conf import settings

from ..db import get_database
from ..models import MongoUser

SESSION_HISTORY_LIMIT = getattr(settings, "SESSION_HISTORY_LIMIT", 5)


def _as_utc_datetime(value, fallback):
    if not isinstance(value, datetime):
        return fallback
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _save_session_history(database, token_document, now):
    created_at = _as_utc_datetime(token_document.get("created_at"), now)
    last_used_at = _as_utc_datetime(token_document.get("last_used_at"), created_at)
    expires_at = _as_utc_datetime(token_document.get("expires_at"), now)
    is_active = expires_at > now
    values = {
        "user_id": str(token_document["user_id"]),
        "device": token_document.get("device") or parse_device(token_document.get("user_agent")),
        "location": token_document.get("location") or "Current Location",
        "ip": token_document.get("ip") or "127.0.0.1",
        "created_at": created_at,
        "last_used_at": last_used_at,
        "expires_at": expires_at,
        "token_hash": token_document.get("token_hash"),
        "status": "active" if is_active else "ended",
    }
    if not is_active:
        values["ended_at"] = expires_at
        values["end_reason"] = "expired"

    database.session_history.update_one(
        {"_id": token_document["_id"]},
        {"$set": values},
        upsert=True,
    )


def enforce_session_history_limit(database, user_id):
    history = list(
        database.session_history.find({"user_id": str(user_id)}).sort(
            [("created_at", 1), ("_id", 1)]
        )
    )
    excess = history[:-SESSION_HISTORY_LIMIT]
    for session in excess:
        if session.get("status") == "active":
            database.tokens.delete_one(
                {"_id": session["_id"], "user_id": str(user_id)}
            )
        database.session_history.delete_one(
            {"_id": session["_id"], "user_id": str(user_id)}
        )


def sync_session_history(database, user_id, now):
    user_id = str(user_id)
    tokens = list(
        database.tokens.find({"user_id": user_id}).sort("created_at", -1)
    )
    token_ids = []
    for token_document in tokens:
        token_ids.append(token_document["_id"])
        _save_session_history(database, token_document, now)

    database.session_history.update_many(
        {
            "user_id": user_id,
            "status": "active",
            "_id": {"$nin": token_ids},
        },
        {
            "$set": {
                "status": "ended",
                "ended_at": now,
                "end_reason": "revoked",
            }
        },
    )
    enforce_session_history_limit(database, user_id)
    return list(
        database.session_history.find({"user_id": user_id}).sort(
            [("created_at", -1), ("_id", -1)]
        )
    )[:SESSION_HISTORY_LIMIT]


def end_session(database, token_document, ended_at=None, reason="logout"):
    now = ended_at or datetime.now(timezone.utc)
    _save_session_history(database, token_document, now)
    database.session_history.update_one(
        {"_id": token_document["_id"], "user_id": str(token_document["user_id"])},
        {
            "$set": {
                "status": "ended",
                "ended_at": now,
                "end_reason": reason,
            }
        },
    )


def end_user_sessions(database, user_id, reason, except_token_hash=None):
    query = {"user_id": str(user_id)}
    if except_token_hash:
        query["token_hash"] = {"$ne": except_token_hash}
    now = datetime.now(timezone.utc)
    for token_document in database.tokens.find(query):
        end_session(database, token_document, now, reason)


def user_payload(user):
    if isinstance(user, MongoUser):
        user_id = str(user.id)
        username = user.username
        email = user.email
        first_name = user.first_name
        last_name = user.last_name
        role = user.role
    else:
        user_id = str(user["_id"])
        username = user["username"]
        email = user["email"]
        first_name = user.get("first_name", "")
        last_name = user.get("last_name", "")
        role = user.get("role", "user")
    return {
        "id": user_id,
        "username": username,
        "email": email,
        "name": first_name or username,
        "first_name": first_name,
        "last_name": last_name,
        "role": role,
    }


def profile_payload(user_document):
    profile = user_document.get("profile", {})
    return {
        **user_payload(user_document),
        "jobTitle": profile.get("jobTitle", ""),
        "mobile": profile.get("mobile", ""),
        "location": profile.get("location", ""),
        "birthday": profile.get("birthday", ""),
        "bio": profile.get("bio", ""),
        "photo": profile.get("photo", ""),
    }


def parse_device(user_agent):
    if not user_agent:
        return "Windows Chrome"
    ua = str(user_agent).lower()
    os_name = "Desktop"
    if "windows" in ua:
        os_name = "Windows"
    elif "macintosh" in ua or "mac os" in ua:
        os_name = "macOS"
    elif "linux" in ua:
        os_name = "Linux"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"

    browser_name = "Chrome"
    if "edg" in ua:
        browser_name = "Edge"
    elif "chrome" in ua and "chromium" not in ua and "edg" not in ua:
        browser_name = "Chrome"
    elif "firefox" in ua:
        browser_name = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser_name = "Safari"

    return f"{os_name} {browser_name}".strip()


def get_client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    candidates = forwarded_for.split(",") if forwarded_for else []
    candidates.append(request.META.get("REMOTE_ADDR", ""))

    for candidate in candidates:
        try:
            return str(ipaddress.ip_address(candidate.strip()))
        except ValueError:
            continue

    return "127.0.0.1"


def create_token(
    user_id,
    database,
    now=None,
    ip=None,
    user_agent=None,
    device=None,
    location=None,
):
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    created_at = now or datetime.now(timezone.utc)
    parsed_device = device or parse_device(user_agent)
    token_doc = {
        "token_hash": token_hash,
        "user_id": str(user_id),
        "created_at": created_at,
        "last_used_at": created_at,
        "expires_at": created_at + timedelta(days=14),
        "ip": ip or "127.0.0.1",
        "user_agent": user_agent or "",
        "device": parsed_device,
        "location": location or "Current Location",
    }
    for existing_token in database.tokens.find({"user_id": str(user_id)}):
        _save_session_history(database, existing_token, created_at)
    token_doc["_id"] = database.tokens.insert_one(token_doc).inserted_id
    _save_session_history(database, token_doc, created_at)
    enforce_session_history_limit(database, user_id)
    return token



def normalize_username(username):
    normalized = re.sub(r"[^\w-]", "_", username).strip("_").lower()
    return normalized[:150] or "user"


def otp_hash(email, otp):
    norm_email = str(email or "").strip().lower()
    norm_otp = str(otp or "").strip()
    return hashlib.sha256(f"{norm_email}:{norm_otp}".encode("utf-8")).hexdigest()


def is_valid_otp(email, otp):
    norm_email = str(email or "").strip().lower()
    norm_otp = str(otp or "").strip()
    if not norm_email or not norm_otp:
        return False
    database = get_database()
    document = database.password_reset_otps.find_one(
        {
            "$or": [
                {"email": norm_email},
                {"email": {"$regex": f"^{re.escape(norm_email)}$", "$options": "i"}},
            ],
            "expires_at": {"$gt": datetime.now(timezone.utc)},
        }
    )
    if not document:
        return False
    stored_email = str(document.get("email") or norm_email).strip().lower()
    expected_hash_1 = otp_hash(stored_email, norm_otp)
    expected_hash_2 = otp_hash(norm_email, norm_otp)
    stored_hash = document.get("otp_hash", "")
    return hmac.compare_digest(stored_hash, expected_hash_1) or hmac.compare_digest(stored_hash, expected_hash_2)
