from django.urls import path

from ..Auth.views import (
    GoogleAuthView,
    SignupView,
    LoginView,
    GoogleAuthView,
    ChangePasswordView,
    AcceptInvitationView,
    InvitationPreviewView,
    LogoutView,
    ProfileView,
    ProfileAvatarView,
    SendOTPView,
    VerifyOTPView,
    ResetPasswordView,
    SessionHistoryView,
    TeamInvitationView,
)
from ..Auth.views.permissions import RolePermissionsView
from ..views.views import (
    ResourcingProjectListCreateView,
    ResourcingProjectDetailView,
    ResourceAllocationListCreateView,
    ResourceAllocationDetailView,
    CapacityPlanningView,
)


urlpatterns = [

    path(
        "signup/",
        SignupView.as_view(),
        name="signup",
    ),
    path(
        "invitations/",
        TeamInvitationView.as_view(),
        name="team-invitations",
    ),
    path(
        "invitations/preview/",
        InvitationPreviewView.as_view(),
        name="invitation-preview",
    ),
    path(
        "invitations/accept/",
        AcceptInvitationView.as_view(),
        name="accept-invitation",
    ),

    path(
        "login/",
        LoginView.as_view(),
        name="login",
    ),
    path("google/", GoogleAuthView.as_view(), name="google-auth"),

    path(
        "logout/",
        LogoutView.as_view(),
        name="logout",
    ),
    path(
        "sessions/",
        SessionHistoryView.as_view(),
        name="session-history",
    ),
    path(
        "sessions/<str:session_id>/",
        SessionHistoryView.as_view(),
        name="session-detail",
    ),
    path(
        "auth/sessions/",
        SessionHistoryView.as_view(),
        name="nested-session-history",
    ),
    path(
        "auth/sessions/<str:session_id>/",
        SessionHistoryView.as_view(),
        name="nested-session-detail",
    ),


    path(
        "google/",
        GoogleAuthView.as_view(),
        name="google-auth",
    ),
    path(
        "auth/google/",
        GoogleAuthView.as_view(),
        name="auth-google",
    ),
    path(
        "me/",
        ProfileView.as_view(),
        name="auth-me-profile",
    ),
    path(
        "auth/me/",
        ProfileView.as_view(),
        name="auth-me-nested",
    ),

    path(
        "profile/",
        ProfileView.as_view(),
        name="profile",
    ),
    path(
        "profile/avatar/",
        ProfileAvatarView.as_view(),
        name="profile-avatar",
    ),
    path(
        "profile/change-password/",
        ChangePasswordView.as_view(),
        name="profile-change-password",
    ),
    path(
        "change-password/",
        ChangePasswordView.as_view(),
        name="auth-change-password",
    ),


    path(
        "resourcing/projects/",
        ResourcingProjectListCreateView.as_view(),
        name="resourcing-project-list-create",
    ),

    path(
        "resourcing/projects/<str:project_id>/",
        ResourcingProjectDetailView.as_view(),
        name="resourcing-project-detail",
    ),

    path(
        "resourcing/allocations/",
        ResourceAllocationListCreateView.as_view(),
        name="allocation-list-create",
    ),

    path(
        "resourcing/allocations/<str:allocation_id>/",
        ResourceAllocationDetailView.as_view(),
        name="allocation-detail",
    ),

    path(
        "resourcing/capacity/",
        CapacityPlanningView.as_view(),
        name="capacity-planning",
    ),

    path("send-otp/", SendOTPView.as_view(), name="send-otp"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset-password"),
    path("permissions/", RolePermissionsView.as_view(), name="role-permissions"),
]