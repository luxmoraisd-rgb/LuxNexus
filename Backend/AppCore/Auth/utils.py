import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone

from ..db import get_database
from ..models import MongoUser


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
    database.tokens.insert_one(token_doc)
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
