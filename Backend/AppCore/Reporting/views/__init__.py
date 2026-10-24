"""Public view exports for URL configuration."""

from .dashboard_detail import DashboardDetailView
from .dashboard_summary import DashboardSummaryView
from .dashboards import DashboardListCreateView

__all__ = ["DashboardListCreateView", "DashboardDetailView", "DashboardSummaryView"]
