from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, PropertyMock, patch

from bson import ObjectId
from rest_framework.test import APIRequestFactory, force_authenticate

from .views.team_goals import TeamGoalsView


class TeamGoalsUpdateTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_only_franklin_can_update_team_goals(self):
        request = self.factory.patch(
            "/team-goals/goal-id/",
            {"name": "Changed title"},
            format="json",
        )
        force_authenticate(
            request,
            user=SimpleNamespace(
                email="another.user@example.com",
                is_authenticated=True,
            ),
        )

        response = TeamGoalsView.as_view()(request, pk="goal-id")

        self.assertEqual(response.status_code, 403)

    def test_franklin_can_update_only_supported_goal_fields(self):
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
                email="franklin@gmail.com",
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

    def test_franklin_cannot_change_fields_outside_edit_list(self):
        request = self.factory.patch(
            "/team-goals/goal-id/",
            {"team": "Design"},
            format="json",
        )
        force_authenticate(
            request,
            user=SimpleNamespace(
                email="franklin@gmail.com",
                is_authenticated=True,
            ),
        )

        response = TeamGoalsView.as_view()(request, pk="goal-id")

        self.assertEqual(response.status_code, 400)
