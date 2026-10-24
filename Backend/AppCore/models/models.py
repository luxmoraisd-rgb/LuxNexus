from dataclasses import dataclass
from typing import Any

from bson import ObjectId


@dataclass(frozen=True)
class MongoUser:
    id: ObjectId
    username: str
    email: str
    first_name: str
    last_name: str
    role: str = "user"
    is_active: bool = True

    @classmethod
    def from_document(cls, document: dict[str, Any]):
        return cls(
            id=document["_id"],
            username=document["username"],
            email=document["email"],
            first_name=document.get("first_name", ""),
            last_name=document.get("last_name", ""),
            role=document.get("role", "user"),
            is_active=document.get("is_active", True),
        )

    @property
    def is_authenticated(self):
        return True



