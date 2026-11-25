from bson import ObjectId
from rest_framework.exceptions import PermissionDenied

from .Auth.role_permissions import get_effective_role
from .db import get_database


_MEMBERSHIP_FIELDS = (
    "members",
    "member_ids",
    "assigned_users",
    "assigned_user_ids",
    "team_members",
    "user_ids",
)


def is_project_admin(user):
    return get_effective_role(user) == "admin"


def _identity_values(user):
    values = {
        str(getattr(user, "id", "") or "").strip().casefold(),
        str(getattr(user, "email", "") or "").strip().casefold(),
        str(getattr(user, "username", "") or "").strip().casefold(),
    }
    full_name = " ".join(
        part
        for part in (
            str(getattr(user, "first_name", "") or "").strip(),
            str(getattr(user, "last_name", "") or "").strip(),
        )
        if part
    )
    if full_name:
        values.add(full_name.casefold())
    return values - {""}


def _assignment_matches(value, identities):
    if isinstance(value, dict):
        return any(
            _assignment_matches(value.get(field), identities)
            for field in ("id", "_id", "user_id", "email", "username", "name")
        )
    if isinstance(value, (list, tuple, set)):
        return any(_assignment_matches(item, identities) for item in value)
    if isinstance(value, ObjectId):
        value = str(value)
    return str(value or "").strip().casefold() in identities


def project_is_assigned_to(user, project):
    identities = _identity_values(user)
    if not identities:
        return False

    if any(
        _assignment_matches(project.get(field), identities)
        for field in (
            "lead",
            "project_lead",
            "lead_id",
            "created_by",
            "owner_id",
            "owner",
        )
    ):
        return True

    return any(
        _assignment_matches(project.get(field), identities)
        for field in _MEMBERSHIP_FIELDS
    )


def _project_ids(project):
    ids = set()
    for value in (project.get("_id"), project.get("id"), project.get("key")):
        if value is not None and str(value).strip():
            ids.add(str(value).strip())
    return ids


def accessible_project_ids(user):
    if is_project_admin(user):
        return None

    return {
        project_id
        for project in get_accessible_projects(user)
        for project_id in _project_ids(project)
    }


def get_accessible_projects(user):
    if is_project_admin(user):
        return None

    collection = get_database().projects
    return [
        project
        for project in collection.find({})
        if project_is_assigned_to(user, project)
    ]


def can_access_project(user, project_id):
    if is_project_admin(user):
        return True
    project_id = str(project_id or "").strip()
    return bool(project_id and project_id in accessible_project_ids(user))


def require_project_access(user, project_id):
    if not can_access_project(user, project_id):
        raise PermissionDenied("You do not have access to this project.")


def task_project_id(task):
    project_id = getattr(task, "project_id", "")
    if project_id:
        return str(project_id)
    sprint = getattr(task, "sprint", None)
    return str(getattr(sprint, "project_id", "") or "")


def require_admin(user):
    if not is_project_admin(user):
        raise PermissionDenied("Only Admin users can perform this operation.")
