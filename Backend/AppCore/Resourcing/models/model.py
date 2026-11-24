from AppCore.db import get_database


class ResourcingProject:
    """Compatibility export for the MongoDB-backed resourcing API."""


class ResourceAllocation:
    """Compatibility export for the MongoDB-backed resourcing API."""


def get_projects_collection():
    return get_database()["projects"]


def get_allocations_collection():
    return get_database()["allocations"]


__all__ = ["get_projects_collection", "get_allocations_collection"]
