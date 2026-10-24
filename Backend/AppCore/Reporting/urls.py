from django.urls import path

from .views import DashboardDetailView, DashboardListCreateView, DashboardSummaryView

urlpatterns = [
    path("reporting/dashboards/", DashboardListCreateView.as_view(), name="dashboard-list-create"),
    path("reporting/dashboards/<str:dashboard_id>/", DashboardDetailView.as_view(), name="dashboard-detail"),
    path("reporting/dashboards/<str:dashboard_id>/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
]
