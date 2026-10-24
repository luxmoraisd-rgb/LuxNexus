import hashlib
from datetime import datetime, timezone

from bson import ObjectId
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from ..db import get_database
from ..models import MongoUser


class MongoTokenAuthentication(BaseAuthentication):
    keyword = b"bearer"

    def authenticate_header(self, request):
        return "Bearer"

    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if not parts:
            return None
        if parts[0].lower() != self.keyword or len(parts) != 2:
            raise AuthenticationFailed("Invalid authorization header.")

        try:
            token = parts[1].decode("utf-8")
        except UnicodeDecodeError as exc:
            raise AuthenticationFailed("Invalid authentication token.") from exc

        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        now = datetime.now(timezone.utc)
        database = get_database()
        token_document = database.tokens.find_one(
            {"token_hash": token_hash, "expires_at": {"$gt": now}}
        )
        if token_document is None:
            raise AuthenticationFailed("Invalid or expired authentication token.")

        user_id = token_document.get("user_id")
        if not ObjectId.is_valid(user_id):
            raise AuthenticationFailed("Invalid authentication token.")
        user_document = database.users.find_one(
            {"_id": ObjectId(user_id), "is_active": True}
        )
        if user_document is None:
            raise AuthenticationFailed("User account is unavailable.")

        return MongoUser.from_document(user_document), token
