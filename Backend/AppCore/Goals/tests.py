from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, PropertyMock, call, patch

from bson import ObjectId
from rest_framework.test import APIRequestFactory, force_authenticate

from .views.team_goals import TeamGoalsView
from .goal_sync import sync_goals_from_projects


class ProjectGoalSynchronizationTests(TestCase):
    def test_goal_progress_tracks_live_backlog_task_state(self):
        project_id = str(ObjectId())
        sprint_id = ObjectId()
        task_id = ObjectId()
        project = {
            "_id": ObjectId(project_id),
            "name": "Project One",
            "members": [{"name": "Team Member", "email": "member@example.com"}],
        }
        sprint = SimpleNamespace(
            pk=sprint_id,
            project_id=project_id,
            name="Sprint One",
            status="active",
            end_date="2026-11-30",
        )
        active_sprint = SimpleNamespace(
            pk=ObjectId(),
            project_id=project_id,
            name="Active Sprint One",
            status="active",
            end_date="2026-11-30",
        )
        task_owner = SimpleNamespace(
            pk=ObjectId(),
            username="member",
            email="member@example.com",
            first_name="Team",
            last_name="Member",
        )
        task = SimpleNamespace(
            pk=task_id,
            project_id=project_id,
            sprint_id=sprint_id,
            title="Complete report export",
            status="In Progress",
            due_date="",
            owner=task_owner,
        )
        active_task = SimpleNamespace(
            pk=ObjectId(),
            project_id=project_id,
            sprint_id=active_sprint.pk,
            title="Review project changes",
            status="IN_PROGRESS",
            due_date="",
            owner="member@example.com",
        )

        projects = MagicMock()
        projects.find.return_value = [project]
        goals = MagicMock()
        goals.find.return_value = []
        database = MagicMock()
        database.__getitem__.side_effect = {
            "projects": projects,
            "goals": goals,
        }.__getitem__
        database.users.find_one.return_value = {
            "_id": ObjectId(),
            "name": "Team Member",
            "username": "member",
            "email": "member@example.com",
        }
        backlog_task_query = MagicMock()
        backlog_task_query.select_related.return_value = [task]
        active_task_query = MagicMock()
        active_task_query.select_related.return_value = [active_task]

        with (
            patch(
                "AppCore.Backlog.models.Sprint.objects.filter",
                return_value=[sprint],
            ),
            patch(
                "AppCore.ActiveSprint.models.Sprint.objects.filter",
                return_value=[active_sprint],
            ),
            patch(
                "AppCore.Backlog.models.Task.objects.filter",
                return_value=backlog_task_query,
            ),
            patch(
                "AppCore.ActiveSprint.models.Task.objects.filter",
                return_value=active_task_query,
            ),
        ):
            sync_goals_from_projects(database)
            task.status = "Done"
            sync_goals_from_projects(database)

        task_updates = [
            call.args[1]["$set"]
            for call in goals.update_one.call_args_list
            if call.args[1]["$set"].get("source_type") == "task"
        ]
        self.assertEqual(len(task_updates), 4)
        self.assertEqual(task_updates[0]["progress"], 50)
        self.assertEqual(task_updates[1]["progress"], 50)
        self.assertEqual(task_updates[2]["progress"], 100)
        self.assertEqual(task_updates[2]["status"], "achieved")
        self.assertEqual(task_updates[3]["progress"], 50)


class TeamGoalsUpdateTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_empty_team_goals_response_does_not_seed_example_records(self):
        collection = MagicMock()
        collection.find.return_value = []
        request = self.factory.get("/team-goals/")

        with patch.object(
            TeamGoalsView,
            "goals_collection",
            new_callable=PropertyMock,
            return_value=collection,
        ):
            response = TeamGoalsView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["teams"], [])
        self.assertEqual(response.data["metrics"]["totalGoals"], 0)
        collection.insert_many.assert_not_called()

    def test_team_goal_updates_require_authentication(self):
        request = self.factory.patch(
            "/team-goals/goal-id/",
            {"name": "Changed title"},
            format="json",
        )
        response = TeamGoalsView.as_view()(request, pk="goal-id")
        self.assertEqual(response.status_code, 401)

    def test_authenticated_user_can_update_only_supported_goal_fields(self):
        goal_id = ObjectId()
        existing_goal = {
            "_id": goal_id,
            "name": "Old title",
            "status": "on track",
            "progress": 10,
            "timePeriod": "Q1 FY26",
            "dueDate": "Apr 30, 2026",
            "owner": {"name": "Franklin", "initials": "FR"},
        }
        updated_goal = {
            **existing_goal,
            "name": "New title",
            "status": "at risk",
            "progress": 45,
            "timePeriod": "Q2 FY26",
            "dueDate": "May 30, 2026",
            "owner": {"name": "Sarah", "initials": "SA"},
        }
        collection = MagicMock()
        collection.find_one.return_value = existing_goal
        collection.find_one_and_update.return_value = updated_goal
        request = self.factory.patch(
            f"/team-goals/{goal_id}/",
            {
                "name": "New title",
                "status": "at risk",
                "progress": 45,
                "timePeriod": "Q2 FY26",
                "dueDate": "May 30, 2026",
                "owner": {"name": "Sarah", "initials": "SA"},
            },
            format="json",
        )
        force_authenticate(
            request,
            user=SimpleNamespace(
                email="member@example.com",
                is_authenticated=True,
            ),
        )

        with patch.object(
            TeamGoalsView,
            "goals_collection",
            new_callable=PropertyMock,
            return_value=collection,
        ):
            response = TeamGoalsView.as_view()(request, pk=str(goal_id))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "New title")
        self.assertEqual(response.data["id"], str(goal_id))
        update_fields = collection.find_one_and_update.call_args.args[1]["$set"]
        self.assertEqual(
            set(update_fields) - {"updated_at"},
            {
                "name",
                "status",
                "progress",
                "timePeriod",
                "time_period",
                "dueDate",
                "due_date",
                "owner",
            },
        )

    def test_authenticated_user_cannot_change_fields_outside_edit_list(self):
        request = self.factory.patch(
            "/team-goals/goal-id/",
            {"team": "Design"},
            format="json",
        )
        force_authenticate(
            request,
            user=SimpleNamespace(
                email="member@example.com",
                is_authenticated=True,
            ),
        )

        response = TeamGoalsView.as_view()(request, pk="goal-id")

        self.assertEqual(response.status_code, 400)
