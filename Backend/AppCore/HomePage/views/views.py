from datetime import datetime
from django.utils import timezone
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import viewsets, status, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from AppCore.Auth.role_permissions import (
    RoleCapabilityPermission,
    TaskViewSetRolePermission,
)
from AppCore.HomePage.models import Workspace, Project, Task, DashboardWidget
from AppCore.HomePage.serializers import (
    UserSerializer,
    RegisterSerializer,
    LoginSerializer,
    WorkspaceSerializer,
    ProjectSerializer,
    TaskSerializer,
    DashboardWidgetSerializer,
)
from AppCore.HomePage.authentication import get_tokens_for_user
from AppCore.HomePage.db import check_db_connection, seed_dashboard_data


def get_active_user(request):
    if not request.user or not request.user.is_authenticated:
        return None
    email = getattr(request.user, "email", "")
    if email:
        return User.objects.filter(email__iexact=email).first()
    if isinstance(request.user, User):
        return request.user
    return None


class RegisterView(APIView):
    """User registration endpoint."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            tokens = get_tokens_for_user(user)
            return Response({
                "message": "User registered successfully.",
                "user": UserSerializer(user).data,
                "tokens": tokens,
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """User login endpoint returning JWT tokens."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            tokens = get_tokens_for_user(user)
            return Response({
                "message": "Login successful.",
                "user": UserSerializer(user).data,
                "tokens": tokens,
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserView(APIView):
    """Returns currently authenticated user profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = get_active_user(request)
        if not user:
            return Response({"error": "No user found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserSerializer(user).data)


class WorkspaceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Workspaces (e.g., 'Work')."""
    queryset = Workspace.objects.all()
    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticated, RoleCapabilityPermission]
    role_capabilities = {
        "GET": "view_tasks",
        "POST": "manage_team",
        "PUT": "manage_team",
        "PATCH": "manage_team",
        "DELETE": "manage_team",
    }

    def get_queryset(self):
        user = get_active_user(self.request)
        if getattr(self.request.user, "role", "user") in {"admin", "team_lead"}:
            return Workspace.objects.all()
        if user:
            return Workspace.objects.filter(owner=user)
        return Workspace.objects.none()

    def perform_create(self, serializer):
        user = get_active_user(self.request)
        if user is None:
            raise PermissionDenied("A linked workspace account is required to create workspaces.")
        serializer.save(owner=user)


class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Projects (e.g., 'Franklin\\'s first project')."""
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, RoleCapabilityPermission]
    role_capabilities = {
        "GET": "view_tasks",
        "POST": "manage_tasks",
        "PUT": "manage_tasks",
        "PATCH": "manage_tasks",
        "DELETE": "manage_tasks",
    }
    role_action_capabilities = {"add_member": "manage_team"}

    def get_queryset(self):
        user = get_active_user(self.request)
        if getattr(self.request.user, "role", "user") in {"admin", "team_lead"}:
            return Project.objects.all()
        if user:
            return Project.objects.filter(Q(owner=user) | Q(members=user)).distinct()
        return Project.objects.none()

    def perform_create(self, serializer):
        user = get_active_user(self.request)
        if user is None:
            raise PermissionDenied("A linked workspace account is required to create projects.")
        project = serializer.save(owner=user)
        project.members.add(user)

    @action(detail=False, methods=['get'])
    def recents(self, request):
        """Returns recent projects sorted by last updated."""
        projects = self.get_queryset()
        serializer = self.get_serializer(projects[:6], many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        """Add collaborator to project."""
        project = self.get_object()
        user_id = request.data.get('user_id')
        try:
            member = User.objects.get(pk=user_id)
            project.members.add(member)
            return Response({"message": f"{member.username} added as collaborator."})
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)


class TaskViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Tasks with category filtering."""
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, TaskViewSetRolePermission]

    def get_queryset(self):
        qs = Task.objects.all()
        if getattr(self.request.user, "role", "user") not in {"admin", "team_lead"}:
            qs = qs.filter(assignee__email__iexact=self.request.user.email)
        category = self.request.query_params.get('category')
        project_id = self.request.query_params.get('project')
        assignee_id = self.request.query_params.get('assignee')

        if project_id:
            qs = qs.filter(project_id=project_id)
        if assignee_id:
            qs = qs.filter(assignee_id=assignee_id)

        # Category filters: upcoming, overdue, completed
        today = timezone.now().date()
        if category == 'upcoming':
            qs = qs.filter(is_completed=False).filter(Q(due_date__gte=today) | Q(due_date__isnull=True))
        elif category == 'overdue':
            qs = qs.filter(is_completed=False, due_date__lt=today)
        elif category == 'completed':
            qs = qs.filter(is_completed=True)

        return qs

    def perform_create(self, serializer):
        user = get_active_user(self.request)
        if user is None:
            raise PermissionDenied("A linked workspace account is required to create tasks.")
        serializer.save(
            created_by=user,
            assignee=serializer.validated_data.get('assignee', user)
        )

    @action(detail=True, methods=['post'])
    def toggle_complete(self, request, pk=None):
        """Toggle task completion state."""
        task = self.get_object()
        task.is_completed = not task.is_completed
        task.save()
        return Response(self.get_serializer(task).data)

    @action(detail=False, methods=['get'])
    def my_tasks(self, request):
        """Grouped tasks for 'My tasks' card (Upcoming, Overdue, Completed)."""
        user = get_active_user(request)
        today = timezone.now().date()
        base_qs = (
            Task.objects.filter(assignee=user)
            if user
            else Task.objects.filter(assignee__email__iexact=request.user.email)
        )

        upcoming = base_qs.filter(is_completed=False).filter(Q(due_date__gte=today) | Q(due_date__isnull=True))
        overdue = base_qs.filter(is_completed=False, due_date__lt=today)
        completed = base_qs.filter(is_completed=True)

        return Response({
            "counts": {
                "upcoming": upcoming.count(),
                "overdue": overdue.count(),
                "completed": completed.count(),
            },
            "upcoming": TaskSerializer(upcoming, many=True).data,
            "overdue": TaskSerializer(overdue, many=True).data,
            "completed": TaskSerializer(completed, many=True).data,
        })


class DashboardWidgetViewSet(viewsets.ModelViewSet):
    """Manage widgets for dashboard customizing."""
    queryset = DashboardWidget.objects.all()
    serializer_class = DashboardWidgetSerializer
    permission_classes = [IsAuthenticated, RoleCapabilityPermission]
    role_capabilities = {
        "GET": "view_tasks",
        "POST": "update_assigned_tasks",
        "PUT": "update_assigned_tasks",
        "PATCH": "update_assigned_tasks",
        "DELETE": "update_assigned_tasks",
    }

    def get_queryset(self):
        user = get_active_user(self.request)
        if user:
            return DashboardWidget.objects.filter(user=user)
        return DashboardWidget.objects.none()

    def perform_create(self, serializer):
        user = get_active_user(self.request)
        if user is None:
            raise PermissionDenied("A linked workspace account is required to create dashboard widgets.")
        serializer.save(user=user)


class DashboardSummaryView(APIView):
    """
    Main endpoint powering the entire Work Management Dashboard:
    - User greeting: "Good morning, Franklin"
    - Formatted date: e.g. "Tuesday, September 29"
    - Stats: tasks completed (0), collaborators (0), tasks due soon
    - My tasks: upcoming (e.g. Task 2), overdue (1), completed
    - Projects: Franklin's first project (2 tasks due soon)
    - Workspaces: sidebar links
    """
    permission_classes = [IsAuthenticated, RoleCapabilityPermission]
    role_capabilities = {"GET": "view_tasks"}

    def get(self, request):
        user = get_active_user(request)
        now = timezone.now()
        today = now.date()

        # Dynamic greeting
        hour = now.hour
        if 5 <= hour < 12:
            greeting_prefix = "Good morning"
        elif 12 <= hour < 17:
            greeting_prefix = "Good afternoon"
        else:
            greeting_prefix = "Good evening"

        user_name = user.first_name if (user and user.first_name) else (user.username if user else "Franklin")
        greeting = f"{greeting_prefix}, {user_name}"

        # Current date formatted like "Tuesday, September 29"
        current_date = now.strftime("%A, %B %d")

        # Stats
        base_tasks = (
            Task.objects.filter(assignee=user)
            if user
            else Task.objects.filter(assignee__email__iexact=request.user.email)
        )
        tasks_completed_count = base_tasks.filter(is_completed=True).count()
        upcoming_tasks = base_tasks.filter(is_completed=False).filter(Q(due_date__gte=today) | Q(due_date__isnull=True))
        overdue_tasks = base_tasks.filter(is_completed=False, due_date__lt=today)

        # Collaborators count across projects
        if user:
            user_projects = Project.objects.filter(Q(owner=user) | Q(members=user)).distinct()
            collaborators_count = User.objects.filter(assigned_projects__in=user_projects).exclude(id=user.id).distinct().count()
        else:
            user_projects = Project.objects.none()
            collaborators_count = 0

        # Workspaces
        workspaces = Workspace.objects.filter(owner=user) if user else Workspace.objects.none()

        return Response({
            "greeting": greeting,
            "current_date": current_date,
            "user": UserSerializer(user).data if user else None,
            "stats": {
                "tasks_completed_count": tasks_completed_count,
                "collaborators_count": collaborators_count,
                "overdue_count": overdue_tasks.count(),
                "upcoming_count": upcoming_tasks.count(),
                "my_week_label": "My week",
            },
            "my_tasks": {
                "active_tab": "upcoming",
                "counts": {
                    "upcoming": upcoming_tasks.count(),
                    "overdue": overdue_tasks.count(),
                    "completed": tasks_completed_count,
                },
                "upcoming": TaskSerializer(upcoming_tasks, many=True).data,
                "overdue": TaskSerializer(overdue_tasks, many=True).data,
                "completed": TaskSerializer(base_tasks.filter(is_completed=True), many=True).data,
            },
            "projects": {
                "filter": "Recents",
                "items": ProjectSerializer(user_projects[:10], many=True).data,
            },
            "workspaces": WorkspaceSerializer(workspaces, many=True).data,
        })


class HealthCheckView(APIView):
    """Database and API health status."""
    permission_classes = [AllowAny]

    def get(self, request):
        db_status = check_db_connection()
        return Response({
            "api_status": "online",
            "timestamp": timezone.now().isoformat(),
            "database": db_status,
        })


class SeedDataView(APIView):
    """Endpoint to trigger initial seeding matching Franklin's dashboard."""
    permission_classes = [IsAuthenticated, RoleCapabilityPermission]
    role_capabilities = {"POST": "manage_board"}

    def post(self, request):
        result = seed_dashboard_data()
        return Response({
            "message": "Demo data populated successfully matching dashboard UI.",
            "data": result,
        })
