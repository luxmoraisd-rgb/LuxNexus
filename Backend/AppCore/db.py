import os
from functools import lru_cache

from django.conf import settings
from pymongo import ASCENDING, MongoClient


@lru_cache(maxsize=1)
def get_database():
    uri = getattr(settings, "MONGODB_URI", os.getenv("MONGODB_URI", "mongodb://localhost:27017/"))
    db_name = getattr(settings, "MONGODB_DATABASE", os.getenv("MONGODB_DATABASE", "nexusapp"))
    client = MongoClient(
        uri,
        serverSelectionTimeoutMS=5000,
        tz_aware=True,
    )
    database = client[db_name]

    database.users.create_index([("email", ASCENDING)], unique=True)
    database.users.create_index([("username", ASCENDING)], unique=True)
    database.tokens.create_index([("token_hash", ASCENDING)], unique=True)
    database.tokens.create_index("expires_at", expireAfterSeconds=0)
    database.projects.create_index(
        [("created_by", ASCENDING), ("start_date", ASCENDING), ("name", ASCENDING)]
    )
    database.allocations.create_index(
        [
            ("project", ASCENDING),
            ("user", ASCENDING),
            ("month", ASCENDING),
        ],
        unique=True,
    )
    database.allocations.create_index([("project", ASCENDING), ("month", ASCENDING)])
    database.password_reset_otps.create_index(
        [("email", ASCENDING)],
        unique=True,
    )
    database.password_reset_otps.create_index("expires_at", expireAfterSeconds=0)
    database.team_invitations.create_index([("email", ASCENDING)], unique=True)
    database.team_invitations.create_index(
        [("token_hash", ASCENDING)],
        unique=True,
        sparse=True,
    )
    database.team_invitations.create_index("expires_at", expireAfterSeconds=0)
    database.board_assets.create_index([("created_at", -1)])

    return database


def ping_database():
    return get_database().command("ping")
