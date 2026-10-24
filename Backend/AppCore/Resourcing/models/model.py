from AppCore.db import get_database


def get_projects_collection():
    return get_database()["projects"]


def get_allocations_collection():
    return get_database()["allocations"]


__all__ = ["get_projects_collection", "get_allocations_collection"]
