import base64
import hashlib
from datetime import datetime, timezone, timedelta
import json
from unittest.mock import Mock, patch

from bson import ObjectId
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from django.utils import timezone as django_timezone
from django.urls import resolve
from rest_framework.test import APIClient, APIRequestFactory
from pymongo.errors import DuplicateKeyError, PyMongoError

from .Auth.authentication import MongoTokenAuthentication
from .Auth.role_permissions import (
    AdminOnlyDeletePermission,
    DEFAULT_ROLE_POLICIES,
    RoleCapabilityPermission,
    RoleModulePermission,
    TaskDetailRolePermission,
    get_effective_role,
    has_role_permission,
)
from .Auth.views.permissions import RolePermissionsView
from .checks import check_email_configuration
from .models import MongoUser
from .People.views import _format_user, _invitation_days_left
from .Reporting.views.reports import EOD_PATTERN, _aggregate_reports, _eod_comment_reports
from .ActiveSprint.serializers.serializer import TaskSerializer as ActiveSprintTaskSerializer
from .Backlog.serializers.serializer import (
    TaskSerializer as BacklogTaskSerializer,
    UserSerializer as BacklogUserSerializer,
)
from .serializers.serializers import ProjectInputSerializer
from .task_assignees import list_task_assignees


class PeopleInvitationExpiryTests(SimpleTestCase):
    def test_days_left_decreases_each_calendar_day(self):
        sent_at = datetime(2026, 11, 14, 12, tzinfo=timezone.utc)
        expires_at = sent_at + timedelta(days=7)

        self.assertEqual(_invitation_days_left(expires_at, sent_at), 6)
        self.assertEqual(
            _invitation_days_left(expires_at, sent_at + timedelta(days=1)),
            5,
        )


class PeopleMemberFormattingTests(SimpleTestCase):
    def test_member_payload_includes_employee_id(self):
        person = _format_user(
            {
                "_id": ObjectId(),
                "username": "nexus_user",
                "email": "user@example.com",
                "employee_id": "LUX-SD-CHN-007",
            }
        )

        self.assertEqual(person["employeeId"], "LUX-SD-CHN-007")

    @override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
    @patch("AppCore.People.views.get_database")
    def test_people_list_marks_employee_id_edit_access_for_configured_admin(
        self, get_database
    ):
        admin = MongoUser(
            id=ObjectId(),
            username="nexus_admin",
            email="admin@example.com",
            first_name="Admin",
            last_name="",
            role="admin",
        )
        client = APIClient()
        client.force_authenticate(user=admin)
        database = get_database.return_value
        database.users.find.return_value.sort.return_value = [
            {
                "_id": ObjectId(),
                "username": "member",
                "email": "member@example.com",
                "employee_id": "LUX-SD-CHN-007",
            }
        ]

        response = client.get("/api/people/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["employeeId"], "LUX-SD-CHN-007")
        self.assertTrue(response.data[0]["can_edit_employee_id"])


@override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
class PeopleEmployeeIdUpdateTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.target_id = ObjectId()
        self.admin = MongoUser(
            id=ObjectId(),
            username="nexus_admin",
            email="admin@example.com",
            first_name="Admin",
            last_name="",
            role="admin",
        )
        self.member = MongoUser(
            id=ObjectId(),
            username="member",
            email="member@example.com",
            first_name="Member",
            last_name="",
            role="user",
        )

    @patch("AppCore.People.views.get_database")
    def test_admin_can_update_another_members_employee_id(self, get_database):
        self.client.force_authenticate(user=self.admin)
        database = get_database.return_value
        database.users.find_one.side_effect = [
            {
                "_id": self.target_id,
                "username": "member",
                "email": "member@example.com",
            },
            None,
            {
                "_id": self.target_id,
                "username": "member",
                "email": "member@example.com",
                "employee_id": "LUX-SD-BNG-021",
            },
        ]

        response = self.client.patch(
            f"/api/people/{self.target_id}/",
            {"employeeId": "lux-sd-bng-021"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["employeeId"], "LUX-SD-BNG-021")
        updates = database.users.update_one.call_args.args[1]["$set"]
        self.assertEqual(updates["employee_id"], "LUX-SD-BNG-021")
        self.assertEqual(updates["employee_id_sequence"], 21)

    @patch("AppCore.People.views.get_database")
    def test_non_admin_cannot_update_employee_id(self, get_database):
        self.client.force_authenticate(user=self.member)
        database = get_database.return_value
        database.users.find_one.return_value = {
            "_id": self.target_id,
            "username": "member",
            "email": "member@example.com",
        }

        response = self.client.patch(
            f"/api/people/{self.target_id}/",
            {"employeeId": "LUX-SD-BNG-021"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        database.users.update_one.assert_not_called()

    @patch("AppCore.People.views.get_database")
    def test_admin_cannot_assign_employee_id_number_already_in_use(
        self, get_database
    ):
        self.client.force_authenticate(user=self.admin)
        database = get_database.return_value
        database.users.find_one.side_effect = [
            {"_id": self.target_id, "email": "member@example.com"},
            {"_id": ObjectId(), "employee_id": "LUX-SD-CHN-021"},
        ]

        response = self.client.patch(
            f"/api/people/{self.target_id}/",
            {"employeeId": "LUX-SD-HYD-021"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("already assigned", response.data["error"])
        database.users.update_one.assert_not_called()

    @patch("AppCore.People.views.get_database")
    def test_admin_cannot_assign_zero_employee_number(self, get_database):
        self.client.force_authenticate(user=self.admin)
        database = get_database.return_value
        database.users.find_one.return_value = {
            "_id": self.target_id,
            "email": "member@example.com",
        }

        response = self.client.patch(
            f"/api/people/{self.target_id}/",
            {"employeeId": "LUX-SD-CHN-000"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("001 through LUX-SD-CHN-999", response.data["error"])
        database.users.update_one.assert_not_called()


class TaskAssigneeTests(SimpleTestCase):
    def test_task_story_points_restrict_to_supported_values(self):
        for serializer_class in (BacklogTaskSerializer, ActiveSprintTaskSerializer):
            for invalid_sp in (4, 6, 8, 11, 40):
                with self.subTest(serializer=serializer_class.__module__, sp=invalid_sp):
                    if serializer_class is BacklogTaskSerializer:
                        payload = {"title": "Task", "sp": invalid_sp}
                    else:
                        payload = {"title": "Task", "estimated_sp": invalid_sp}
                    serializer = serializer_class(data=payload)
                    self.assertFalse(serializer.is_valid())

            for valid_sp in (1, 2, 3, 5, 7, 9, 10, 12, 13):
                with self.subTest(serializer=serializer_class.__module__, sp=valid_sp):
                    if serializer_class is BacklogTaskSerializer:
                        payload = {"title": "Task", "sp": valid_sp}
                    else:
                        payload = {"title": "Task", "estimated_sp": valid_sp}
                    serializer = serializer_class(data=payload)
                    self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_both_task_serializers_accept_owner_alias_and_unassignment(self):
        user = get_user_model()(id=ObjectId(), username="assignee")
        for serializer_class in (BacklogTaskSerializer, ActiveSprintTaskSerializer):
            with self.subTest(serializer=serializer_class.__module__):
                serializer = serializer_class(
                    data={"title": "Task", "owner": str(user.pk)}
                )
                queryset = Mock(spec=["get"])
                queryset.get.return_value = user
                serializer.fields["owner_id"].queryset = queryset

                self.assertTrue(serializer.is_valid(), serializer.errors)
                self.assertIs(serializer.validated_data["owner"], user)

                clear_serializer = serializer_class(
                    data={"title": "Task", "owner": ""}
                )
                self.assertTrue(clear_serializer.is_valid(), clear_serializer.errors)
                self.assertIsNone(clear_serializer.validated_data["owner"])

    def test_assignee_list_syncs_mongo_users_to_task_user_ids(self):
        user_id = ObjectId()
        document = {
            "_id": user_id,
            "username": "jordan",
            "email": "jordan@example.com",
            "first_name": "Jordan",
            "last_name": "Lee",
            "role": "team_lead",
        }
        with patch("AppCore.task_assignees.get_database") as get_database, patch(
            "AppCore.task_assignees.User.objects.db_manager"
        ) as db_manager, patch("AppCore.task_assignees.User.save"):
            get_database.return_value.users.find.return_value.sort.return_value = [
                document
            ]
            db_manager.return_value.filter.return_value.first.return_value = None

            assignees = list_task_assignees(BacklogUserSerializer)

        self.assertEqual(len(assignees), 1)
        self.assertEqual(assignees[0]["id"], str(user_id))
        self.assertEqual(assignees[0]["name"], "Jordan Lee")
        self.assertEqual(assignees[0]["role"], "team_lead")


@override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
class PeopleInvitationRevokeTests(SimpleTestCase):
    @patch("AppCore.People.views.get_database")
    def test_all_roles_can_revoke_invitations(self, get_database):
        database = get_database.return_value
        database.team_invitations.count_documents.return_value = 2
        for role, email in (
            ("admin", "admin@example.com"),
            ("team_lead", "lead@example.com"),
            ("user", "member@example.com"),
        ):
            with self.subTest(role=role):
                client = APIClient()
                client.force_authenticate(user=MongoUser.from_document(
                    {
                        "_id": ObjectId(),
                        "username": role,
                        "email": email,
                        "role": role,
                    }
                ))
                response = client.delete(
                    "/api/people/invitations/person%40example.com/"
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.json(),
                    {
                        "message": "Invitation for person@example.com revoked",
                        "pendingInvitations": 2,
                    },
                )

        self.assertEqual(database.team_invitations.delete_one.call_count, 3)
        database.team_invitations.delete_one.assert_called_with(
            {"email": "person@example.com"}
        )
        count_filter = database.team_invitations.count_documents.call_args.args[0]
        self.assertIn("expires_at", count_filter)
        self.assertEqual(count_filter["accepted_at"], {"$exists": False})

    @patch("AppCore.People.views.get_database")
    def test_all_roles_can_add_people(self, get_database):
        database = get_database.return_value
        database.users.find_one.return_value = None
        database.users.insert_one.return_value.inserted_id = ObjectId()

        for role, email in (
            ("admin", "admin@example.com"),
            ("team_lead", "lead@example.com"),
            ("user", "member@example.com"),
        ):
            with self.subTest(role=role):
                client = APIClient()
                client.force_authenticate(user=MongoUser.from_document(
                    {
                        "_id": ObjectId(),
                        "username": role,
                        "email": email,
                        "role": role,
                    }
                ))
                response = client.post(
                    "/api/people/",
                    {"email": f"new-{role}@example.com", "role": "user"},
                    format="json",
                )
                self.assertEqual(response.status_code, 201)

        self.assertEqual(database.users.insert_one.call_count, 3)


class HealthCheckTests(SimpleTestCase):
    @patch("AppCore.views.views.ping_database")
    def test_root_returns_backend_status(self, _ping_database):
        response = self.client.get("/")
        _ping_database.assert_called_once()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "ok", "message": "NexusApp backend is running"},
        )

    @patch(
        "AppCore.views.views.ping_database",
        side_effect=PyMongoError("offline"),
    )
    def test_root_reports_unavailable_mongodb(self, _ping_database):
        response = self.client.get("/")
        _ping_database.assert_called_once()

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json(),
            {"status": "error", "message": "MongoDB is unavailable"},
        )


@override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
class FrontendApiRouteTests(SimpleTestCase):
    def test_frontend_api_routes_are_registered(self):
        object_id = "507f1f77bcf86cd799439011"
        paths = (
            "/api/auth/login/",
            "/api/auth/signup/",
            "/api/auth/me/",
            "/api/auth/logout/",
            "/api/auth/sessions/",
            "/api/auth/google/",
            "/api/auth/profile/",
            "/api/auth/profile/change-password/",
            "/api/auth/admin-chat/",
            "/api/auth/admin-chat/read/",
            "/api/auth/admin-chat/unread/",
            "/api/profile/change-password/",
            "/api/change-password/",
            "/api/inbox/",
            "/api/inbox/settings/",
            "/api/inbox/mark-all-read/",
            "/api/inbox/bulk/",
            "/api/backlog/tasks/",
            "/api/backlog/users/",
            f"/api/backlog/tasks/{object_id}/",
            f"/api/backlog/tasks/{object_id}/move/",
            f"/api/backlog/tasks/{object_id}/comments/",
            f"/api/backlog/tasks/{object_id}/comments/1712345678901/",
            "/api/backlog/tasks/batch/",
            "/api/backlog/sprints/",
            f"/api/backlog/sprints/{object_id}/",
            f"/api/backlog/sprints/{object_id}/start/",
            f"/api/backlog/sprints/{object_id}/complete/",
            "/api/backlog/health/",
            "/api/reporting/eod-reports/",
            "/api/reporting/eod-reports/import/",
            "/api/reporting/eod-reports/preview-import/",
            f"/api/reporting/eod-reports/{object_id}/",
            "/api/reporting/eod-comments/",
            "/api/reporting/eod-options/",
        )
        for path in paths:
            with self.subTest(path=path):
                self.assertIsNotNone(resolve(path))

    def test_google_auth_reports_unconfigured_provider_without_a_404(self):
        response = self.client.post("/api/auth/google/", data={}, content_type="application/json")

        self.assertEqual(response.status_code, 501)
        self.assertIn("not configured", response.json()["error"])

    @patch("AppCore.Inbox.views.get_database")
    def test_empty_inbox_returns_success_instead_of_route_not_found(self, get_database):
        get_database.return_value.notifications.find.return_value.sort.return_value = []
        user = MongoUser.from_document(
            {
                "_id": ObjectId(),
                "username": "inbox_user",
                "email": "admin@example.com",
                "role": "admin",
            }
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/inbox/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    @patch("AppCore.Inbox.views.get_database")
    def test_inbox_message_creates_recipient_notification_and_sender_copy(self, get_database):
        sender_id = ObjectId()
        recipient_id = ObjectId()
        recipient_notification_id = ObjectId()
        sender_notification_id = ObjectId()
        database = get_database.return_value
        database.users.find_one.return_value = {
            "_id": recipient_id,
            "first_name": "Recipient",
            "last_name": "Member",
            "username": "recipient",
            "email": "recipient@example.com",
        }
        database.notifications.insert_one.side_effect = [
            Mock(inserted_id=recipient_notification_id),
            Mock(inserted_id=sender_notification_id),
        ]
        user = MongoUser.from_document(
            {
                "_id": sender_id,
                "username": "sender",
                "email": "sender@example.com",
                "role": "admin",
            }
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/inbox/",
            {
                "recipient_email": "recipient@example.com",
                "title": "A mention",
                "description": "Hello @recipient",
                "type": "mention",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["id"], str(sender_notification_id))
        inserted_recipient, inserted_sender = [
            call.args[0]
            for call in database.notifications.insert_one.call_args_list
        ]
        self.assertEqual(inserted_recipient["user_id"], str(recipient_id))
        self.assertTrue(inserted_recipient["unread"])
        self.assertFalse(inserted_recipient["isSent"])
        self.assertTrue(inserted_recipient["mentioned"])
        self.assertEqual(inserted_recipient["author"], "sender")
        self.assertEqual(inserted_recipient["recipient_name"], "Recipient Member")
        self.assertEqual(inserted_recipient["recipient_email"], "recipient@example.com")
        self.assertEqual(inserted_sender["user_id"], str(sender_id))
        self.assertFalse(inserted_sender["unread"])
        self.assertTrue(inserted_sender["isSent"])

    @patch("AppCore.Inbox.views.get_database")
    def test_inbox_message_requires_an_existing_recipient(self, get_database):
        database = get_database.return_value
        database.users.find_one.return_value = None
        user = MongoUser.from_document(
            {
                "_id": ObjectId(),
                "username": "sender",
                "email": "sender@example.com",
                "role": "admin",
            }
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/inbox/",
            {
                "recipient_email": "missing@example.com",
                "title": "A mention",
                "type": "mention",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        database.notifications.insert_one.assert_not_called()

    @patch("AppCore.Chat.views.get_database")
    def test_all_roles_can_view_chat_and_read_status(self, get_database):
        database = get_database.return_value
        database.chat_messages.find.return_value.sort.return_value = []
        database.chat_messages.count_documents.return_value = 0
        database.users.find.return_value = []

        for role in ("user", "admin", "team_lead"):
            with self.subTest(role=role):
                user = MongoUser.from_document(
                    {
                        "_id": ObjectId(),
                        "username": f"{role}_user",
                        "email": f"{role}@example.com",
                        "role": role,
                    }
                )
                client = APIClient()
                client.force_authenticate(user=user)

                history_response = client.get("/api/auth/admin-chat/")
                unread_response = client.get("/api/auth/admin-chat/unread/")
                read_response = client.post(
                    "/api/auth/admin-chat/read/",
                    {},
                    format="json",
                )

                self.assertEqual(history_response.status_code, 200)
                self.assertEqual(unread_response.status_code, 200)
                self.assertEqual(read_response.status_code, 200)

    @patch("AppCore.Chat.views.get_database")
    def test_all_roles_can_create_messages(self, get_database):
        database = get_database.return_value
        database.chat_messages.insert_one.return_value.inserted_id = ObjectId()
        database.users.find_one.return_value = {"username": "workspace_user"}
        for role in ("user", "team_lead", "admin"):
            with self.subTest(role=role):
                user = MongoUser.from_document(
                    {
                        "_id": ObjectId(),
                        "username": f"{role}_user",
                        "email": f"{role}@example.com",
                        "role": role,
                    }
                )
                client = APIClient()
                client.force_authenticate(user=user)

                response = client.post(
                    "/api/auth/admin-chat/",
                    {"content": "Hello"},
                    format="json",
                )

                self.assertEqual(response.status_code, 201)

        client = APIClient()
        client.force_authenticate(user=MongoUser.from_document(
            {
                "_id": ObjectId(),
                "username": "member",
                "email": "member@example.com",
                "role": "user",
            }
        ))
        edit_response = client.patch(
            "/api/auth/admin-chat/",
            {"content": "edited"},
            format="json",
        )
        delete_response = client.delete("/api/auth/admin-chat/")

        self.assertEqual(edit_response.status_code, 405)
        self.assertEqual(delete_response.status_code, 405)

    @patch("AppCore.Chat.views.get_database")
    def test_admin_can_view_chat_history_and_unread_count(self, get_database):
        user = MongoUser.from_document(
            {
                "_id": ObjectId(),
                "username": "admin_user",
                "email": "admin@example.com",
                "role": "admin",
            }
        )
        database = get_database.return_value
        database.chat_messages.find.return_value.sort.return_value = []
        database.chat_messages.count_documents.return_value = 2
        database.users.find.return_value = []
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/auth/admin-chat/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"messages": [], "unread_count": 2})
        database.chat_conversations.update_one.assert_called_once()

    @patch("AppCore.Chat.views.get_database")
    def test_admin_chat_serializes_sender_and_marks_messages_read(self, get_database):
        user = MongoUser.from_document(
            {
                "_id": ObjectId(),
                "username": "admin_user",
                "email": "admin@example.com",
                "role": "admin",
            }
        )
        sender_id = ObjectId()
        message_id = ObjectId()
        created_at = datetime.now(timezone.utc)
        database = get_database.return_value
        database.chat_messages.find.return_value.sort.return_value = [
            {
                "_id": message_id,
                "sender_id": sender_id,
                "content": "Hello",
                "created_at": created_at,
            }
        ]
        database.chat_messages.count_documents.side_effect = [1, 0]
        database.users.find.return_value = [
            {
                "_id": sender_id,
                "username": "other_admin",
                "first_name": "Other",
                "last_name": "Admin",
                "profile": {"photo": "data:image/png;base64,abc"},
            }
        ]
        client = APIClient()
        client.force_authenticate(user=user)

        history_response = client.get("/api/auth/admin-chat/")
        read_response = client.post("/api/auth/admin-chat/read/", {}, format="json")

        self.assertEqual(history_response.status_code, 200)
        message = history_response.json()["messages"][0]
        self.assertEqual(message["id"], str(message_id))
        self.assertEqual(message["sender"]["name"], "Other Admin")
        self.assertEqual(message["sender"]["photo"], "data:image/png;base64,abc")
        self.assertEqual(read_response.json()["unread_count"], 0)
        database.chat_messages.update_many.assert_called_once()

    @patch("AppCore.Chat.views.get_database")
    def test_admin_chat_validates_and_persists_messages(self, get_database):
        user = MongoUser.from_document(
            {
                "_id": ObjectId(),
                "username": "admin_user",
                "email": "admin@example.com",
                "role": "admin",
            }
        )
        database = get_database.return_value
        inserted_id = ObjectId()
        database.chat_messages.insert_one.return_value.inserted_id = inserted_id
        database.users.find_one.return_value = {
            "_id": user.id,
            "username": user.username,
            "first_name": "Team Lead",
        }
        client = APIClient()
        client.force_authenticate(user=user)

        empty_response = client.post(
            "/api/auth/admin-chat/",
            {"content": "  "},
            format="json",
        )
        long_response = client.post(
            "/api/auth/admin-chat/",
            {"content": "x" * 2001},
            format="json",
        )
        response = client.post(
            "/api/auth/admin-chat/",
            {"content": "  Hello team  "},
            format="json",
        )

        self.assertEqual(empty_response.status_code, 400)
        self.assertEqual(long_response.status_code, 400)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["message"]["content"], "Hello team")
        self.assertEqual(response.json()["message"]["id"], str(inserted_id))
        database.chat_messages.insert_one.assert_called_once()
    @patch("AppCore.Inbox.views.GridFSBucket")
    @patch("AppCore.Inbox.views.get_database")
    def test_reply_is_saved_to_selected_notification_with_authenticated_sender(
        self, get_database, _gridfs_bucket
    ):
        notification_id = ObjectId()
        user_id = ObjectId()
        user = MongoUser.from_document(
            {
                "_id": user_id,
                "username": "reply_author",
                "email": "admin@example.com",
                "role": "admin",
            }
        )
        notifications = get_database.return_value.notifications
        notifications.find_one.return_value = {"replies": []}
        notifications.update_one.return_value.matched_count = 1
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            f"/api/inbox/{notification_id}/replies/",
            {"text": "Reply for this conversation"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["author"], "reply_author")
        self.assertEqual(response.json()["sender_id"], str(user_id))
        update_filter, update_document = notifications.update_one.call_args.args
        self.assertEqual(
            update_filter["_id"]["$in"],
            [str(notification_id), notification_id],
        )
        self.assertEqual(update_document["$push"]["replies"]["text"], "Reply for this conversation")
        self.assertEqual(
            update_document["$push"]["replies"]["sender_id"],
            str(user_id),
        )

    @patch("AppCore.Inbox.views.get_database")
    def test_reply_cannot_be_added_to_another_users_notification(self, get_database):
        notification_id = ObjectId()
        user = MongoUser.from_document(
            {
                "_id": ObjectId(),
                "username": "reply_author",
                "email": "admin@example.com",
                "role": "admin",
            }
        )
        notifications = get_database.return_value.notifications
        notifications.find_one.return_value = None
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            f"/api/inbox/{notification_id}/replies/",
            {"text": "Not authorized"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 404)
        notifications.update_one.assert_not_called()

    @patch("AppCore.Inbox.views.get_database")
    def test_notification_settings_return_defaults_for_new_users(self, get_database):
        get_database.return_value.notification_settings.find_one.return_value = None
        user = MongoUser.from_document(
            {"_id": ObjectId(), "username": "inbox_user", "email": "inbox@example.com"}
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/inbox/settings/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["mentions"])


class MongoUserTests(SimpleTestCase):
    def test_user_is_authenticated_and_exposes_object_id(self):
        user_id = ObjectId()
        user = MongoUser.from_document(
            {
                "_id": user_id,
                "username": "nexus_user",
                "email": "user@example.com",
                "employee_id": "LUX-SD-CHN-007",
            }
        )

        self.assertEqual(user.id, user_id)
        self.assertTrue(user.is_authenticated)
        self.assertTrue(user.is_active)
        self.assertEqual(user.role, "user")
        self.assertEqual(user.employee_id, "LUX-SD-CHN-007")

    def test_django_password_hasher_works_without_relational_auth_models(self):
        encoded = make_password("correct-horse-battery-staple")

        self.assertNotEqual(encoded, "correct-horse-battery-staple")
        self.assertTrue(check_password("correct-horse-battery-staple", encoded))


class EmailConfigurationCheckTests(SimpleTestCase):
    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_HOST="",
        EMAIL_USE_TLS=True,
        EMAIL_USE_SSL=False,
        DEFAULT_FROM_EMAIL="verified@company.test",
        EMAIL_HOST_USER="",
        EMAIL_HOST_PASSWORD="",
    )
    def test_warns_when_smtp_host_is_missing(self):
        issues = check_email_configuration(None)

        self.assertIn("AppCore.W001", {issue.id for issue in issues})

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_HOST="smtp.gmail.com",
        EMAIL_USE_TLS=True,
        EMAIL_USE_SSL=False,
        DEFAULT_FROM_EMAIL="your-account@gmail.com",
        EMAIL_HOST_USER="",
        EMAIL_HOST_PASSWORD="",
    )
    def test_warns_when_gmail_app_password_is_not_configured(self):
        issues = check_email_configuration(None)

        issue_ids = {issue.id for issue in issues}
        self.assertIn("AppCore.W004", issue_ids)
        self.assertIn("AppCore.W002", issue_ids)

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_HOST="smtp.company.test",
        EMAIL_USE_TLS=True,
        EMAIL_USE_SSL=True,
        DEFAULT_FROM_EMAIL="verified@company.test",
        EMAIL_HOST_USER="",
        EMAIL_HOST_PASSWORD="",
    )
    def test_reports_mutually_exclusive_tls_modes(self):
        issues = check_email_configuration(None)

        self.assertIn("AppCore.E001", {issue.id for issue in issues})

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_HOST="smtp.company.test",
        EMAIL_USE_TLS=True,
        EMAIL_USE_SSL=False,
        DEFAULT_FROM_EMAIL="verified@company.test",
        EMAIL_HOST_USER="mailer",
        EMAIL_HOST_PASSWORD="secret",
    )
    def test_valid_smtp_settings_have_no_configuration_warnings(self):
        self.assertEqual(check_email_configuration(None), [])


class MongoAuthenticationTests(SimpleTestCase):
    @patch("AppCore.Auth.authentication.get_database")
    def test_bearer_token_authenticates_mongo_user(self, get_database):
        user_id = ObjectId()
        database = get_database.return_value
        database.tokens.find_one.return_value = {"user_id": str(user_id)}
        database.users.find_one.return_value = {
            "_id": user_id,
            "username": "nexus_user",
            "email": "user@example.com",
            "is_active": True,
        }
        request = APIRequestFactory().get(
            "/api/auth/profile/",
            HTTP_AUTHORIZATION="Bearer access-token",
        )

        user, token = MongoTokenAuthentication().authenticate(request)

        self.assertEqual(user.id, user_id)
        self.assertEqual(token, "access-token")
        database.tokens.find_one.assert_called_once()
        database.users.find_one.assert_called_once_with(
            {"_id": user_id, "is_active": True}
        )


class LoginRememberMeTests(SimpleTestCase):
    @patch("AppCore.Auth.views.login.get_client_ip", return_value="127.0.0.1")
    @patch("AppCore.Auth.views.login.create_token", return_value="access-token")
    @patch("AppCore.Auth.views.login.check_password", return_value=True)
    @patch("AppCore.Auth.views.login.get_database")
    def test_remember_me_extends_login_token_lifetime(
        self, get_database, _check_password, create_token, _get_client_ip
    ):
        user_id = ObjectId()
        get_database.return_value.users.find_one.return_value = {
            "_id": user_id,
            "username": "remember_user",
            "email": "remember@example.com",
            "password_hash": "hashed-password",
            "is_active": True,
        }
        client = APIClient()

        for remember_me, expected_days in ((False, 14), (True, 30)):
            with self.subTest(remember_me=remember_me):
                response = client.post(
                    "/api/auth/login/",
                    {
                        "email": "remember@example.com",
                        "password": "correct-password",
                        "remember_me": remember_me,
                    },
                    format="json",
                )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    create_token.call_args.kwargs["expires_in_days"],
                    expected_days,
                )


class SignupApiTests(SimpleTestCase):
    @patch("AppCore.Auth.views.signup.get_database")
    def test_signup_returns_user_and_mongodb_backed_bearer_token(self, get_database):
        user_id = ObjectId()
        database = get_database.return_value
        database.users.find_one.return_value = None
        database.users.insert_one.return_value.inserted_id = user_id

        response = self.client.post(
            "/api/auth/signup/",
            data=json.dumps(
                {
                    "fullName": "Nexus User",
                    "email": "USER@example.com",
                    "employee_id": "lux-sd-chn-007",
                    "password": "correct-horse",
                    "confirm_password": "correct-horse",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["user"]["id"], str(user_id))
        self.assertEqual(response.json()["user"]["email"], "user@example.com")
        self.assertEqual(response.json()["user"]["employee_id"], "LUX-SD-CHN-007")
        self.assertTrue(response.json()["token"])
        self.assertNotIn("password_hash", response.json()["user"])
        saved_user = database.users.insert_one.call_args.args[0]
        self.assertEqual(saved_user["employee_id"], "LUX-SD-CHN-007")
        self.assertEqual(saved_user["employee_id_sequence"], 7)
        database.tokens.insert_one.assert_called_once()

    @patch("AppCore.Auth.views.signup._get_valid_invitation")
    @patch("AppCore.Auth.views.signup.get_database")
    def test_signup_with_invitation_uses_the_invited_role(
        self, get_database, get_valid_invitation
    ):
        user_id = ObjectId()
        token = "a" * 43
        database = get_database.return_value
        database.users.find_one.return_value = None
        database.team_invitations.find_one_and_update.return_value = {
            "email": "lead@example.com",
            "role": "team_lead",
        }
        database.users.insert_one.return_value.inserted_id = user_id
        get_valid_invitation.return_value = {
            "email": "lead@example.com",
            "role": "team_lead",
        }

        response = self.client.post(
            "/api/auth/signup/",
            data=json.dumps(
                {
                    "fullName": "Team Lead",
                    "email": "lead@example.com",
                    "employee_id": "LUX-SD-BNG-008",
                    "password": "correct-horse",
                    "confirm_password": "correct-horse",
                    "invitation_token": token,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["user"]["role"], "team_lead")
        self.assertTrue(response.json()["invitation_accepted"])
        self.assertEqual(database.users.insert_one.call_args.args[0]["role"], "team_lead")

    @patch("AppCore.Auth.views.signup.get_database")
    def test_signup_rejects_employee_id_with_an_unsupported_branch(self, get_database):
        response = self.client.post(
            "/api/auth/signup/",
            data=json.dumps(
                {
                    "fullName": "Nexus User",
                    "email": "user@example.com",
                    "employee_id": "LUX-SD-MAA-007",
                    "password": "correct-horse",
                    "confirm_password": "correct-horse",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("employee_id", response.json()["errors"])
        get_database.assert_not_called()

    @patch("AppCore.Auth.views.signup.get_database")
    def test_signup_rejects_zero_employee_number(self, get_database):
        response = self.client.post(
            "/api/auth/signup/",
            data=json.dumps(
                {
                    "fullName": "Nexus User",
                    "email": "user@example.com",
                    "employee_id": "LUX-SD-CHN-000",
                    "password": "correct-horse",
                    "confirm_password": "correct-horse",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("employee_id", response.json()["errors"])
        get_database.assert_not_called()

    @patch("AppCore.Auth.views.signup.get_database")
    def test_signup_rejects_four_digit_employee_number(self, get_database):
        response = self.client.post(
            "/api/auth/signup/",
            data=json.dumps(
                {
                    "fullName": "Nexus User",
                    "email": "user@example.com",
                    "employee_id": "LUX-SD-CHN-0007",
                    "password": "correct-horse",
                    "confirm_password": "correct-horse",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("employee_id", response.json()["errors"])
        get_database.assert_not_called()

    @patch("AppCore.Auth.views.signup.get_database")
    def test_signup_rejects_employee_number_already_used_by_another_branch(
        self, get_database
    ):
        database = get_database.return_value
        database.users.find_one.side_effect = [
            None,
            {"employee_id": "LUX-SD-CHN-007", "employee_id_sequence": 7},
        ]

        response = self.client.post(
            "/api/auth/signup/",
            data=json.dumps(
                {
                    "fullName": "Nexus User",
                    "email": "user@example.com",
                    "employee_id": "LUX-SD-BNG-007",
                    "password": "correct-horse",
                    "confirm_password": "correct-horse",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("employee_id", response.json()["errors"])
        database.users.insert_one.assert_not_called()


@override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
class TeamInvitationApiTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_id = ObjectId()
        self.admin = MongoUser(
            id=self.user_id,
            username="nexus_admin",
            email="admin@example.com",
            first_name="Admin",
            last_name="",
            role="admin",
        )
        self.invitee = MongoUser(
            id=ObjectId(),
            username="invited_user",
            email="invitee@example.com",
            first_name="Invitee",
            last_name="",
            role="user",
        )
        self.client.force_authenticate(user=self.admin)

    @patch("AppCore.Auth.views.invitations.send_mail", return_value=1)
    @patch("AppCore.Auth.views.invitations.get_database")
    def test_invitation_email_contains_single_use_accept_link(
        self, get_database, send_mail
    ):
        database = get_database.return_value
        response = self.client.post(
            "/api/auth/invitations/",
            {"email": "new.user@example.com", "role": "team_lead"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["role"], "team_lead")
        saved_invitation = database.team_invitations.update_one.call_args.args[1]["$set"]
        self.assertEqual(saved_invitation["email"], "new.user@example.com")
        self.assertEqual(len(saved_invitation["token_hash"]), 64)
        sent_message = send_mail.call_args.kwargs["message"]
        self.assertIn("/accept-invite?token=", sent_message)
        self.assertNotIn(saved_invitation["token_hash"], sent_message)

    @patch("AppCore.Auth.views.invitations.get_database")
    def test_accept_invitation_assigns_role_only_to_invited_email(self, get_database):
        token = "a" * 43
        database = get_database.return_value
        database.team_invitations.find_one.return_value = {
            "email": self.invitee.email,
            "role": "team_lead",
        }
        database.team_invitations.find_one_and_update.return_value = {
            "email": self.invitee.email,
            "role": "team_lead",
        }
        database.users.find_one.return_value = {
            "_id": self.invitee.id,
            "username": self.invitee.username,
            "email": self.invitee.email,
            "first_name": "Invitee",
            "role": "team_lead",
        }
        self.client.force_authenticate(user=self.invitee)

        response = self.client.post(
            "/api/auth/invitations/accept/",
            {"token": token},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["role"], "team_lead")
        database.users.update_one.assert_called_once()

    @patch("AppCore.Auth.views.invitations.get_database")
    def test_accept_invitation_rejects_a_different_signed_in_email(self, get_database):
        database = get_database.return_value
        database.team_invitations.find_one.return_value = {
            "email": "someone-else@example.com",
            "role": "user",
        }

        response = self.client.post(
            "/api/auth/invitations/accept/",
            {"token": "a" * 43},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        database.team_invitations.find_one_and_update.assert_not_called()
        database.users.update_one.assert_not_called()

    @patch("AppCore.Auth.views.invitations.send_mail", return_value=1)
    @patch("AppCore.Auth.views.invitations.get_database")
    def test_team_lead_can_invite_an_elevated_role(
        self, get_database, send_mail
    ):
        team_lead = MongoUser(
            id=ObjectId(),
            username="team_lead",
            email="lead@example.com",
            first_name="Lead",
            last_name="",
            role="team_lead",
        )
        self.client.force_authenticate(user=team_lead)

        response = self.client.post(
            "/api/auth/invitations/",
            {"email": "another.lead@example.com", "role": "team_lead"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["role"], "team_lead")
        invitation = get_database.return_value.team_invitations.update_one.call_args.args[1]["$set"]
        self.assertEqual(invitation["role"], "team_lead")
        send_mail.assert_called_once()

    @patch("AppCore.Auth.views.invitations.send_mail", return_value=1)
    @patch("AppCore.Auth.views.invitations.get_database")
    def test_member_can_invite_a_team_lead(self, get_database, _send_mail):
        member = MongoUser(
            id=ObjectId(),
            username="member",
            email="member@example.com",
            first_name="Member",
            last_name="",
            role="user",
        )
        self.client.force_authenticate(user=member)

        response = self.client.post(
            "/api/auth/invitations/",
            {"email": "new.lead@example.com", "role": "team_lead"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["role"], "team_lead")
        invitation = get_database.return_value.team_invitations.update_one.call_args.args[1]["$set"]
        self.assertEqual(invitation["role"], "team_lead")

    @patch("AppCore.Auth.views.invitations.send_mail", return_value=1)
    @patch("AppCore.Auth.views.invitations.get_database")
    def test_team_lead_can_invite_a_member(self, get_database, _send_mail):
        team_lead = MongoUser(
            id=ObjectId(),
            username="team_lead",
            email="lead@example.com",
            first_name="Lead",
            last_name="",
            role="team_lead",
        )
        self.client.force_authenticate(user=team_lead)

        response = self.client.post(
            "/api/auth/invitations/",
            {"email": "new.member@example.com", "role": "user"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["role"], "user")
        invitation = get_database.return_value.team_invitations.update_one.call_args.args[1]["$set"]
        self.assertEqual(invitation["role"], "user")

    @patch("AppCore.Auth.views.invitations.send_mail", side_effect=OSError("SMTP offline"))
    @patch("AppCore.Auth.views.invitations.get_database")
    def test_email_failure_is_reported_and_pending_invite_is_removed(
        self, get_database, _send_mail
    ):
        database = get_database.return_value
        response = self.client.post(
            "/api/auth/invitations/",
            {"email": "new.user@example.com", "role": "user"},
            format="json",
        )

        self.assertEqual(response.status_code, 503)
        self.assertIn("email could not be sent", response.json()["detail"])
        database.team_invitations.delete_one.assert_called_once()


class MongoProfileApiTests(SimpleTestCase):
    def setUp(self):
        self.user_id = ObjectId()
        self.user = MongoUser(
            id=self.user_id,
            username="nexus_user",
            email="user@example.com",
            first_name="Nexus User",
            last_name="",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch("AppCore.Auth.views.profile.get_database")
    def test_profile_patch_persists_profile_fields(self, get_database):
        database = get_database.return_value
        database.users.find_one.return_value = {
            "_id": self.user_id,
            "username": self.user.username,
            "email": self.user.email,
            "employee_id": "LUX-SD-CHN-007",
            "first_name": self.user.first_name,
            "profile": {
                "location": "Portland, Oregon",
                "jobTitle": "Engineer",
            },
        }

        response = self.client.patch(
            "/api/auth/profile/",
            {"location": "Portland, Oregon", "jobTitle": "Engineer"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["location"], "Portland, Oregon")
        self.assertEqual(response.data["jobTitle"], "Engineer")
        self.assertEqual(response.data["employee_id"], "LUX-SD-CHN-007")
        updates = database.users.update_one.call_args.args[1]["$set"]
        self.assertEqual(updates["profile.location"], "Portland, Oregon")
        self.assertEqual(updates["profile.jobTitle"], "Engineer")

    @override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
    @patch("AppCore.Auth.views.profile.get_database")
    def test_profile_patch_rejects_employee_id_changes(self, get_database):
        response = self.client.patch(
            "/api/auth/profile/",
            {"employee_id": "LUX-SD-HYD-0009", "jobTitle": "Engineer"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("Only admins", response.data["error"])
        get_database.return_value.users.update_one.assert_not_called()

    @override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
    @patch("AppCore.Auth.views.profile.get_database")
    def test_configured_admin_can_update_employee_id(self, get_database):
        admin = MongoUser(
            id=self.user_id,
            username="nexus_admin",
            email="admin@example.com",
            first_name="Admin",
            last_name="",
            role="admin",
        )
        self.client.force_authenticate(user=admin)
        database = get_database.return_value
        database.users.find_one.side_effect = [
            None,
            {
                "_id": self.user_id,
                "username": admin.username,
                "email": admin.email,
                "employee_id": "LUX-SD-HYD-009",
                "first_name": admin.first_name,
            },
        ]

        response = self.client.patch(
            "/api/auth/profile/",
            {"employee_id": "lux-sd-hyd-009"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["employee_id"], "LUX-SD-HYD-009")
        self.assertTrue(response.data["can_edit_employee_id"])
        updates = database.users.update_one.call_args.args[1]["$set"]
        self.assertEqual(updates["employee_id"], "LUX-SD-HYD-009")
        self.assertEqual(updates["employee_id_sequence"], 9)

    @override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
    @patch("AppCore.Auth.views.profile.get_database")
    def test_profile_admin_cannot_assign_zero_employee_number(self, get_database):
        admin = MongoUser(
            id=self.user_id,
            username="nexus_admin",
            email="admin@example.com",
            first_name="Admin",
            last_name="",
            role="admin",
        )
        self.client.force_authenticate(user=admin)

        response = self.client.patch(
            "/api/auth/profile/",
            {"employee_id": "LUX-SD-CHN-000"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("001 through LUX-SD-CHN-999", response.data["error"])
        get_database.assert_not_called()

    @override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
    @patch("AppCore.Auth.views.profile.get_database")
    def test_admin_cannot_assign_employee_number_already_in_use(self, get_database):
        admin = MongoUser(
            id=self.user_id,
            username="nexus_admin",
            email="admin@example.com",
            first_name="Admin",
            last_name="",
            role="admin",
        )
        self.client.force_authenticate(user=admin)
        database = get_database.return_value
        database.users.find_one.return_value = {
            "_id": ObjectId(),
            "employee_id": "LUX-SD-CHN-009",
        }

        response = self.client.patch(
            "/api/auth/profile/",
            {"employee_id": "LUX-SD-BNG-009"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("already assigned", response.data["error"])
        database.users.update_one.assert_not_called()

    @patch("AppCore.Auth.views.profile.get_database")
    def test_profile_avatar_upload_is_persisted_in_mongodb(self, get_database):
        database = get_database.return_value
        image = b"\x89PNG\r\n\x1a\nprofile-image"

        response = self.client.post(
            "/api/auth/profile/avatar/",
            {
                "avatar": SimpleUploadedFile(
                    "profile.png",
                    image,
                    content_type="image/png",
                )
            },
            format="multipart",
        )

        expected_photo = (
            "data:image/png;base64,"
            + base64.b64encode(image).decode("ascii")
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["photo"], expected_photo)
        updates = database.users.update_one.call_args.args[1]["$set"]
        self.assertEqual(updates["profile.photo"], expected_photo)


@override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
class RolePermissionTests(SimpleTestCase):
    def test_role_permission_policy_restricts_member_sprint_and_task_creation(self):
        for role in ("admin", "team_lead", "user"):
            user = MongoUser(
                id=ObjectId(),
                username=role,
                email=f"{role}@example.com",
                first_name=role,
                last_name="",
                role=role,
            )
            for permission in DEFAULT_ROLE_POLICIES[role]:
                with self.subTest(role=role, permission=permission):
                    if role == "user" and permission in {"manage_tasks", "manage_sprints"}:
                        self.assertFalse(has_role_permission(user, permission))
                    else:
                        self.assertTrue(has_role_permission(user, permission))

    def test_permissions_endpoint_returns_full_admin_policy(self):
        user = MongoUser(
            id=ObjectId(),
            username="admin",
            email="admin@example.com",
            first_name="Admin",
            last_name="",
            role="admin",
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/auth/permissions/")

        self.assertEqual(response.status_code, 200)
        for role in ("admin", "team_lead", "user"):
            self.assertEqual(
                response.data["policies"][role],
                DEFAULT_ROLE_POLICIES[role],
            )
        self.assertEqual(
            response.data["policies"]["admin"],
            response.data["policies"]["team_lead"],
        )
        self.assertFalse(response.data["policies"]["user"]["manage_tasks"])
        self.assertFalse(response.data["policies"]["user"]["manage_sprints"])

    def test_all_roles_can_access_tasks(self):
        view = type("TaskListView", (), {"role_capabilities": {"GET": "view_tasks"}})()
        for role in ("admin", "team_lead", "user"):
            request = APIRequestFactory().get("/api/tasks/")
            request.user = MongoUser(
                id=ObjectId(),
                username=role,
                email=f"{role}@example.com",
                first_name=role,
                last_name="",
                role=role,
            )
            with self.subTest(role=role):
                self.assertTrue(RoleCapabilityPermission().has_permission(request, view))

    def test_only_configured_admin_can_delete_sprints(self):
        permission = AdminOnlyDeletePermission()
        view = object()

        for role, email, expected in (
            ("admin", "admin@example.com", True),
            ("team_lead", "lead@example.com", False),
            ("user", "member@example.com", False),
            ("admin", "unconfigured@example.com", False),
        ):
            request = APIRequestFactory().delete("/api/backlog/sprints/test-id/")
            request.user = MongoUser(
                id=ObjectId(),
                username=role,
                email=email,
                first_name=role,
                last_name="",
                role=role,
            )
            with self.subTest(role=role, email=email):
                self.assertEqual(permission.has_permission(request, view), expected)

        read_request = APIRequestFactory().get("/api/backlog/sprints/test-id/")
        read_request.user = MongoUser(
            id=ObjectId(),
            username="member",
            email="member@example.com",
            first_name="Member",
            last_name="",
            role="user",
        )
        self.assertTrue(permission.has_permission(read_request, view))

    def test_team_lead_cannot_delete_sprints_through_either_api(self):
        client = APIClient()
        client.force_authenticate(
            user=MongoUser(
                id=ObjectId(),
                username="lead",
                email="lead@example.com",
                first_name="Team Lead",
                last_name="",
                role="team_lead",
            )
        )

        for path in (
            "/api/backlog/sprints/0123456789abcdef01234567/",
            "/api/all-sprints/sprints/0123456789abcdef01234567/",
        ):
            with self.subTest(path=path):
                response = client.delete(path)
                self.assertEqual(response.status_code, 403)

    def test_member_can_update_tasks_assigned_to_member(self):
        request = APIRequestFactory().put("/api/tasks/1/")
        request.user = MongoUser(
            id=ObjectId(),
            username="member",
            email="member@example.com",
            first_name="Member",
            last_name="",
            role="user",
        )
        view = type("TaskDetailView", (), {})()
        task = type(
            "Task",
            (),
            {"owner": type("Owner", (), {"email": "member@example.com"})()},
        )()
        permission = TaskDetailRolePermission()

        self.assertTrue(permission.has_permission(request, view))
        self.assertTrue(permission.has_object_permission(request, view, task))

    def test_role_module_permissions_match_workspace_policy(self):
        permission = RoleModulePermission()
        view = object()
        team_lead = MongoUser(
            id=ObjectId(),
            username="team_lead",
            email="lead@example.com",
            first_name="Team Lead",
            last_name="",
            role="team_lead",
        )
        member = MongoUser(
            id=ObjectId(),
            username="member",
            email="member@example.com",
            first_name="Member",
            last_name="",
            role="user",
        )

        admin = MongoUser(
            id=ObjectId(),
            username="admin",
            email="admin@example.com",
            first_name="Admin",
            last_name="",
            role="admin",
        )
        roles = (team_lead, member, admin)
        paths = (
            "/api/portfolios/",
            "/api/people/",
            "/api/auth/invitations/",
            "/api/reporting/eod-reports/",
            "/api/profile/",
        )
        for role_user in roles:
            for path in paths:
                request = APIRequestFactory().get(path)
                request.user = role_user
                with self.subTest(role=role_user.role, path=path):
                    self.assertTrue(permission.has_permission(request, view))

    def test_configured_admin_cannot_edit_the_fixed_policy(self):
        client = APIClient()
        client.force_authenticate(
            user=MongoUser(
                id=ObjectId(),
                username="admin",
                email="admin@example.com",
                first_name="Admin",
                last_name="",
                role="admin",
            )
        )

        response = client.put(
            "/api/auth/permissions/",
            {"policies": DEFAULT_ROLE_POLICIES},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["detail"],
            "Role access is fixed by the workspace policy.",
        )

    def test_unconfigured_admin_is_treated_as_member(self):
        unconfigured_admin = MongoUser(
            id=ObjectId(),
            username="other_admin",
            email="not-configured@example.com",
            first_name="Other",
            last_name="Admin",
            role="admin",
        )

        self.assertEqual(get_effective_role(unconfigured_admin), "user")
        self.assertTrue(has_role_permission(unconfigured_admin, "manage_portfolios"))

    def test_non_admin_cannot_change_role_permissions(self):
        client = APIClient()
        client.force_authenticate(
            user=MongoUser(
                id=ObjectId(),
                username="member",
                email="member@example.com",
                first_name="Member",
                last_name="",
                role="user",
            )
        )

        response = client.put(
            "/api/auth/permissions/",
            {"policies": DEFAULT_ROLE_POLICIES},
            format="json",
        )

        self.assertEqual(response.status_code, 403)


@override_settings(NEXUS_ADMIN_EMAILS=frozenset({"owner@example.com"}))
class MongoSerializerTests(SimpleTestCase):
    @patch("AppCore.views.views.get_database")
    def test_future_project_dates_are_saved(self, get_database):
        database = get_database.return_value
        database.projects.insert_one.return_value.inserted_id = ObjectId()
        database.users.find_one.return_value = None
        database.allocations.find.return_value.sort.return_value = []
        user = MongoUser.from_document(
            {
                "_id": ObjectId(),
                "username": "project_owner",
                "email": "owner@example.com",
                "role": "admin",
            }
        )
        client = APIClient()
        client.force_authenticate(user=user)
        start_date = django_timezone.localdate() + timedelta(days=1)
        end_date = start_date + timedelta(days=1)

        response = client.post(
            "/api/resourcing/projects/",
            {
                "name": "Roadmap",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        database.projects.insert_one.assert_called_once()
        saved_project = database.projects.insert_one.call_args.args[0]
        self.assertEqual(saved_project["start_date"].date(), start_date)
        self.assertEqual(saved_project["end_date"].date(), end_date)

    def test_project_dates_must_be_ordered(self):
        start_date = (django_timezone.localdate() + timedelta(days=1)).isoformat()
        end_date = (django_timezone.localdate() + timedelta(days=2)).isoformat()
        serializer = ProjectInputSerializer(
            data={
                "name": "Roadmap",
                "start_date": end_date,
                "end_date": start_date,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("end_date", serializer.errors)

    def test_project_start_date_cannot_be_in_the_past(self):
        yesterday = (django_timezone.localdate() - timedelta(days=1)).isoformat()
        serializer = ProjectInputSerializer(
            data={
                "name": "Roadmap",
                "start_date": yesterday,
                "end_date": django_timezone.localdate().isoformat(),
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("start_date", serializer.errors)

    def test_project_dates_accept_today_and_future_ranges(self):
        today = django_timezone.localdate()
        ranges = (
            (today, today),
            (today, today + timedelta(days=1)),
            (today + timedelta(days=1), today + timedelta(days=2)),
        )
        for start_date, end_date in ranges:
            with self.subTest(start_date=start_date, end_date=end_date):
                serializer = ProjectInputSerializer(
                    data={
                        "name": "Roadmap",
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat(),
                    }
                )

                self.assertTrue(serializer.is_valid(), serializer.errors)


@override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
class ProjectDataAccessTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(
            user=MongoUser(
                id=ObjectId(),
                username="member",
                email="member@example.com",
                first_name="Project",
                last_name="Member",
                role="user",
            )
        )
        self.project_id = ObjectId()
        self.project = {
            "_id": self.project_id,
            "created_by": ObjectId(),
            "name": "Private resourcing project",
        }

    @patch("AppCore.project_access.get_database")
    @patch("AppCore.Projects.views.views.get_projects_collection")
    @patch("AppCore.Projects.views.views.get_database")
    def test_create_project_persists_valid_selected_members(
        self, get_database, get_projects_collection, get_access_database
    ):
        admin_id = ObjectId()
        member_id = ObjectId()
        self.client.force_authenticate(
            user=MongoUser(
                id=admin_id,
                username="admin",
                email="admin@example.com",
                first_name="App",
                last_name="Admin",
                role="admin",
            )
        )
        database = get_database.return_value
        get_access_database.return_value = database
        database.users.find.return_value = [{"_id": member_id}]
        collection = get_projects_collection.return_value
        collection.find_one.return_value = None
        collection.insert_one.return_value.inserted_id = self.project_id

        response = self.client.post(
            "/api/projects/",
            {"name": "Member project", "members": [str(member_id)]},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["members"], [str(member_id)])
        self.assertEqual(
            collection.insert_one.call_args.args[0]["members"],
            [str(member_id)],
        )
        stored_project = dict(collection.insert_one.call_args.args[0])
        stored_project["_id"] = self.project_id
        collection.find.return_value.sort.return_value = [stored_project]
        database.projects.find.return_value = [stored_project]

        self.client.force_authenticate(
            user=MongoUser(
                id=member_id,
                username="project_member",
                email="project_member@example.com",
                first_name="Project",
                last_name="Member",
                role="user",
            )
        )
        list_response = self.client.get("/api/projects/")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual([project["id"] for project in list_response.data], [str(self.project_id)])

    @patch("AppCore.project_access.get_database")
    @patch("AppCore.views.views.get_database")
    def test_foreign_resourcing_project_and_allocation_return_forbidden(
        self, get_view_database, get_access_database
    ):
        database = get_view_database.return_value
        get_access_database.return_value = database
        database.projects.find_one.return_value = self.project
        database.projects.find.return_value = [self.project]
        allocation_id = ObjectId()
        database.allocations.find_one.return_value = {
            "_id": allocation_id,
            "project": self.project_id,
        }

        project_response = self.client.get(
            f"/api/auth/resourcing/projects/{self.project_id}/"
        )
        allocation_response = self.client.get(
            f"/api/auth/resourcing/allocations/{allocation_id}/"
        )

        self.assertEqual(project_response.status_code, 403)
        self.assertEqual(allocation_response.status_code, 403)

    def test_project_dates_reject_invalid_or_empty_values(self):
        for start_date, end_date in (("", ""), ("2026-02-30", "2026-03-01")):
            with self.subTest(start_date=start_date, end_date=end_date):
                serializer = ProjectInputSerializer(
                    data={
                        "name": "Roadmap",
                        "start_date": start_date,
                        "end_date": end_date,
                    }
                )

                self.assertFalse(serializer.is_valid())


class ChangePasswordBackendTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_id = ObjectId()
        self.mock_user = {
            "_id": self.user_id,
            "username": "siva_dev",
            "email": "siva@example.com",
            "password_hash": make_password("OldPassword123!"),
            "first_name": "Siva",
            "last_name": "Kumar",
            "role": "user",
            "is_active": True,
        }
        self.client.force_authenticate(
            user=MongoUser.from_document(self.mock_user)
        )

    @patch("AppCore.Auth.views.change_password.get_database")
    def test_change_password_success(self, mock_get_database):
        mock_db = mock_get_database.return_value
        mock_db.users.find_one.return_value = self.mock_user.copy()
        mock_db.auth_user.find_one.return_value = None

        response = self.client.post(
            "/api/profile/change-password/",
            {
                "email": "siva@example.com",
                "current_password": "OldPassword123!",
                "new_password": "NewSecretPassword123!",
                "confirm_password": "NewSecretPassword123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        json_resp = response.json()
        self.assertTrue(json_resp.get("success"))
        self.assertIn("Password changed successfully", json_resp.get("message", ""))
        mock_db.users.update_one.assert_called_once()
        args, kwargs = mock_db.users.update_one.call_args
        self.assertEqual(args[0], {"_id": self.user_id})
        updated_hash = args[1]["$set"]["password_hash"]
        self.assertTrue(check_password("NewSecretPassword123!", updated_hash))

    @patch("AppCore.Auth.views.change_password.get_database")
    def test_change_password_invalid_current_password(self, mock_get_database):
        mock_db = mock_get_database.return_value
        mock_db.users.find_one.return_value = self.mock_user.copy()

        response = self.client.post(
            "/api/profile/change-password/",
            {
                "email": "siva@example.com",
                "current_password": "WrongPassword!",
                "new_password": "NewSecretPassword123!",
                "confirm_password": "NewSecretPassword123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("current password is incorrect", response.json().get("error", "").lower())
        mock_db.users.update_one.assert_not_called()

    @patch("AppCore.Auth.views.change_password.get_database")
    def test_change_password_mismatched_confirmation(self, mock_get_database):
        mock_db = mock_get_database.return_value
        mock_db.users.find_one.return_value = self.mock_user.copy()

        response = self.client.post(
            "/api/profile/change-password/",
            {
                "email": "siva@example.com",
                "current_password": "OldPassword123!",
                "new_password": "NewSecretPassword123!",
                "confirm_password": "DifferentPassword123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        mock_db.users.update_one.assert_not_called()

    @patch("AppCore.Auth.views.change_password.is_valid_otp", return_value=True)
    @patch("AppCore.Auth.views.change_password.get_database")
    def test_change_password_via_otp(self, mock_get_database, _mock_otp):
        mock_db = mock_get_database.return_value
        mock_db.users.find_one.return_value = self.mock_user.copy()
        client = APIClient()

        response = client.post(
            "/api/profile/change-password/",
            {
                "email": "siva@example.com",
                "otp": "123456",
                "new_password": "BrandNewPassword123!",
                "confirm_password": "BrandNewPassword123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json().get("success"))
        mock_db.users.update_one.assert_called_once()


class SessionHistoryViewTests(SimpleTestCase):
    @patch("AppCore.Auth.views.sessions.get_database")
    def test_session_history_returns_active_sessions(self, mock_get_database):
        mock_db = mock_get_database.return_value
        user_id = ObjectId()
        user = MongoUser.from_document({"_id": user_id, "username": "siva", "email": "siva@example.com"})

        mock_db.tokens.find.return_value.sort.return_value = [
            {
                "_id": ObjectId(),
                "user_id": str(user_id),
                "token_hash": "hash123",
                "ip": "192.168.1.100",
                "device": "Windows Chrome",
                "location": "Chennai, Tamil Nadu, IN",
                "created_at": datetime.now(timezone.utc),
                "last_used_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=14),
            }
        ]

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get("/api/auth/sessions/")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["ip"], "192.168.1.100")
        self.assertEqual(data[0]["device"], "Windows Chrome")

    @patch("AppCore.Auth.views.sessions.get_database")
    def test_current_session_uses_the_request_client_ip(self, mock_get_database):
        mock_db = mock_get_database.return_value
        user_id = ObjectId()
        token = "current-session-token"
        mock_db.tokens.find.return_value.sort.return_value = [
            {
                "_id": ObjectId(),
                "user_id": str(user_id),
                "token_hash": hashlib.sha256(token.encode("utf-8")).hexdigest(),
                "ip": "192.168.1.100",
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=14),
            }
        ]
        user = MongoUser.from_document(
            {"_id": user_id, "username": "siva", "email": "siva@example.com"}
        )
        client = APIClient()
        client.force_authenticate(user=user, token=token)

        response = client.get(
            "/api/auth/sessions/",
            HTTP_X_FORWARDED_FOR="203.0.113.42, 10.0.0.2",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()[0]["isCurrent"])
        self.assertEqual(response.json()[0]["ip"], "203.0.113.42")


@override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
class PortfoliosViewTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(
            user=MongoUser(
                id=ObjectId(),
                username="admin",
                email="admin@example.com",
                first_name="Admin",
                last_name="",
                role="admin",
            )
        )

    @patch("AppCore.Portfolios.views.get_portfolios_collection")
    def test_list_portfolios_returns_metrics_and_items(self, mock_get_coll):
        mock_coll = mock_get_coll.return_value
        mock_coll.count_documents.return_value = 1
        mock_coll.find.return_value.sort.return_value = [
            {
                "_id": "pf-core-2026",
                "name": "Core Platform Modernization",
                "key": "PORT-CORE",
                "status": "on track",
                "progress": 74,
                "projects": [{"id": "p-1", "name": "Nexus UI", "progress": 80, "status": "on track"}],
            }
        ]
        mock_coll.find.return_value = [
            {
                "_id": "pf-core-2026",
                "name": "Core Platform Modernization",
                "key": "PORT-CORE",
                "status": "on track",
                "progress": 74,
                "projects": [{"id": "p-1", "name": "Nexus UI", "progress": 80, "status": "on track"}],
            }
        ]

        response = self.client.get("/api/portfolios/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("portfolios", data)
        self.assertIn("metrics", data)
        self.assertEqual(data["metrics"]["totalPortfolios"], 1)
        self.assertEqual(data["metrics"]["totalProjects"], 1)

    @patch("AppCore.Portfolios.views.get_portfolios_collection")
    def test_create_portfolio_success(self, mock_get_coll):
        mock_coll = mock_get_coll.return_value
        mock_coll.insert_one.return_value = None

        response = self.client.post(
            "/api/portfolios/",
            {
                "name": "Enterprise Scale Program",
                "description": "Cross-cutting scale roadmap",
                "status": "on track",
                "progress": 25,
                "priority": "High",
                "timeframe": "Q1 - Q4 FY26",
                "owner": {"name": "Jagadeep", "role": "VP Eng"},
                "projects": ["Distributed Database", "Load Balancer"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["name"], "Enterprise Scale Program")
        self.assertEqual(len(data["projects"]), 2)


@override_settings(NEXUS_ADMIN_EMAILS=frozenset({"admin@example.com"}))
class KnowledgeMeetingsViewTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(
            user=MongoUser.from_document(
                {
                    "_id": ObjectId(),
                    "username": "admin",
                    "email": "admin@example.com",
                    "role": "admin",
                }
            )
        )

    @patch("AppCore.Knowledge.views.get_meetings_collection")
    def test_get_meetings_list(self, mock_get_coll):
        mock_coll = mock_get_coll.return_value
        mock_coll.count_documents.return_value = 2
        mock_coll.find.return_value = [
            {
                "_id": "meet-1",
                "title": "Sprint 24 Planning",
                "type": "upcoming",
                "status": "upcoming",
                "date": "Today, Oct 23, 2026",
                "time": "3:30 PM",
                "duration": "60 mins",
                "platform": "Google Meet",
                "agenda": "Sprint roadmap",
                "attendees": [{"name": "Jagadeep", "role": "Host"}],
            },
            {
                "_id": "meet-2",
                "title": "Sprint 23 Retro",
                "type": "recent",
                "status": "completed",
                "date": "Oct 22, 2026",
                "time": "11:00 AM",
                "duration": "60 mins",
                "platform": "Zoom",
                "agenda": "Sprint retrospective",
                "attendees": [{"name": "Sarah Chen", "role": "Lead"}],
            },
        ]

        response = self.client.get("/api/meetings/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["meetings"]), 2)
        self.assertEqual(data["metrics"]["upcoming"], 1)
        self.assertEqual(data["metrics"]["recent"], 1)

    @patch("AppCore.Knowledge.views.get_meetings_collection")
    def test_create_meeting_success(self, mock_get_coll):
        mock_coll = mock_get_coll.return_value
        mock_coll.insert_one.return_value = None

        response = self.client.post(
            "/api/meetings/",
            {
                "title": "Weekly Architectural Sync",
                "type": "upcoming",
                "date": "Tomorrow, Oct 24, 2026",
                "time": "2:00 PM - 3:00 PM",
                "duration": "60 mins",
                "platform": "Google Meet",
                "agenda": "Review service boundaries",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["meeting"]["title"], "Weekly Architectural Sync")


@override_settings(NEXUS_ADMIN_EMAILS=frozenset({"reports@example.com"}))
class EODReportTests(SimpleTestCase):
    def test_eod_detection_is_case_insensitive_and_matches_whole_tokens(self):
        self.assertIsNotNone(EOD_PATTERN.search("EOD: finished the task"))
        self.assertIsNotNone(EOD_PATTERN.search("eod update complete"))
        self.assertIsNotNone(EOD_PATTERN.search("Please send the EoD report"))
        self.assertIsNone(EOD_PATTERN.search("preorder"))
        self.assertIsNone(EOD_PATTERN.search("episode"))

    def test_sprint_report_aggregates_real_entries_without_inventing_progress(self):
        entries = [
            {
                "id": "report-1",
                "sprint_id": "sprint-1",
                "sprint": "Sprint 1",
                "work_completed": "Implemented API",
                "next_steps": "Add tests",
                "status": "In Progress",
                "progress": None,
            },
            {
                "id": "report-2",
                "sprint_id": "sprint-1",
                "sprint": "Sprint 1",
                "work_completed": "Reviewed UI",
                "next_steps": "",
                "status": "Done",
                "progress": None,
            },
        ]

        result = _aggregate_reports(entries, "sprint")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["entry_count"], 2)
        self.assertIn("Implemented API", result[0]["work_completed"])
        self.assertEqual(result[0]["progress"], None)

    def test_report_endpoint_requires_authentication_and_lists_persisted_records(self):
        client = APIClient()
        self.assertEqual(client.get("/api/reporting/eod-reports/").status_code, 401)

        client.force_authenticate(user=MongoUser(
            id=ObjectId(),
            username="report_user",
            email="reports@example.com",
            first_name="Report",
            last_name="User",
            role="admin",
        ))
        with patch("AppCore.Reporting.views.reports.get_eod_reports_collection") as get_reports, patch(
            "AppCore.Reporting.views.reports.get_database"
        ) as get_database:
            get_reports.return_value.find.return_value.sort.return_value.limit.return_value = []
            get_database.return_value.backlog_task_comments.find.return_value.sort.return_value.limit.return_value = []

            response = client.get("/api/reporting/eod-reports/?type=daily")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"count": 0, "results": []})

    def test_authenticated_team_lead_can_access_reports(self):
        client = APIClient()
        client.force_authenticate(user=MongoUser(
            id=ObjectId(),
            username="no_report_access",
            email="no-reports@example.com",
            first_name="No",
            last_name="Reports",
            role="team_lead",
        ))

        with patch("AppCore.Reporting.views.reports.get_eod_reports_collection") as get_reports, patch(
            "AppCore.Reporting.views.reports.get_database"
        ) as get_database:
            get_reports.return_value.find.return_value.sort.return_value.limit.return_value = []
            get_database.return_value.backlog_task_comments.find.return_value.sort.return_value.limit.return_value = []
            response = client.get("/api/reporting/eod-reports/")

        self.assertEqual(response.status_code, 200)

    def test_report_creation_validates_and_persists_a_record(self):
        client = APIClient()
        client.force_authenticate(user=MongoUser(
            id=ObjectId(),
            username="report_user",
            email="reports@example.com",
            first_name="Report",
            last_name="User",
            role="admin",
        ))
        report_id = ObjectId()
        with patch("AppCore.Reporting.views.reports.get_eod_reports_collection") as get_reports:
            get_reports.return_value.insert_one.return_value.inserted_id = report_id
            response = client.post(
                "/api/reporting/eod-reports/",
                {
                    "title": "End of day",
                    "report_type": "daily",
                    "report_date": "2026-10-27",
                    "work_completed": "Saved an actual report",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["id"], str(report_id))
        self.assertEqual(response.json()["work_completed"], "Saved an actual report")

    def test_report_creation_rejects_an_invalid_date(self):
        client = APIClient()
        client.force_authenticate(user=MongoUser(
            id=ObjectId(),
            username="report_user",
            email="reports@example.com",
            first_name="Report",
            last_name="User",
            role="admin",
        ))

        response = client.post(
            "/api/reporting/eod-reports/",
            {"title": "Invalid date", "report_date": "not-a-date"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("report_date", response.json())

    def test_eod_comment_integration_uses_task_relationships_and_skips_unrelated_text(self):
        task_id = ObjectId()
        task = type("TaskData", (), {
            "pk": task_id,
            "board_id": "board-1",
            "board": type("BoardData", (), {"name": "Platform"})(),
            "sprint_id": "sprint-1",
            "sprint": type("SprintData", (), {"name": "Sprint 7"})(),
            "owner_id": "employee-1",
            "owner": type("OwnerData", (), {"pk": "employee-1", "username": "worker"})(),
            "task_key": "NX-15",
            "title": "Build reports",
            "status": "In Progress",
        })()
        comments = [
            {
                "task_id": str(task_id),
                "comment_id": "comment-1",
                "author": "worker",
                "text": "EOD: added report retrieval",
                "created_at": datetime(2026, 10, 27, tzinfo=timezone.utc),
            },
            {
                "task_id": str(task_id),
                "comment_id": "comment-2",
                "author": "worker",
                "text": "The episode selector is complete",
                "created_at": datetime(2026, 10, 27, tzinfo=timezone.utc),
            },
        ]
        with patch("AppCore.Reporting.views.reports.get_database") as get_database, patch(
            "AppCore.Reporting.views.reports.Task.objects.filter"
        ) as find_tasks:
            database = get_database.return_value
            database.backlog_task_comments.find.return_value.sort.return_value.limit.return_value = comments
            database.users.find.return_value = []
            find_tasks.return_value.select_related.return_value = [task]

            reports = _eod_comment_reports()

        self.assertEqual(len(reports), 1)
        self.assertEqual(reports[0]["id"], "eod-comment-comment-1")
        self.assertEqual(reports[0]["project"], "Platform")
        self.assertEqual(reports[0]["sprint"], "Sprint 7")
        self.assertEqual(reports[0]["employee"], "worker")
        self.assertFalse(reports[0]["editable"])

    def test_report_update_delete_and_import_use_persistent_collection(self):
        client = APIClient()
        user = MongoUser(
            id=ObjectId(),
            username="report_user",
            email="reports@example.com",
            first_name="Report",
            last_name="User",
            role="admin",
        )
        client.force_authenticate(user=user)
        report_id = ObjectId()
        existing = {
            "_id": report_id,
            "created_by": str(user.id),
            "title": "Daily report",
            "report_type": "daily",
            "report_date": "2026-10-27",
            "work_completed": "Before edit",
            "source": "manual",
        }
        with patch("AppCore.Reporting.views.reports.get_eod_reports_collection") as get_reports:
            collection = get_reports.return_value
            collection.find_one.return_value = existing

            updated = client.patch(
                f"/api/reporting/eod-reports/{report_id}/",
                {"work_completed": "After edit"},
                format="json",
            )
            deleted = client.delete(f"/api/reporting/eod-reports/{report_id}/")

        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["work_completed"], "After edit")
        collection.update_one.assert_called_once()
        self.assertEqual(deleted.status_code, 204)
        collection.delete_one.assert_called_once()

        with patch("AppCore.Reporting.views.reports.get_eod_reports_collection") as get_reports:
            collection = get_reports.return_value
            collection.insert_one.side_effect = [
                type("InsertResult", (), {"inserted_id": ObjectId()})(),
                DuplicateKeyError("duplicate"),
            ]
            imported = client.post(
                "/api/reporting/eod-reports/import/",
                {
                    "rows": [
                        {"title": "Imported update", "report_date": "2026-10-27", "work_completed": "Done"},
                        {"title": "Imported update", "report_date": "2026-10-27", "work_completed": "Done"},
                    ]
                },
                format="json",
            )

        self.assertEqual(imported.status_code, 200)
        self.assertEqual(imported.json()["imported"], 1)
        self.assertEqual(imported.json()["duplicates"], 1)

    def test_csv_spreadsheet_preview_parses_headers_and_rows(self):
        client = APIClient()
        client.force_authenticate(user=MongoUser(
            id=ObjectId(),
            username="report_user",
            email="reports@example.com",
            first_name="Report",
            last_name="User",
            role="admin",
        ))

        response = client.post(
            "/api/reporting/eod-reports/preview-import/",
            {"file": SimpleUploadedFile(
                "daily.csv",
                b"Date,Task,Work completed\n2026-10-27,Build API,Added report endpoint\n",
                content_type="text/csv",
            )},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["headers"], ["Date", "Task", "Work completed"])
        self.assertEqual(response.json()["rows"][0]["Task"], "Build API")

    def test_invalid_spreadsheet_type_is_rejected(self):
        client = APIClient()
        client.force_authenticate(user=MongoUser(
            id=ObjectId(),
            username="report_user",
            email="reports@example.com",
            first_name="Report",
            last_name="User",
            role="admin",
        ))

        response = client.post(
            "/api/reporting/eod-reports/preview-import/",
            {"file": SimpleUploadedFile("notes.txt", b"not a spreadsheet")},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Only .xlsx", response.json()["error"])

    def test_xlsx_spreadsheet_preview_reads_formatted_cells(self):
        from io import BytesIO
        from openpyxl import Workbook

        workbook = Workbook()
        worksheet = workbook.active
        worksheet.append(["Date", "Task"])
        worksheet.append([datetime(2026, 10, 27), "Build API"])
        contents = BytesIO()
        workbook.save(contents)

        client = APIClient()
        client.force_authenticate(user=MongoUser(
            id=ObjectId(),
            username="report_user",
            email="reports@example.com",
            first_name="Report",
            last_name="User",
            role="admin",
        ))
        response = client.post(
            "/api/reporting/eod-reports/preview-import/",
            {"file": SimpleUploadedFile(
                "daily.xlsx",
                contents.getvalue(),
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["rows"][0]["Date"], "2026-10-27")
