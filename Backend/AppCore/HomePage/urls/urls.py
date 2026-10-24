from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from AppCore.HomePage.views.views import (
    RegisterView,
    LoginView,
    CurrentUserView,
    WorkspaceViewSet,
    ProjectViewSet,
    TaskViewSet,
    DashboardWidgetViewSet,
    DashboardSummaryView,
    HealthCheckView,
    SeedDataView,
)

router = DefaultRouter()
router.register(r'workspaces', WorkspaceViewSet, basename='workspace')
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'widgets', DashboardWidgetViewSet, basename='widget')

urlpatterns = [
    # Dashboard Overview (Exact API supporting the Dashboard Screen)
    path('dashboard/', DashboardSummaryView.as_view(), name='dashboard-summary'),

    # Authentication Endpoints
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/me/', CurrentUserView.as_view(), name='auth-me'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),

    # System Health & Seeding Utilities
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('seed/', SeedDataView.as_view(), name='seed-data'),

    # ViewSet Router endpoints
    path('', include(router.urls)),
]
