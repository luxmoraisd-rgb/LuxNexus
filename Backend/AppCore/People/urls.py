from django.urls import path

from .views import (
    PeopleDetailView,
    PeopleInvitationsView,
    PeopleListView,
    PeopleStatsView,
    TeamDetailView,
    TeamListView,
)

urlpatterns = [
    path("people/", PeopleListView.as_view(), name="people-list-create"),
    path("people/stats/", PeopleStatsView.as_view(), name="people-stats"),
    path("people/teams/", TeamListView.as_view(), name="people-teams"),
    path("people/teams/<str:team_id>/", TeamDetailView.as_view(), name="people-team-detail"),
    path("people/invitations/", PeopleInvitationsView.as_view(), name="people-invitations"),
    path("people/invitations/<str:email>/", PeopleInvitationsView.as_view(), name="people-invitation-delete"),
    path("people/<str:user_id>/", PeopleDetailView.as_view(), name="people-detail"),
]
