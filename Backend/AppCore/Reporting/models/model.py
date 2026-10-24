from AppCore.db import get_database


def get_dashboards_collection():
    return get_database()["dashboards"]


def get_tasks_collection():
    return get_database()["tasks"]


__all__ = ["get_dashboards_collection", "get_tasks_collection"]

