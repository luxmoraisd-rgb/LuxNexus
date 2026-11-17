from AppCore.db import get_database


def get_dashboards_collection():
    return get_database()["dashboards"]


def get_tasks_collection():
    return get_database()["tasks"]


def get_eod_reports_collection():
    return get_database()["eod_reports"]


__all__ = ["get_dashboards_collection", "get_tasks_collection", "get_eod_reports_collection"]
