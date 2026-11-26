from datetime import datetime, timezone
import logging

from bson import ObjectId

from AppCore.db import get_database


logger = logging.getLogger(__name__)

_MEMBERSHIP_FIELDS = (
    "members",
    "member_ids",
    "assigned_users",
    "assigned_user_ids",
    "team_members",
    "user_ids",
)


def _identity_values(value):
    if isinstance(value, dict):
        return {
            identity
            for key in ("id", "_id", "user_id", "email", "username", "name")
            for identity in _identity_values(value.get(key))
        }
    if isinstance(value, (list, tuple, set)):
        return {
            identity
            for item in value
            for identity in _identity_values(item)
        }
    if value is None:
        return set()
    return {str(value).strip().casefold()} - {""}


def _user_identities(user):
    name = " ".join(
        part.strip()
        for part in (user.get("first_name", ""), user.get("last_name", ""))
        if part and part.strip()
    )
    return _identity_values(
        {
            "_id": user.get("_id"),
            "email": user.get("email"),
            "username": user.get("username"),
            "name": name or user.get("username"),
        }
    )


def _actor_identities(actor):
    return _identity_values(
        {
            "id": getattr(actor, "id", None),
            "email": getattr(actor, "email", None),
            "username": getattr(actor, "username", None),
        }
    )


def _recipient_users(
    database,
    project,
    include_all_admins=False,
    include_project_leads_only=False,
):
    memberships = {
        identity
        for field in _MEMBERSHIP_FIELDS
        for identity in _identity_values(project.get(field))
    }
    leads = _identity_values(
        {
            "lead": project.get("lead"),
            "project_lead": project.get("project_lead"),
            "lead_id": project.get("lead_id"),
        }
    )
    users = database.users.find({"is_active": {"$ne": False}})
    recipients = []
    for user in users:
        identities = _user_identities(user)
        is_lead = bool(identities & leads)
        is_project_member = bool(identities & memberships)
        is_team_lead = str(user.get("role", "")).casefold() == "team_lead"
        is_admin = str(user.get("role", "")).casefold() == "admin"
        if (
            is_lead
            or (
                is_project_member
                and (not include_project_leads_only or is_team_lead)
            )
            or (include_all_admins and is_admin)
        ):
            recipients.append(user)
    return recipients


def _project_for(database, project_id):
    value = str(project_id or "").strip()
    if not value:
        return None

    conditions = [{"id": value}, {"key": value}]
    if ObjectId.is_valid(value):
        conditions.append({"_id": ObjectId(value)})
    project = database.projects.find_one({"$or": conditions})
    if project is None:
        logger.warning("Skipping project notification because project %s was not found.", value)
    return project


def _create_notifications(
    database,
    project,
    actor,
    title,
    description,
    kind,
    include_all_admins=False,
    include_project_leads_only=False,
):
    actor_identities = _actor_identities(actor)
    now = datetime.now(timezone.utc)
    author = (
        getattr(actor, "get_full_name", lambda: "")()
        or getattr(actor, "username", "")
        or "A team member"
    )
    author_email = getattr(actor, "email", "") or ""
    recipients = []
    seen = set()

    for user in _recipient_users(
        database,
        project,
        include_all_admins,
        include_project_leads_only,
    ):
        user_id = str(user.get("_id") or "")
        if not user_id or user_id in seen or _user_identities(user) & actor_identities:
            continue
        seen.add(user_id)
        recipient_name = " ".join(
            part.strip()
            for part in (user.get("first_name", ""), user.get("last_name", ""))
            if part and part.strip()
        ) or user.get("username") or user.get("email", "")
        recipients.append(
            {
                "title": title,
                "snippet": description[:120],
                "description": description,
                "author": author,
                "author_email": author_email,
                "avatar": author[:2].upper(),
                "avatarColor": "#6366f1",
                "recipient_name": recipient_name,
                "recipient_email": user.get("email", ""),
                "type": kind,
                "starred": False,
                "archived": False,
                "deleted": False,
                "mentioned": False,
                "section": "Today",
                "tags": [],
                "time": now.strftime("%I:%M %p"),
                "date": now.strftime("%b %d, %Y"),
                "tasks": [],
                "replies": [],
                "created_at": now,
                "user_id": user_id,
                "unread": True,
                "isSent": False,
                "project_id": str(project.get("_id") or project.get("id") or ""),
            }
        )

    if recipients:
        database.notifications.insert_many(recipients)


def notify_project_created(project, actor, database=None):
    _create_notifications(
        database if database is not None else get_database(),
        project,
        actor,
        f"Project created: {project.get('name', 'New project')}",
        f"{getattr(actor, 'username', 'A team member')} created project "
        f"{project.get('name', 'New project')} ({project.get('key', '')}).",
        "project",
    )


def notify_project_activity(project_id, actor, title, description, database=None):
    database = database if database is not None else get_database()
    project = _project_for(database, project_id)
    if project is None:
        return
    project_name = project.get("name") or project.get("key") or "the project"
    _create_notifications(
        database,
        project,
        actor,
        title,
        f"{description} Project: {project_name}.",
        "task",
    )


def notify_project_comment(project_id, actor, task_title, comment, database=None):
    database = database if database is not None else get_database()
    project = _project_for(database, project_id)
    if project is None:
        return
    _create_notifications(
        database,
        project,
        actor,
        f"New comment on {task_title}",
        f"{getattr(actor, 'username', 'A team member')} commented on {task_title} "
        f"in {project.get('name') or project.get('key') or 'the project'}: {comment}",
        "task",
        include_all_admins=True,
        include_project_leads_only=True,
    )
