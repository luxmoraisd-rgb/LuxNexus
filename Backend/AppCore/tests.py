import base64
from datetime import datetime, timezone, timedelta
import json
from unittest.mock import patch

from bson import ObjectId
from django.contrib.auth.hashers import check_password, make_password
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from django.urls import resolve
from rest_framework.test import APIClient, APIRequestFactory
from pymongo.errors import PyMongoError

from .Auth.authentication import MongoTokenAuthentication
from .Auth.role_permissions import (
    DEFAULT_ROLE_POLICIES,
    RoleCapabilityPermission,
    TaskDetailRolePermission,
    has_role_permission,
)
from .Auth.views.permissions import RolePermissionsView
from .checks import check_email_configuration
from .models import MongoUser
from .serializers.serializers import ProjectInputSerializer


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
            "/api/profile/change-password/",
            "/api/change-password/",
            "/api/inbox/",
            "/api/inbox/settings/",
            "/api/inbox/mark-all-read/",
            "/api/inbox/bulk/",
            "/api/backlog/tasks/",
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
            {"_id": ObjectId(), "username": "inbox_user", "email": "inbox@example.com"}
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/inbox/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

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
            }
        )

        self.assertEqual(user.id, user_id)
        self.assertTrue(user.is_authenticated)
        self.assertTrue(user.is_active)
        self.assertEqual(user.role, "user")

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
                    "password": "correct-horse",
                    "confirm_password": "correct-horse",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["user"]["id"], str(user_id))
        self.assertEqual(response.json()["user"]["email"], "user@example.com")
        self.assertTrue(response.json()["token"])
        self.assertNotIn("password_hash", response.json()["user"])
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

    @patch("AppCore.Auth.views.invitations.has_role_permission", return_value=True)
    @patch("AppCore.Auth.views.invitations.send_mail")
    @patch("AppCore.Auth.views.invitations.get_database")
    def test_team_lead_cannot_invite_an_elevated_role(
        self, get_database, send_mail, _has_role_permission
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

        self.assertEqual(response.status_code, 403)
        get_database.assert_not_called()
        send_mail.assert_not_called()

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
        updates = database.users.update_one.call_args.args[1]["$set"]
        self.assertEqual(updates["profile.location"], "Portland, Oregon")
        self.assertEqual(updates["profile.jobTitle"], "Engineer")

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


class RolePermissionTests(SimpleTestCase):
    @patch("AppCore.Auth.role_permissions.get_role_policies")
    def test_admin_always_has_every_role_permission(self, get_role_policies):
        get_role_policies.return_value = {
            **DEFAULT_ROLE_POLICIES,
            "admin": {key: False for key in DEFAULT_ROLE_POLICIES["admin"]},
        }
        admin = MongoUser(
            id=ObjectId(),
            username="admin",
            email="admin@example.com",
            first_name="Admin",
            last_name="",
            role="admin",
        )

        for permission in DEFAULT_ROLE_POLICIES["admin"]:
            with self.subTest(permission=permission):
                self.assertTrue(has_role_permission(admin, permission))

    @patch("AppCore.Auth.views.permissions.get_database")
    def test_permissions_endpoint_returns_full_admin_policy(self, get_database):
        user = MongoUser(
            id=ObjectId(),
            username="admin",
            email="admin@example.com",
            first_name="Admin",
            last_name="",
            role="admin",
        )
        database = get_database.return_value
        database.settings.find_one.return_value = {
            "_id": "role_permissions",
            "policies": {
                **DEFAULT_ROLE_POLICIES,
                "admin": {key: False for key in DEFAULT_ROLE_POLICIES["admin"]},
            },
        }
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/auth/permissions/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["policies"]["admin"], DEFAULT_ROLE_POLICIES["admin"])

    @patch("AppCore.Auth.role_permissions.get_role_policies")
    def test_role_capability_permission_uses_current_policy(self, get_role_policies):
        get_role_policies.return_value = DEFAULT_ROLE_POLICIES
        request = APIRequestFactory().get("/api/tasks/")
        request.user = MongoUser(
            id=ObjectId(),
            username="team_lead",
            email="lead@example.com",
            first_name="Team Lead",
            last_name="",
            role="team_lead",
        )
        view = type("TaskListView", (), {"role_capabilities": {"GET": "view_tasks"}})()

        self.assertTrue(RoleCapabilityPermission().has_permission(request, view))

    @patch("AppCore.Auth.role_permissions.get_role_policies")
    def test_user_can_edit_only_assigned_tasks(self, get_role_policies):
        get_role_policies.return_value = DEFAULT_ROLE_POLICIES
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
        task.owner.email = "someone-else@example.com"
        self.assertFalse(permission.has_object_permission(request, view, task))

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


class MongoSerializerTests(SimpleTestCase):
    def test_project_dates_must_be_ordered(self):
        serializer = ProjectInputSerializer(
            data={
                "name": "Roadmap",
                "start_date": "2026-02-02",
                "end_date": "2026-02-01",
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)


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

        response = self.client.post(
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


class PortfoliosViewTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

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


class KnowledgeMeetingsViewTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

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



