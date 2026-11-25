from django.contrib.auth import get_user_model

from .db import get_database


User = get_user_model()


def _sync_task_assignee_user(document):
    user_id = document.get("_id")
    username = str(document.get("username") or "").strip()
    email = str(document.get("email") or "").strip()
    if user_id is None:
        raise ValueError("A MongoDB user record used for task assignment has no ID.")
    if not username:
        raise ValueError(f"MongoDB user {user_id} has no username for task assignment.")

    manager = User.objects.db_manager("default")
    user = manager.filter(pk=user_id).first()
    if user is None and email:
        user = manager.filter(email__iexact=email).first()
    if user is None:
        user = manager.filter(username=username).first()

    first_name = str(document.get("first_name") or "")
    last_name = str(document.get("last_name") or "")
    is_active = document.get("is_active", True) is not False

    if user is None:
        user = User(
            id=user_id,
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_active=is_active,
        )
        user.set_unusable_password()
        user.save(using="default")
        return user

    update_fields = []
    for field, value in (
        ("first_name", first_name),
        ("last_name", last_name),
        ("email", email),
        ("is_active", is_active),
    ):
        if getattr(user, field) != value:
            setattr(user, field, value)
            update_fields.append(field)
    if update_fields:
        user.save(using="default", update_fields=update_fields)
    return user


def list_task_assignees(serializer_class):
    documents = get_database().users.find(
        {"is_active": {"$ne": False}}
    ).sort("username", 1)

    users = []
    roles_by_user_id = {}
    profile_by_user_id = {}
    for document in documents:
        user = _sync_task_assignee_user(document)
        users.append(user)
        user_key = str(user.pk)
        roles_by_user_id[user_key] = document.get("role") or "user"
        profile = document.get("profile") if isinstance(document.get("profile"), dict) else {}
        profile_by_user_id[user_key] = {
            "photo": (
                document.get("photo")
                or document.get("avatarUrl")
                or document.get("profile_image")
                or profile.get("photo")
                or ""
            ),
            "avatarColor": document.get("avatarColor") or profile.get("avatarColor") or "",
        }

    serialized_users = serializer_class(users, many=True).data
    return [
        dict(
            user_data,
            role=roles_by_user_id.get(str(user_data["id"]), "user"),
            **profile_by_user_id.get(str(user_data["id"]), {}),
        )
        for user_data in serialized_users
    ]
