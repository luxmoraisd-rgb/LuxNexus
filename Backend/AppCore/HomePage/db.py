"""
Database utilities and helper functions for the HomePage API.
Provides connection health checks, transaction wrappers, and initial seeding.
"""
import time
import logging
from django.db import connection
from django.db.utils import OperationalError
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)

def check_db_connection():
    """
    Verifies that the database is accessible and measures query latency.
    Returns a dictionary with status and latency in milliseconds.
    """
    start_time = time.time()
    try:
        connection.database.command("ping")
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "healthy",
            "connected": True,
            "engine": connection.vendor,
            "latency_ms": latency_ms,
        }
    except OperationalError as err:
        logger.error(f"Database operational error: {err}")
        return {
            "status": "unhealthy",
            "connected": False,
            "error": str(err),
            "latency_ms": None,
        }
    except Exception as exc:
        logger.error(f"Unexpected database error: {exc}")
        return {
            "status": "error",
            "connected": False,
            "error": str(exc),
            "latency_ms": None,
        }

def seed_dashboard_data():
    """
    Populates sample data replicating the Franklin dashboard interface in the image:
    - User 'Franklin'
    - Workspace 'Work'
    - Project 'Franklin's first project' with 2 tasks due soon
    - Task 'Task 2' assigned to Franklin with status 'upcoming' and due date today
    - Overdue task to replicate 'Overdue (1)'
    """
    from AppCore.HomePage.models import Workspace, Project, Task, DashboardWidget

    User = get_user_model()
    now = timezone.now().date()

    # 1. Create or get user Franklin
    user, created = User.objects.get_or_create(
        username='franklin',
        defaults={
            'first_name': 'Franklin',
            'last_name': 'Richards',
            'email': 'franklin@example.com',
            'is_staff': True,
        }
    )
    if created:
        user.set_password('franklin123')
        user.save()

    # 2. Create or get Workspace 'Work'
    workspace, _ = Workspace.objects.get_or_create(
        name='Work',
        defaults={'owner': user, 'description': 'Main workspace'}
    )

    # 3. Create or get Project "Franklin's first project"
    project, _ = Project.objects.get_or_create(
        name="Franklin's first project",
        workspace=workspace,
        defaults={
            'owner': user,
            'description': 'Primary onboarding and task tracking project',
            'color': '#4F46E5',
            'icon': 'list',
            'status': 'active',
        }
    )
    project.members.add(user)

    # 4. Tasks matching the UI:
    # Task 2 (Upcoming, due today / Sep 25 - Today)
    Task.objects.get_or_create(
        title='Task 2',
        project=project,
        defaults={
            'workspace': workspace,
            'assignee': user,
            'created_by': user,
            'start_date': now - timedelta(days=4),
            'due_date': now,
            'is_completed': False,
            'priority': 'medium',
            'status_category': 'upcoming',
            'description': 'Main upcoming task highlighted on dashboard',
        }
    )

    # Task 1 (Overdue 1, due 2 days ago)
    Task.objects.get_or_create(
        title='Initial Setup & Review',
        project=project,
        defaults={
            'workspace': workspace,
            'assignee': user,
            'created_by': user,
            'start_date': now - timedelta(days=7),
            'due_date': now - timedelta(days=2),
            'is_completed': False,
            'priority': 'high',
            'status_category': 'overdue',
            'description': 'Overdue task for review',
        }
    )

    # Additional task due soon for "2 tasks due soon" badge
    Task.objects.get_or_create(
        title='Sprint Milestone Planning',
        project=project,
        defaults={
            'workspace': workspace,
            'assignee': user,
            'created_by': user,
            'start_date': now,
            'due_date': now + timedelta(days=2),
            'is_completed': False,
            'priority': 'medium',
            'status_category': 'upcoming',
            'description': 'Second task due soon in the project',
        }
    )

    # Ensure widgets exist
    widget_types = ['my_tasks', 'projects', 'stats']
    for idx, wtype in enumerate(widget_types):
        DashboardWidget.objects.get_or_create(
            user=user,
            widget_type=wtype,
            defaults={'position': idx, 'is_visible': True}
        )

    return {
        "user": user.username,
        "workspace": workspace.name,
        "project": project.name,
        "task_count": Task.objects.filter(project=project).count(),
    }
