import os
from functools import lru_cache
from pymongo import MongoClient

try:
    from django.conf import settings
    MONGODB_URI = getattr(settings, "MONGODB_URI", os.getenv("MONGODB_URI", "mongodb://localhost:27017/"))
    MONGODB_DATABASE = getattr(settings, "MONGODB_DATABASE", os.getenv("MONGODB_DATABASE", "nexusapp"))
except Exception:
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
    MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "nexusapp")


@lru_cache(maxsize=1)
def get_database():
    try:
        from AppCore.db import get_database as appcore_get_db
        return appcore_get_db()
    except Exception:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        return client[MONGODB_DATABASE]


def get_projects_collection():
    return get_database()["projects"]


def get_allocations_collection():
    return get_database()["allocations"]
