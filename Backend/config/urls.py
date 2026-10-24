from django.urls import include, path

from AppCore.Auth.views.change_password import ChangePasswordView
from AppCore.views.views import health_check


urlpatterns = [
    path("", health_check, name="health-check"),
    path("api/profile/change-password/", ChangePasswordView.as_view(), name="direct-profile-change-password"),
    path("api/change-password/", ChangePasswordView.as_view(), name="direct-change-password"),
    path("api/auth/", include("AppCore.urls.urls")),
    path("api/", include("AppCore.Projects.urls")),
    path("api/", include("AppCore.Inbox.urls")),
    path("api/all-sprints/", include("AppCore.AllSprint.urls")),
    path("api/", include("AppCore.Backlog.urls.urls")),
    path("api/", include("AppCore.HomePage.urls.urls")),
    path("api/backlog/", include("AppCore.Backlog.urls.urls")),
    path("api/", include("AppCore.Goals.urls")),
    path("api/", include("AppCore.Reporting.urls")),
    path("api/", include("AppCore.Resourcing.urls")),
    path("api/", include("AppCore.People.urls")),
    path("api/", include("AppCore.Portfolios.urls")),
    path("api/", include("AppCore.Knowledge.urls")),
]
