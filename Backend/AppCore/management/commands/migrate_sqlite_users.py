import sqlite3
from datetime import datetime, timezone as datetime_timezone
from pathlib import Path

from bson import ObjectId
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


USER_COLUMNS = (
    "id",
    "password",
    "last_login",
    "is_superuser",
    "username",
    "first_name",
    "last_name",
    "is_staff",
    "is_active",
    "date_joined",
    "email",
)


def parse_datetime(value):
    if value is None:
        return None
    result = datetime.fromisoformat(value)
    if settings.USE_TZ and timezone.is_naive(result):
        return timezone.make_aware(result)
    return result


def comparable_datetime(value):
    if value is None:
        return None
    if settings.USE_TZ:
        if timezone.is_naive(value):
            value = timezone.make_aware(value)
        value = value.astimezone(datetime_timezone.utc)
    return value.replace(microsecond=(value.microsecond // 1000) * 1000)


class Command(BaseCommand):
    help = "Import legacy Django users from the old SQLite database into MongoDB."

    def add_arguments(self, parser):
        parser.add_argument(
            "--sqlite-path",
            type=Path,
            default=settings.BASE_DIR / "db.sqlite3",
            help="Path to the existing SQLite database (default: Backend/db.sqlite3).",
        )

    def handle(self, *args, **options):
        sqlite_path = options["sqlite_path"]
        if not sqlite_path.is_file():
            raise CommandError(f"SQLite database not found: {sqlite_path}")

        try:
            with sqlite3.connect(sqlite_path) as source:
                tables = {
                    row[0]
                    for row in source.execute(
                        "SELECT name FROM sqlite_master WHERE type = 'table'"
                    )
                }
                if "jira_clone_user" not in tables:
                    raise CommandError(
                        "The SQLite database does not contain the expected "
                        "legacy jira_clone_user table."
                    )

                for table in ("jira_clone_user_groups", "jira_clone_user_user_permissions"):
                    if table in tables:
                        count = source.execute(
                            f'SELECT COUNT(*) FROM "{table}"'
                        ).fetchone()[0]
                        if count:
                            raise CommandError(
                                f"{table} contains {count} records; group and "
                                "permission assignments need a separate migration."
                            )

                quoted_columns = ", ".join(f'"{column}"' for column in USER_COLUMNS)
                rows = source.execute(
                    f'SELECT {quoted_columns} FROM "jira_clone_user" ORDER BY "id"'
                ).fetchall()
        except sqlite3.Error as exc:
            raise CommandError(f"Could not read the SQLite database: {exc}") from exc

        user_model = get_user_model()
        users_to_create = []
        existing_by_username = {}
        for row in rows:
            legacy = dict(zip(USER_COLUMNS, row))
            defaults = {
                "password": legacy["password"],
                "last_login": parse_datetime(legacy["last_login"]),
                "is_superuser": bool(legacy["is_superuser"]),
                "username": legacy["username"],
                "first_name": legacy["first_name"],
                "last_name": legacy["last_name"],
                "is_staff": bool(legacy["is_staff"]),
                "is_active": bool(legacy["is_active"]),
                "date_joined": parse_datetime(legacy["date_joined"]),
                "email": legacy["email"] or "",
            }
            existing = (
                user_model._default_manager.using("default")
                .filter(username=defaults["username"])
                .first()
            )
            if existing is not None:
                differs = any(
                    (
                        comparable_datetime(getattr(existing, field))
                        != comparable_datetime(value)
                    )
                    if field in {"last_login", "date_joined"}
                    else getattr(existing, field) != value
                    for field, value in defaults.items()
                )
                if differs:
                    raise CommandError(
                        "A MongoDB user conflicts with a legacy username; no "
                        "users were imported."
                    )
                existing_by_username[defaults["username"]] = existing
                continue

            users_to_create.append(user_model(id=ObjectId(), **defaults))

        source_usernames = [row[4] for row in rows]
        if len(source_usernames) != len(set(source_usernames)):
            raise CommandError("The SQLite database contains duplicate usernames.")

        target_emails = {
            email
            for email in (row[10] for row in rows)
            if email
        }
        conflicting_email = (
            user_model._default_manager.using("default")
            .filter(email__in=target_emails)
            .exclude(username__in=source_usernames)
            .exists()
        )
        if conflicting_email:
            raise CommandError(
                "A MongoDB user already uses a legacy email address; no users "
                "were imported."
            )

        if users_to_create:
            user_model._default_manager.db_manager("default").bulk_create(
                users_to_create
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {len(users_to_create)} legacy users; "
                f"{len(existing_by_username)} matching users were already present."
            )
        )
