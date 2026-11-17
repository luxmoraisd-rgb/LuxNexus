"""Public model/collection interface for reporting."""

from .model import get_dashboards_collection, get_eod_reports_collection, get_tasks_collection

__all__ = ["get_dashboards_collection", "get_tasks_collection", "get_eod_reports_collection"]
