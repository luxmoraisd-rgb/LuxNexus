from django.urls import path
from .views import MeetingsView, MeetingDetailView

urlpatterns = [
    path("meetings/", MeetingsView.as_view(), name="meetings-list-create"),
    path("meetings/<str:meeting_id>/", MeetingDetailView.as_view(), name="meetings-detail"),
]
