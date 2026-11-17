from django.urls import path

from .views import (
    DashboardDetailView,
    DashboardListCreateView,
    DashboardSummaryView,
    EODCommentsView,
    EODReportDetailView,
    EODReportImportView,
    EODReportListCreateView,
    EODReportSampleDataView,
    EODSpreadsheetPreviewView,
    ReportOptionsView,
)

urlpatterns = [
    path("reporting/eod-reports/", EODReportListCreateView.as_view(), name="eod-report-list-create"),
    path("reporting/eod-reports/sample-data/", EODReportSampleDataView.as_view(), name="eod-report-sample-data"),
    path("reporting/eod-reports/preview-import/", EODSpreadsheetPreviewView.as_view(), name="eod-report-preview-import"),
    path("reporting/eod-reports/import/", EODReportImportView.as_view(), name="eod-report-import"),
    path("reporting/eod-reports/<str:report_id>/", EODReportDetailView.as_view(), name="eod-report-detail"),
    path("reporting/eod-comments/", EODCommentsView.as_view(), name="eod-comments"),
    path("reporting/eod-options/", ReportOptionsView.as_view(), name="eod-report-options"),
    path("reporting/dashboards/", DashboardListCreateView.as_view(), name="dashboard-list-create"),
    path("reporting/dashboards/<str:dashboard_id>/", DashboardDetailView.as_view(), name="dashboard-detail"),
    path("reporting/dashboards/<str:dashboard_id>/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
]
