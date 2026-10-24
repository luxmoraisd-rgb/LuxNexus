from django.urls import path

from .views import (
    InboxView,
    MarkAllReadView,
    NotificationArchiveView,
    NotificationBulkView,
    NotificationDetailView,
    NotificationReadView,
    NotificationRepliesView,
    NotificationRestoreView,
    NotificationSettingsView,
    NotificationStarView,
    NotificationTaskView,
)


urlpatterns = [
    path("inbox/", InboxView.as_view(), name="inbox-list"),
    path("inbox/settings/", NotificationSettingsView.as_view(), name="inbox-settings"),
    path("inbox/mark-all-read/", MarkAllReadView.as_view(), name="inbox-mark-all-read"),
    path("inbox/bulk/", NotificationBulkView.as_view(), name="inbox-bulk"),
    path("inbox/<str:notification_id>/restore/", NotificationRestoreView.as_view(), name="inbox-restore"),
    path("inbox/<str:notification_id>/read/", NotificationReadView.as_view(), name="inbox-read"),
    path("inbox/<str:notification_id>/star/", NotificationStarView.as_view(), name="inbox-star"),
    path("inbox/<str:notification_id>/archive/", NotificationArchiveView.as_view(), name="inbox-archive"),
    path("inbox/<str:notification_id>/tasks/<str:task_id>/", NotificationTaskView.as_view(), name="inbox-task"),
    path("inbox/<str:notification_id>/replies/", NotificationRepliesView.as_view(), name="inbox-replies"),
    path("inbox/<str:notification_id>/", NotificationDetailView.as_view(), name="inbox-detail"),
]
