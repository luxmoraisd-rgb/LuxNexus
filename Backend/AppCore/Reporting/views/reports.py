import re
from collections import defaultdict
from datetime import date, datetime
from io import BytesIO

from bson import ObjectId
from django.db import DatabaseError
from django.http import HttpResponse
from django.utils import timezone
from docx import Document
from docx.enum.section import WD_ORIENT
from docx.shared import Inches
from pymongo.errors import PyMongoError
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from AppCore.ActiveSprint.models import Sprint as ActiveBoardSprint
from AppCore.Backlog.models import Board, Sprint, Task
from AppCore.Auth.role_permissions import get_effective_role
from AppCore.db import get_database
from AppCore.project_access import (
    accessible_project_ids,
    get_accessible_projects,
    project_is_assigned_to,
    require_project_access,
)
from ..models import get_eod_reports_collection
from ..serializers.reports import ReportWriteSerializer


EOD_PATTERN = re.compile(r"(?<!\w)EOD(?!\w)", re.IGNORECASE)
REPORT_FIELDS = (
    "title",
    "report_type",
    "report_date",
    "project_id",
    "project",
    "sprint_id",
    "sprint",
    "employee_id",
    "employee",
    "activity",
    "status",
    "progress",
    "source_data",
)


class EODReportRolePermission(BasePermission):
    def has_permission(self, request, view):
        return get_effective_role(request.user) in {"admin", "team_lead", "user"}


class EODReportExportPermission(BasePermission):
    def has_permission(self, request, view):
        return get_effective_role(request.user) in {"admin", "team_lead"}


def _user_id(request):
    user = getattr(request, "user", request)
    return str(getattr(user, "id", getattr(user, "pk", "")))


def _as_text(value):
    return "" if value is None else str(value)


def _serialize_report(document, user=None):
    result = {key: document.get(key, "") for key in REPORT_FIELDS}
    result["id"] = str(document.get("_id", document.get("id", "")))
    result["created_by"] = _as_text(document.get("created_by"))
    result["created_at"] = _as_text(document.get("created_at"))
    result["updated_at"] = _as_text(document.get("updated_at"))
    result["source"] = document.get("source", "manual")
    elevated = user is not None and get_effective_role(user) in {"admin", "team_lead"}
    result["editable"] = (
        result["source"] != "eod_comment"
        and not document.get("aggregate", False)
        and (elevated or result["created_by"] == _user_id(user))
    )
    result["period"] = document.get("period", "")
    result["entry_count"] = document.get("entry_count", 1)
    return result


def _eod_comment_reports(user=None):
    database = get_database()
    comments = list(database.backlog_task_comments.find({}).sort("created_at", -1).limit(5000))
    comments = [
        comment for comment in comments
        if EOD_PATTERN.search(_as_text(comment.get("text")))
    ]
    if not comments:
        return []

    users = {}
    for user in database.users.find({"is_active": {"$ne": False}}):
        user_name = " ".join(filter(None, [user.get("first_name"), user.get("last_name")]))
        for identifier in (user.get("username"), user.get("email"), user_name):
            if identifier:
                users[str(identifier).casefold()] = str(user.get("_id", ""))

    task_ids = {str(comment.get("task_id", "")) for comment in comments if comment.get("task_id")}
    tasks = {}
    if task_ids:
        task_ids_for_query = [
            ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
            for task_id in task_ids
        ]
        try:
            queryset = Task.objects.filter(pk__in=task_ids_for_query).select_related(
                "board", "sprint", "owner"
            )
            for task in queryset:
                tasks[str(task.pk)] = {
                    "task_id": str(task.pk),
                    "board_id": str(
                        getattr(task, "project_id", "") or task.board_id or ""
                    ),
                    "project": _project_name(
                        database, getattr(task, "project_id", "")
                    )
                    or (task.board.name if task.board_id else ""),
                    "sprint_id": str(task.sprint_id or ""),
                    "sprint": task.sprint.name if task.sprint_id else "",
                    "employee_id": str(task.owner_id or ""),
                    "employee": task.owner.username if task.owner_id else "",
                    "task": task.task_key or task.title,
                    "status": task.status,
                }
        except DatabaseError:
            tasks = {}

    unresolved_task_ids = task_ids - set(tasks)
    if unresolved_task_ids:
        mongo_tasks = database.tasks.find({
            "$or": [
                {"task_id": {"$in": list(unresolved_task_ids)}},
                {"id": {"$in": list(unresolved_task_ids)}},
                {"_id": {"$in": [
                    ObjectId(task_id) for task_id in unresolved_task_ids
                    if ObjectId.is_valid(task_id)
                ]}},
            ]
        })
        for task in mongo_tasks:
            task_id = str(task.get("task_id", task.get("id", task.get("_id", ""))))
            sprint_id = _as_text(task.get("sprint_id") or task.get("sprintId"))
            sprint = database.sprints.find_one({
                "$or": [
                    {"sprint_id": sprint_id},
                    {"id": sprint_id},
                    {"_id": ObjectId(sprint_id) if ObjectId.is_valid(sprint_id) else sprint_id},
                ]
            }) if sprint_id else None
            owner = task.get("owner")
            employee = _as_text(owner.get("name") or owner.get("username") or owner.get("email")) if isinstance(owner, dict) else _as_text(owner)
            project_id = _as_text(task.get("project_id") or task.get("board_id"))
            project = database.projects.find_one({
                "$or": [
                    {"_id": ObjectId(project_id) if ObjectId.is_valid(project_id) else project_id},
                    {"id": project_id},
                    {"key": project_id},
                ]
            }) if project_id else None
            tasks[task_id] = {
                "task_id": task_id,
                "board_id": project_id,
                "project": _as_text((project or {}).get("name") or (project or {}).get("key")),
                "sprint_id": sprint_id,
                "sprint": _as_text((sprint or {}).get("name")),
                "employee_id": _as_text(owner.get("id") or owner.get("user_id")) if isinstance(owner, dict) else users.get(employee.casefold(), ""),
                "employee": employee,
                "task": _as_text(task.get("task_key") or task.get("taskId") or task.get("title") or task.get("task")),
                "status": _as_text(task.get("status")),
            }

    rows = []
    for comment in comments:
        text = _as_text(comment.get("text"))
        task = tasks.get(str(comment.get("task_id", "")), {})
        created_at = comment.get("created_at")
        report_date = (
            created_at.date().isoformat()
            if isinstance(created_at, datetime)
            else _as_text(created_at)[:10]
        )
        author = _as_text(comment.get("author"))
        author_id = users.get(author.casefold(), "") or task.get("employee_id", "")
        employee = author or task.get("employee", "")
        rows.append({
            "id": f"eod-comment-{comment.get('comment_id', comment.get('_id', ''))}",
            "title": "EOD comment",
            "report_type": "daily",
            "report_date": report_date,
            "project_id": task.get("board_id", ""),
            "project": task.get("project", ""),
            "sprint_id": task.get("sprint_id", ""),
            "sprint": task.get("sprint", ""),
            "employee_id": author_id,
            "employee": employee,
            "activity": text,
            "status": task.get("status", ""),
            "progress": None,
            "source_data": {},
            "created_at": created_at,
            "updated_at": created_at,
            "source": "eod_comment",
            "editable": False,
            "period": "",
            "entry_count": 1,
        })
    return _scope_report_rows(user, rows) if user is not None else rows


def _project_name(database, project_id):
    if not project_id:
        return ""
    project = database.projects.find_one({
        "$or": [
            {"_id": ObjectId(project_id) if ObjectId.is_valid(str(project_id)) else project_id},
            {"id": str(project_id)},
            {"key": str(project_id)},
        ]
    })
    return _as_text((project or {}).get("name") or (project or {}).get("key"))


def _scope_report_rows(user, rows):
    if get_effective_role(user) in {"admin", "team_lead"}:
        return rows
    allowed_ids = accessible_project_ids(user) or set()
    database = get_database()
    scoped_rows = []
    for row in rows:
        if (
            row.get("created_by") == _user_id(user)
            or str(row.get("employee_id") or "") == _user_id(user)
        ):
            scoped_rows.append(row)
            continue
        project_id = str(row.get("project_id") or "").strip()
        sprint_id = str(row.get("sprint_id") or "").strip()
        project_allowed = project_id in allowed_ids
        sprint_allowed = False
        if sprint_id:
            sprint_project_id = _report_sprint_project_id(sprint_id, database)
            sprint_allowed = sprint_project_id in allowed_ids
        if (project_allowed or sprint_allowed) and (
            not project_id or project_allowed
        ) and (not sprint_id or sprint_allowed):
            scoped_rows.append(row)
    return scoped_rows


def _report_sprint_project_id(sprint_id, database=None):
    sprint = (
        Sprint.objects.filter(pk=sprint_id).first()
        if ObjectId.is_valid(str(sprint_id))
        else None
    )
    if sprint is None and ObjectId.is_valid(str(sprint_id)):
        sprint = ActiveBoardSprint.objects.filter(pk=sprint_id).first()
    if sprint is not None:
        return str(sprint.project_id or "")
    if database is None:
        database = get_database()
    sprint = database.sprints.find_one({
        "$or": [
            {"sprint_id": str(sprint_id)},
            {"id": str(sprint_id)},
            {
                "_id": ObjectId(sprint_id)
                if ObjectId.is_valid(str(sprint_id))
                else str(sprint_id)
            },
        ]
    })
    return str((sprint or {}).get("project_id") or (sprint or {}).get("projectId") or "")


def _validate_report_project(user, values):
    if get_effective_role(user) in {"admin", "team_lead"}:
        return
    project_id = values.get("project_id")
    project_name = str(values.get("project") or "").strip().casefold()
    sprint_id = values.get("sprint_id")
    if project_id:
        require_project_access(user, project_id)
    elif project_name:
        from AppCore.project_access import get_accessible_projects

        accessible_projects = get_accessible_projects(user) or []
        if not any(
            project_name
            in {
                str(project.get("name") or "").strip().casefold(),
                str(project.get("key") or "").strip().casefold(),
                str(project.get("id") or "").strip().casefold(),
                str(project.get("_id") or "").strip().casefold(),
            }
            for project in accessible_projects
        ):
            raise PermissionDenied("You do not have access to this project.")
    if sprint_id:
        sprint_project_id = _report_sprint_project_id(sprint_id)
        if not sprint_project_id:
            raise PermissionDenied("You do not have access to this project.")
        require_project_access(user, sprint_project_id)


def _filter_reports(rows, params):
    start_date = params.get("start_date", "")
    end_date = params.get("end_date", "")
    month = params.get("month", "")
    year = params.get("year", "")
    project = params.get("project", "").casefold()
    sprint = params.get("sprint", "").casefold()
    employee = params.get("employee", "").casefold()
    search = params.get("search", "").strip().casefold()

    filtered = []
    for row in rows:
        row_date = _as_text(row.get("report_date"))
        if (start_date or end_date or month or year) and not row_date:
            continue
        if start_date and row_date < start_date:
            continue
        if end_date and row_date > end_date:
            continue
        if month and row_date[5:7] != month.zfill(2):
            continue
        if year and row_date[:4] != year:
            continue
        if project and project not in _as_text(row.get("project")).casefold() and project != _as_text(row.get("project_id")).casefold():
            continue
        if sprint and sprint not in _as_text(row.get("sprint")).casefold() and sprint != _as_text(row.get("sprint_id")).casefold():
            continue
        if employee and employee not in _as_text(row.get("employee")).casefold() and employee != _as_text(row.get("employee_id")).casefold():
            continue
        if search:
            haystack = " ".join(_as_text(row.get(key)) for key in REPORT_FIELDS).casefold()
            if search not in haystack:
                continue
        filtered.append(row)
    return filtered


def _filter_validation_error(params):
    start_date = params.get("start_date", "")
    end_date = params.get("end_date", "")
    month = params.get("month", "")
    year = params.get("year", "")
    try:
        start = date.fromisoformat(start_date) if start_date else None
        end = date.fromisoformat(end_date) if end_date else None
    except ValueError:
        return "Date filters must use YYYY-MM-DD."
    if start and end and start > end:
        return "The start date must not be later than the end date."
    if month and (not month.isdecimal() or not 1 <= int(month) <= 12):
        return "Month must be a number from 1 to 12."
    if year and (not year.isdecimal() or len(year) != 4):
        return "Year must use four digits."
    return ""


def _aggregate_monthly_reports(rows):
    groups = defaultdict(list)
    for row in rows:
        group_key = (
            _as_text(row.get("report_date"))[:7],
            _as_text(row.get("employee_id")) or _as_text(row.get("employee")),
        )
        groups[group_key].append(row)

    aggregated = []
    for key, entries in groups.items():
        period = key[0]
        value = entries[0].get("employee", "")
        title = f"{period} report - {value or 'Unassigned'}"
        comments = [entry.get("activity") for entry in entries]
        statuses = sorted({entry.get("status", "") for entry in entries if entry.get("status")})
        aggregated.append({
            "id": f"aggregate-monthly-{'-'.join(key)}",
            "title": title,
            "report_type": "monthly",
            "report_date": period,
            "period": period,
            "project_id": entries[0].get("project_id", ""),
            "project": entries[0].get("project", ""),
            "sprint_id": entries[0].get("sprint_id", ""),
            "sprint": entries[0].get("sprint", ""),
            "employee_id": entries[0].get("employee_id", ""),
            "employee": entries[0].get("employee", ""),
            "activity": "\n".join(
                filter(None, [f"Employee: {value or 'Unassigned'}", *comments])
            ),
            "status": ", ".join(statuses),
            "progress": None,
            "source_data": {},
            "source": "aggregate",
            "editable": False,
            "entry_count": len(entries),
        })
    return aggregated


REPORT_EXPORT_COLUMNS = (
    ("report_date", "Date"),
    ("title", "Report title"),
    ("employee", "Employee"),
    ("project", "Project"),
    ("sprint", "Sprint"),
    ("activity", "EOD comments"),
    ("status", "Status"),
    ("progress", "Progress %"),
)


def _filtered_report_rows(user, params, report_type):
    stored = [
        _serialize_report(row, user)
        for row in get_eod_reports_collection().find({}).sort("updated_at", -1).limit(5000)
    ]
    comments = _eod_comment_reports(user)
    rows = _filter_reports(
        _scope_report_rows(user, stored + comments),
        params,
    )
    if report_type == "monthly":
        return _aggregate_monthly_reports(
            [row for row in rows if row.get("report_type") == "daily"],
        )
    return [row for row in rows if row.get("report_type") == "daily"]


def _build_report_docx(report_type, rows):
    document = Document()
    section = document.sections[0]
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width, section.page_height = section.page_height, section.page_width
    section.top_margin = Inches(0.5)
    section.bottom_margin = Inches(0.5)
    section.left_margin = Inches(0.5)
    section.right_margin = Inches(0.5)

    report_title = "Monthly EOD Report" if report_type == "monthly" else "Daily EOD Report"
    document.add_heading(report_title, level=1)
    table = document.add_table(rows=1, cols=len(REPORT_EXPORT_COLUMNS))
    table.style = "Table Grid"
    for cell, (_, label) in zip(table.rows[0].cells, REPORT_EXPORT_COLUMNS):
        cell.text = label
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.bold = True

    for report in rows:
        cells = table.add_row().cells
        for cell, (field, _) in zip(cells, REPORT_EXPORT_COLUMNS):
            value = report.get(field)
            if field == "progress" and value is not None:
                value = f"{value}%"
            cell.text = _as_text(value).strip() or "N/A"

    if not rows:
        table.add_row().cells[0].text = "No reports match the selected filters."

    output = BytesIO()
    document.save(output)
    return output.getvalue()


def _available_options(user=None, project_id=None):
    database = get_database()
    is_admin = user is None or get_effective_role(user) in {"admin", "team_lead"}
    allowed_ids = (
        accessible_project_ids(user)
        if user is not None and not is_admin
        else None
    )
    selected_project_id = str(project_id or "").strip()
    if selected_project_id and user is not None and not is_admin:
        require_project_access(user, selected_project_id)
    projects = []
    seen_projects = set()
    for board in Board.objects.all().order_by("name"):
        board_id = str(board.pk)
        if selected_project_id and board_id != selected_project_id:
            continue
        if not is_admin and not (
            board.sprints.filter(project_id__in=allowed_ids).exists()
            or board.tasks.filter(project_id__in=allowed_ids).exists()
        ):
            continue
        projects.append({"id": board_id, "name": board.name})
        seen_projects.add(board_id)
    for project in database.projects.find({}).sort("name", 1).limit(1000):
        project_id = str(project.get("_id", project.get("id", "")))
        project_ids = {
            project_id,
            str(project.get("id") or ""),
            str(project.get("key") or ""),
        }
        if selected_project_id and selected_project_id not in project_ids:
            continue
        if not is_admin and project_id not in allowed_ids:
            continue
        if project_id in seen_projects:
            continue
        projects.append({
            "id": project_id,
            "name": _as_text(project.get("name") or project.get("key")),
        })
    sprints = [
        {
            "id": str(sprint.pk),
            "name": sprint.name,
        }
        for sprint in (
            Sprint.objects.filter(project_id=selected_project_id)
            if selected_project_id
            else Sprint.objects.all()
            if is_admin
            else Sprint.objects.filter(project_id__in=allowed_ids)
        ).order_by("order", "name")[:1000]
    ]
    active_board_sprints = (
        ActiveBoardSprint.objects.filter(project_id=selected_project_id)
        if selected_project_id
        else ActiveBoardSprint.objects.all()
        if is_admin
        else ActiveBoardSprint.objects.filter(project_id__in=allowed_ids)
    )
    for sprint in active_board_sprints.order_by("order", "name")[:1000]:
        sprint_id = str(sprint.pk)
        if any(option["id"] == sprint_id for option in sprints):
            continue
        sprints.append({"id": sprint_id, "name": sprint.name})
    for sprint in database.sprints.find({}).sort("order", 1).limit(1000):
        sprint_id = _as_text(sprint.get("sprint_id") or sprint.get("id") or sprint.get("_id"))
        sprint_project_id = str(sprint.get("project_id") or sprint.get("projectId") or "")
        if selected_project_id and sprint_project_id != selected_project_id:
            continue
        if not is_admin and sprint_project_id not in allowed_ids:
            continue
        if any(option["id"] == sprint_id for option in sprints):
            continue
        sprints.append({
            "id": sprint_id,
            "name": _as_text(sprint.get("name")),
        })
    visible_employee_ids = None
    visible_employee_names = None
    if user is not None and (selected_project_id or not is_admin):
        stored_reports = list(get_eod_reports_collection().find({}))
        visible_reports = _scope_report_rows(user, stored_reports)
        if selected_project_id:
            visible_reports = _filter_reports(
                visible_reports, {"project": selected_project_id}
            )
        visible_employee_ids = {
            str(report.get("employee_id") or "")
            for report in visible_reports
            if report.get("employee_id")
        }
        visible_employee_names = {
            _as_text(report.get("employee")).casefold()
            for report in visible_reports
            if report.get("employee")
        }
        visible_employee_ids.add(_user_id(user))
    users = []
    for user_document in database.users.find({"is_active": {"$ne": False}}).sort("username", 1).limit(1000):
        full_name = " ".join(
            filter(None, [user_document.get("first_name"), user_document.get("last_name")])
        )
        user_id = str(user_document.get("_id", ""))
        user_name = full_name or user_document.get("username") or user_document.get("email", "")
        if visible_employee_ids is not None and (
            user_id not in visible_employee_ids
            and _as_text(user_name).casefold() not in visible_employee_names
        ):
            continue
        users.append({"id": user_id, "name": user_name})
    assigned_project, active_sprint = _default_report_assignment(
        user, database, selected_project_id
    )
    current_name = " ".join(
        filter(
            None,
            [
                str(getattr(user, "first_name", "") or "").strip(),
                str(getattr(user, "last_name", "") or "").strip(),
            ],
        )
    ) if user is not None else ""
    current_user = {
        "id": _user_id(user),
        "name": current_name
        or str(getattr(user, "username", "") or getattr(user, "email", "")),
    } if user is not None else {"id": "", "name": ""}
    return {
        "projects": projects,
        "sprints": sprints,
        "employees": users,
        "current_user": current_user,
        "assigned_project": assigned_project,
        "active_sprint": active_sprint,
    }


def _default_report_assignment(user, database=None, project_id=None):
    if user is None:
        return {}, {}
    if database is None:
        database = get_database()
    is_elevated = get_effective_role(user) in {"admin", "team_lead"}
    if is_elevated:
        all_projects = list(database.projects.find({}))
        assigned_projects = (
            all_projects
            if project_id
            else [
                project
                for project in all_projects
                if project_is_assigned_to(user, project)
            ]
        )
    else:
        assigned_projects = get_accessible_projects(user) or []
    requested_project_id = str(project_id or "").strip()
    if requested_project_id:
        assigned_projects = [
            project
            for project in assigned_projects
            if requested_project_id
            in {
                str(project.get("_id") or ""),
                str(project.get("id") or ""),
                str(project.get("key") or ""),
            }
        ]
        if not assigned_projects:
            raise PermissionDenied("You do not have access to this project.")
    assigned_projects.sort(key=lambda project: _as_text(project.get("name")).casefold())
    project = assigned_projects[0] if assigned_projects else None
    active_sprint = None
    if assigned_projects:
        project_ids = {
            str(value)
            for item in assigned_projects
            for value in (item.get("_id"), item.get("id"), item.get("key"))
            if value is not None
        }
        sprint = (
            Sprint.objects.filter(status__iexact="active", project_id__in=project_ids)
            .order_by("order", "name")
            .first()
        )
        if sprint is None:
            sprint = (
                ActiveBoardSprint.objects.filter(
                    status__iexact="active",
                    project_id__in=project_ids,
                )
                .order_by("order", "name")
                .first()
            )
        if sprint:
            active_sprint = {
                "id": str(sprint.pk),
                "name": sprint.name,
                "project_id": str(sprint.project_id or ""),
            }
            project = next(
                (
                    item
                    for item in assigned_projects
                    if active_sprint["project_id"]
                    in {
                        str(item.get("_id", "")),
                        str(item.get("id", "")),
                        str(item.get("key", "")),
                    }
                ),
                project,
            )
        else:
            project_references = set(project_ids)
            project_references.update(
                ObjectId(value)
                for value in project_ids
                if ObjectId.is_valid(value)
            )
            mongo_sprint = database.sprints.find_one(
                {
                    "$and": [
                        {
                            "$or": [
                                {"project_id": {"$in": list(project_references)}},
                                {"projectId": {"$in": list(project_references)}},
                            ]
                        },
                        {
                            "$or": [
                                {"status": {"$regex": "^active$", "$options": "i"}},
                                {"sprint_status": {"$regex": "^active$", "$options": "i"}},
                                {"sprintStatus": {"$regex": "^active$", "$options": "i"}},
                                {"isStarted": True},
                                {"is_started": True},
                                {"isActive": True},
                                {"is_active": True},
                            ]
                        },
                    ],
                },
                sort=[("order", 1), ("name", 1)],
            )
            if mongo_sprint:
                sprint_id = _as_text(
                    mongo_sprint.get("sprint_id")
                    or mongo_sprint.get("id")
                    or mongo_sprint.get("_id")
                )
                active_sprint = {
                    "id": sprint_id,
                    "name": _as_text(mongo_sprint.get("name")),
                    "project_id": _as_text(mongo_sprint.get("project_id")),
                }
                project = next(
                    (
                        item
                        for item in assigned_projects
                        if active_sprint["project_id"]
                        in {
                            str(item.get("_id", "")),
                            str(item.get("id", "")),
                            str(item.get("key", "")),
                        }
                    ),
                    project,
                )
    assigned_project = (
        {
            "id": str(project.get("_id", project.get("id", ""))),
            "name": _as_text(project.get("name") or project.get("key")),
        }
        if project
        else {}
    )
    return assigned_project, active_sprint or {}


class ReportOptionsView(APIView):
    permission_classes = [IsAuthenticated, EODReportRolePermission]

    def get(self, request):
        try:
            return Response(
                _available_options(
                    request.user,
                    request.query_params.get("project_id"),
                ),
                status=status.HTTP_200_OK,
            )
        except PyMongoError:
            return Response({"error": "Unable to retrieve report filter options."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class EODCommentsView(APIView):
    permission_classes = [IsAuthenticated, EODReportRolePermission]

    def get(self, request):
        validation_error = _filter_validation_error(request.query_params)
        if validation_error:
            return Response({"error": validation_error}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rows = _eod_comment_reports(request.user)
            return Response(_filter_reports(rows, request.query_params), status=status.HTTP_200_OK)
        except PyMongoError:
            return Response({"error": "Unable to retrieve EOD comments."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class EODReportListCreateView(APIView):
    permission_classes = [IsAuthenticated, EODReportRolePermission]

    def get(self, request):
        validation_error = _filter_validation_error(request.query_params)
        if validation_error:
            return Response({"error": validation_error}, status=status.HTTP_400_BAD_REQUEST)
        report_type = request.query_params.get("type", "daily").lower()
        if report_type not in {"daily", "monthly"}:
            return Response({"error": "Unsupported report type."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rows = _filtered_report_rows(
                request.user,
                request.query_params,
                report_type,
            )
            return Response({"count": len(rows), "results": rows}, status=status.HTTP_200_OK)
        except PyMongoError:
            return Response({"error": "Unable to retrieve reports."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    def post(self, request):
        serializer = ReportWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            values = dict(serializer.validated_data)
            assigned_project, active_sprint = _default_report_assignment(
                request.user,
                project_id=values.get("project_id"),
            )
            values.update(
                {
                    "employee_id": _user_id(request),
                    "employee": " ".join(
                        filter(
                            None,
                            [
                                str(getattr(request.user, "first_name", "") or "").strip(),
                                str(getattr(request.user, "last_name", "") or "").strip(),
                            ],
                        )
                    )
                    or str(getattr(request.user, "username", "") or getattr(request.user, "email", "")),
                    "project_id": assigned_project.get("id", ""),
                    "project": assigned_project.get("name", ""),
                    "sprint_id": active_sprint.get("id", ""),
                    "sprint": active_sprint.get("name", ""),
                }
            )
            _validate_report_project(request.user, values)
            now = timezone.now()
            document = {
                **values,
                "report_date": values["report_date"].isoformat(),
                "created_by": _user_id(request),
                "source": "manual",
                "created_at": now,
                "updated_at": now,
            }
            inserted = get_eod_reports_collection().insert_one(document)
            document["_id"] = inserted.inserted_id
            return Response(_serialize_report(document, request.user), status=status.HTTP_201_CREATED)
        except PyMongoError:
            return Response({"error": "Unable to create report."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class EODReportExportView(APIView):
    permission_classes = [IsAuthenticated, EODReportExportPermission]

    def get(self, request):
        validation_error = _filter_validation_error(request.query_params)
        if validation_error:
            return Response({"error": validation_error}, status=status.HTTP_400_BAD_REQUEST)
        report_type = request.query_params.get("type", "daily").lower()
        if report_type not in {"daily", "monthly"}:
            return Response({"error": "Unsupported report type."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rows = _filtered_report_rows(
                request.user,
                request.query_params,
                report_type,
            )
            filename_period = timezone.localdate().isoformat()
            if report_type == "monthly":
                year = request.query_params.get("year", "")
                month = request.query_params.get("month", "")
                filename_period = (
                    f"{year}-{month.zfill(2)}"
                    if year and month
                    else "all-periods"
                )
            filename = f"{report_type}-report-{filename_period}.docx"
            response = HttpResponse(
                _build_report_docx(report_type, rows),
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            return response
        except PyMongoError:
            return Response({"error": "Unable to export reports."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class EODReportDetailView(APIView):
    permission_classes = [IsAuthenticated, EODReportRolePermission]

    def _find(self, report_id):
        if not ObjectId.is_valid(report_id):
            return None
        return get_eod_reports_collection().find_one({"_id": ObjectId(report_id)})

    def _can_edit(self, request, document):
        return (
            document.get("created_by") == _user_id(request)
            or get_effective_role(request.user) in {"admin", "team_lead"}
        )

    def patch(self, request, report_id):
        try:
            document = self._find(report_id)
            if not document:
                return Response({"error": "Report not found."}, status=status.HTTP_404_NOT_FOUND)
            _validate_report_project(request.user, document)
            if not self._can_edit(request, document):
                return Response({"error": "You do not have permission to edit this report."}, status=status.HTTP_403_FORBIDDEN)
            serializer = ReportWriteSerializer(data={**document, **request.data}, partial=True)
            serializer.is_valid(raise_exception=True)
            _validate_report_project(request.user, serializer.validated_data)
            updates = dict(serializer.validated_data)
            if get_effective_role(request.user) not in {"admin", "team_lead"}:
                updates["employee_id"] = document.get("employee_id", "")
                updates["employee"] = document.get("employee", "")
                updates["project_id"] = document.get("project_id", "")
                updates["project"] = document.get("project", "")
                updates["sprint_id"] = document.get("sprint_id", "")
                updates["sprint"] = document.get("sprint", "")
            if isinstance(updates.get("report_date"), date):
                updates["report_date"] = updates["report_date"].isoformat()
            updates["updated_at"] = timezone.now()
            get_eod_reports_collection().update_one({"_id": document["_id"]}, {"$set": updates})
            return Response(_serialize_report({**document, **updates}, request.user), status=status.HTTP_200_OK)
        except PyMongoError:
            return Response({"error": "Unable to update report."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    def delete(self, request, report_id):
        try:
            document = self._find(report_id)
            if not document:
                return Response({"error": "Report not found."}, status=status.HTTP_404_NOT_FOUND)
            _validate_report_project(request.user, document)
            if not self._can_edit(request, document):
                return Response({"error": "You do not have permission to delete this report."}, status=status.HTTP_403_FORBIDDEN)
            get_eod_reports_collection().delete_one({"_id": document["_id"]})
            return Response(status=status.HTTP_204_NO_CONTENT)
        except PyMongoError:
            return Response({"error": "Unable to delete report."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
