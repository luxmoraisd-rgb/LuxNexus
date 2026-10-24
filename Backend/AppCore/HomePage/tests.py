from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from datetime import timedelta

from AppCore.HomePage.models import Workspace, Project, Task
from AppCore.HomePage.db import check_db_connection, seed_dashboard_data


class DashboardAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='franklin',
            email='franklin@example.com',
            password='testpassword123',
            first_name='Franklin',
            last_name='Richards'
        )
        self.workspace = Workspace.objects.create(name='Work', owner=self.user)
        self.project = Project.objects.create(
            name="Franklin's first project",
            workspace=self.workspace,
            owner=self.user,
            color='#4F46E5',
            icon='list'
        )
        self.project.members.add(self.user)

        today = timezone.now().date()
        self.task_upcoming = Task.objects.create(
            title='Task 2',
            project=self.project,
            workspace=self.workspace,
            assignee=self.user,
            created_by=self.user,
            start_date=today - timedelta(days=3),
            due_date=today,
            is_completed=False,
        )
        self.task_overdue = Task.objects.create(
            title='Overdue Task Example',
            project=self.project,
            workspace=self.workspace,
            assignee=self.user,
            created_by=self.user,
            due_date=today - timedelta(days=2),
            is_completed=False,
        )

    def test_health_check_endpoint(self):
        """Test system health check."""
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['api_status'], 'online')
        self.assertTrue(response.data['database']['connected'])

    def test_dashboard_summary(self):
        """Test the main dashboard overview API matching the UI."""
        response = self.client.get('/api/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Franklin", response.data['greeting'])
        self.assertIn("stats", response.data)
        self.assertEqual(response.data['stats']['overdue_count'], 1)
        self.assertEqual(response.data['stats']['upcoming_count'], 1)
        self.assertEqual(len(response.data['projects']['items']), 1)
        self.assertEqual(response.data['projects']['items'][0]['name'], "Franklin's first project")

    def test_task_toggle_complete(self):
        """Test toggling task completion."""
        response = self.client.post(f'/api/tasks/{self.task_upcoming.id}/toggle_complete/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_completed'])
        self.assertEqual(response.data['status_category'], 'completed')

    def test_project_recents(self):
        """Test getting recent projects."""
        response = self.client.get('/api/projects/recents/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) >= 1)

    def test_database_seeder(self):
        """Test seed_dashboard_data function."""
        result = seed_dashboard_data()
        self.assertEqual(result['user'], 'franklin')
        self.assertEqual(result['project'], "Franklin's first project")
        self.assertTrue(result['task_count'] >= 2)
