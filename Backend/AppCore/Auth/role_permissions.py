from django.conf import settings
from rest_framework.permissions import BasePermission

from ..db import get_database


ROLE_LABELS = {
    "admin": "Admin",
    "team_lead": "Team Lead",
    "user": "Member",
}

PERMISSION_DEFINITIONS = (
    {
        "key": "view_tasks",
        "label": "View tasks and boards",
        "description": "Access task lists, boards, and task details.",
    },
    {
        "key": "manage_tasks",
        "label": "Manage all tasks",
        "description": "Create, assign, edit, and delete any task; upload files and links to Ready to start.",
    },
    {
        "key": "update_assigned_tasks",
        "label": "Update assigned tasks",
        "description": "Change tasks assigned to this user.",
    },
    {
        "key": "manage_sprints",
        "label": "Manage sprints",
        "description": "Create, start, and update sprints.",
    },
    {
        "key": "manage_team",
        "label": "Manage team",
        "description": "Manage team membership and team-level settings.",
    },
    {
        "key": "manage_board",
        "label": "Manage board settings",
        "description": "Change board columns, views, and project settings.",
    },
    {
        "key": "view_reports",
        "label": "View reports",
        "description": "Access reporting and team progress information.",
    },
    {
        "key": "manage_portfolios",
        "label": "Manage portfolios",
        "description": "View, create, update, and delete portfolios.",
    },
    {
        "key": "invite_members",
        "label": "Invite and manage people",
        "description": "Invite workspace members and manage directory and team settings.",
    },
    {
        "key": "manage_own_profile",
        "label": "Manage own profile and settings",
        "description": "Update this user's profile, password, and personal settings.",
    },
)

PERMISSION_KEYS = tuple(item["key"] for item in PERMISSION_DEFINITIONS)
ROLE_POLICY_ID = "role_permissions"
DEFAULT_ROLE_POLICIES = {
    role: {
        key: (
            False
            if role == "user" and key in {"manage_tasks", "manage_sprints"}
            else True
        )
        for key in PERMISSION_KEYS
    }
    for role in ROLE_LABELS
}


def get_role_policies():
    document = get_database().settings.find_one({"_id": ROLE_POLICY_ID})
    if document is None:
        return {role: permissions.copy() for role, permissions in DEFAULT_ROLE_POLICIES.items()}
    return document["policies"]


def is_configured_admin(user):
    email = str(getattr(user, "email", "") or "").strip().lower()
    return (
        getattr(user, "role", "user") == "admin"
        and email in settings.NEXUS_ADMIN_EMAILS
    )


def get_effective_role(user):
    role = getattr(user, "role", "user")
    if role == "admin" and not is_configured_admin(user):
        return "user"
    return role


def has_role_permission(user, permission):
    role = get_effective_role(user)
    if role not in ROLE_LABELS or permission not in PERMISSION_KEYS:
        return False
    if role == "user" and permission in {"manage_tasks", "manage_sprints"}:
        return False
    return True


class RoleModulePermission(BasePermission):
    def has_permission(self, request, view):
        return get_effective_role(request.user) in ROLE_LABELS


class RoleCapabilityPermission(BasePermission):
    def has_permission(self, request, view):
        action_capability = getattr(view, "role_action_capabilities", {}).get(
            getattr(view, "action", None)
        )
        if action_capability is not None:
            return has_role_permission(request.user, action_capability)
        capabilities = getattr(view, "role_capabilities", {})
        method = request.method
        if method in {"HEAD", "OPTIONS"}:
            method = "GET"
        capability = capabilities.get(method)
        return capability is not None and has_role_permission(request.user, capability)


class AdminOnlyDeletePermission(BasePermission):
    def has_permission(self, request, view):
        return (
            request.method != "DELETE"
            or get_effective_role(request.user) == "admin"
        )


class TaskDetailRolePermission(BasePermission):
    def has_permission(self, request, view):
        if request.method == "GET":
            return has_role_permission(request.user, "view_tasks")
        if request.method == "POST":
            return (
                has_role_permission(request.user, "manage_tasks")
                or has_role_permission(request.user, "update_assigned_tasks")
            )
        if request.method in {"PUT", "PATCH"}:
            return (
                has_role_permission(request.user, "manage_tasks")
                or has_role_permission(request.user, "update_assigned_tasks")
            )
        if request.method == "DELETE":
            return has_role_permission(request.user, "manage_tasks")
        return False

    def has_object_permission(self, request, view, task):
        if request.method == "GET":
            return has_role_permission(request.user, "view_tasks")
        if has_role_permission(request.user, "manage_tasks"):
            return True
        assignee = getattr(task, "owner", None) or getattr(task, "assignee", None)
        return (
            request.method in {"PUT", "PATCH", "POST"}
            and has_role_permission(request.user, "update_assigned_tasks")
            and assignee is not None
            and assignee.email.lower() == request.user.email.lower()
        )


class TaskViewSetRolePermission(BasePermission):
    def has_permission(self, request, view):
        action = getattr(view, "action", None)
        if action in {"list", "retrieve", "my_tasks"}:
            return has_role_permission(request.user, "view_tasks")
        if action in {"create", "destroy"}:
            return has_role_permission(request.user, "manage_tasks")
        if action in {"update", "partial_update", "toggle_complete"}:
            return (
                has_role_permission(request.user, "manage_tasks")
                or has_role_permission(request.user, "update_assigned_tasks")
            )
        return False

    def has_object_permission(self, request, view, task):
        if has_role_permission(request.user, "manage_tasks"):
            return True
        assignee = task.assignee
        return (
            getattr(view, "action", None) in {"update", "partial_update", "toggle_complete"}
            and has_role_permission(request.user, "update_assigned_tasks")
            and assignee is not None
            and assignee.email.lower() == request.user.email.lower()
        )
