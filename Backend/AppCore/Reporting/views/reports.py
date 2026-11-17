import hashlib
import csv
import io
import json
import random
import re
import zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta

from bson import ObjectId
from django.db import DatabaseError
from django.utils import timezone
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from pymongo.errors import DuplicateKeyError, PyMongoError
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import xlrd

from AppCore.Backlog.models import Board, Sprint, Task
from AppCore.Auth.role_permissions import has_role_permission
from AppCore.db import get_database
from ..models import get_eod_reports_collection
from ..serializers.reports import ReportImportSerializer, ReportWriteSerializer


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
    "task",
    "activity",
    "work_completed",
    "status",
    "progress",
    "blockers",
    "next_steps",
    "source_data",
)


class EODReportRolePermission(BasePermission):
    def has_permission(self, request, view):
        return has_role_permission(request.user, "view_reports")


def _user_id(request):
    return str(getattr(request.user, "id", getattr(request.user, "pk", "")))


def _as_text(value):
    return "" if value is None else str(value)


def _serialize_report(document):
    result = {key: document.get(key, "") for key in REPORT_FIELDS}
    result["id"] = str(document.get("_id", document.get("id", "")))
    result["created_at"] = _as_text(document.get("created_at"))
    result["updated_at"] = _as_text(document.get("updated_at"))
    result["source"] = document.get("source", "manual")
    result["editable"] = result["source"] != "eod_comment" and not document.get("aggregate", False)
    result["period"] = document.get("period", "")
    result["entry_count"] = document.get("entry_count", 1)
    return result


def _eod_comment_reports():
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
                    "board_id": str(task.board_id or ""),
                    "project": task.board.name if task.board_id else "",
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
            "title": f"EOD update: {task.get('task', '') or 'Task'}",
            "report_type": "daily",
            "report_date": report_date,
            "project_id": task.get("board_id", ""),
            "project": task.get("project", ""),
            "sprint_id": task.get("sprint_id", ""),
            "sprint": task.get("sprint", ""),
            "employee_id": author_id,
            "employee": employee,
            "task": task.get("task", ""),
            "activity": text,
            "work_completed": text,
            "status": task.get("status", ""),
            "progress": None,
            "blockers": "",
            "next_steps": "",
            "source_data": {},
            "created_at": created_at,
            "updated_at": created_at,
            "source": "eod_comment",
            "editable": False,
            "period": "",
            "entry_count": 1,
        })
    return rows


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


def _aggregate_reports(rows, report_type):
    if report_type == "daily":
        return rows
    groups = defaultdict(list)
    for row in rows:
        if report_type == "monthly":
            group_key = (_as_text(row.get("report_date"))[:7], _as_text(row.get("employee_id")) or _as_text(row.get("employee")))
        elif report_type == "sprint":
            group_key = (_as_text(row.get("sprint_id")) or _as_text(row.get("sprint")),)
        else:
            group_key = (_as_text(row.get("project_id")) or _as_text(row.get("project")),)
        groups[group_key].append(row)

    aggregated = []
    for key, entries in groups.items():
        if report_type == "monthly":
            period = key[0]
            dimension, value = "employee", entries[0].get("employee", "")
            report_date = period
            title = f"{period} report - {value or 'Unassigned'}"
        elif report_type == "sprint":
            period = ""
            dimension, value = "sprint", entries[0].get("sprint", "")
            report_date = ""
            title = f"{value or 'Unassigned sprint'} report"
        else:
            period = ""
            dimension, value = "project", entries[0].get("project", "")
            report_date = ""
            title = f"{value or 'Unassigned project'} report"
        completed = [entry.get("work_completed") or entry.get("activity") for entry in entries]
        pending = [entry.get("next_steps") or entry.get("task") for entry in entries]
        blockers = [entry.get("blockers") for entry in entries]
        statuses = sorted({entry.get("status", "") for entry in entries if entry.get("status")})
        aggregated.append({
            "id": f"aggregate-{report_type}-{'-'.join(key)}",
            "title": title,
            "report_type": report_type,
            "report_date": report_date,
            "period": period,
            "project_id": entries[0].get("project_id", ""),
            "project": entries[0].get("project", ""),
            "sprint_id": entries[0].get("sprint_id", ""),
            "sprint": entries[0].get("sprint", ""),
            "employee_id": entries[0].get("employee_id", ""),
            "employee": entries[0].get("employee", ""),
            "task": f"{len(entries)} source entries",
            "activity": f"{dimension.title()}: {value or 'Unassigned'}",
            "work_completed": "\n".join(filter(None, completed)),
            "status": ", ".join(statuses),
            "progress": None,
            "blockers": "\n".join(filter(None, blockers)),
            "next_steps": "\n".join(filter(None, pending)),
            "source_data": {},
            "source": "aggregate",
            "editable": False,
            "entry_count": len(entries),
        })
    return aggregated


def _available_options():
    database = get_database()
    projects = []
    seen_projects = set()
    for board in Board.objects.all().order_by("name"):
        board_id = str(board.pk)
        projects.append({"id": board_id, "name": board.name})
        seen_projects.add(board_id)
    for project in database.projects.find({}).sort("name", 1).limit(1000):
        project_id = str(project.get("_id", project.get("id", "")))
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
        for sprint in Sprint.objects.all().order_by("order", "name")[:1000]
    ]
    for sprint in database.sprints.find({}).sort("order", 1).limit(1000):
        sprint_id = _as_text(sprint.get("sprint_id") or sprint.get("id") or sprint.get("_id"))
        if any(option["id"] == sprint_id for option in sprints):
            continue
        sprints.append({
            "id": sprint_id,
            "name": _as_text(sprint.get("name")),
        })
    users = []
    for user in database.users.find({"is_active": {"$ne": False}}).sort("username", 1).limit(1000):
        full_name = " ".join(filter(None, [user.get("first_name"), user.get("last_name")]))
        users.append({
            "id": str(user.get("_id", "")),
            "name": full_name or user.get("username") or user.get("email", ""),
        })
    return {"projects": projects, "sprints": sprints, "employees": users}


def _spreadsheet_value(value):
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _unique_headers(values):
    headers = []
    seen = set()
    for index, value in enumerate(values, start=1):
        base = _spreadsheet_value(value).strip() or f"Column {index}"
        header = base
        suffix = 2
        while header.casefold() in seen:
            header = f"{base} ({suffix})"
            suffix += 1
        headers.append(header)
        seen.add(header.casefold())
    return headers


def _spreadsheet_rows(table):
    try:
        headers = _unique_headers(next(table))
    except StopIteration:
        return [], []

    rows = []
    for row in table:
        values = list(row)
        if not any(_spreadsheet_value(value).strip() for value in values):
            continue
        rows.append({
            header: _spreadsheet_value(values[index]) if index < len(values) else ""
            for index, header in enumerate(headers)
        })
        if len(rows) > 1000:
            raise ValueError("This spreadsheet has more than 1,000 data rows. Split it into smaller files.")
    return headers, rows


def _parse_spreadsheet(upload):
    filename = upload.name.lower()
    raw = upload.read()
    if filename.endswith(".csv"):
        try:
            content = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            content = raw.decode("cp1252")
        return _spreadsheet_rows(iter(csv.reader(io.StringIO(content, newline=""))))
    if filename.endswith(".xlsx"):
        workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        try:
            if not workbook.worksheets:
                return [], []
            return _spreadsheet_rows(iter(workbook.worksheets[0].iter_rows(values_only=True)))
        finally:
            workbook.close()

    workbook = xlrd.open_workbook(file_contents=raw, on_demand=True)
    try:
        if workbook.nsheets == 0:
            return [], []
        worksheet = workbook.sheet_by_index(0)

        def values_by_row():
            for row_index in range(worksheet.nrows):
                values = []
                for col_index in range(worksheet.ncols):
                    cell = worksheet.cell(row_index, col_index)
                    value = cell.value
                    if cell.ctype == xlrd.XL_CELL_DATE:
                        value = xlrd.xldate.xldate_as_datetime(value, workbook.datemode)
                    values.append(value)
                yield values

        return _spreadsheet_rows(iter(values_by_row()))
    finally:
        workbook.release_resources()


class ReportOptionsView(APIView):
    permission_classes = [IsAuthenticated, EODReportRolePermission]

    def get(self, request):
        try:
            return Response(_available_options(), status=status.HTTP_200_OK)
        except PyMongoError:
            return Response({"error": "Unable to retrieve report filter options."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class EODSpreadsheetPreviewView(APIView):
    permission_classes = [IsAuthenticated, EODReportRolePermission]
    parser_classes = [MultiPartParser, FormParser]
    max_file_size = 15 * 1024 * 1024

    def post(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"error": "Select a spreadsheet file to preview."}, status=status.HTTP_400_BAD_REQUEST)
        extension = upload.name.rsplit(".", 1)[-1].lower()
        if extension not in {"xlsx", "xls", "csv"}:
            return Response({"error": "Only .xlsx, .xls, and .csv files are supported."}, status=status.HTTP_400_BAD_REQUEST)
        if upload.size > self.max_file_size:
            return Response({"error": "The spreadsheet must be smaller than 15 MB."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            headers, rows = _parse_spreadsheet(upload)
        except (InvalidFileException, zipfile.BadZipFile, xlrd.biffh.XLRDError, csv.Error, UnicodeDecodeError, ValueError) as error:
            return Response({"error": f"Unable to read spreadsheet: {error}"}, status=status.HTTP_400_BAD_REQUEST)
        if not headers or not rows:
            return Response({"error": "The spreadsheet must include a header row and at least one data row."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"headers": headers, "rows": rows}, status=status.HTTP_200_OK)


class EODCommentsView(APIView):
    permission_classes = [IsAuthenticated, EODReportRolePermission]

    def get(self, request):
        validation_error = _filter_validation_error(request.query_params)
        if validation_error:
            return Response({"error": validation_error}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response(_filter_reports(_eod_comment_reports(), request.query_params), status=status.HTTP_200_OK)
        except PyMongoError:
            return Response({"error": "Unable to retrieve EOD comments."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class EODReportListCreateView(APIView):
    permission_classes = [IsAuthenticated, EODReportRolePermission]

    def get(self, request):
        validation_error = _filter_validation_error(request.query_params)
        if validation_error:
            return Response({"error": validation_error}, status=status.HTTP_400_BAD_REQUEST)
        try:
            stored = [
                _serialize_report(row)
                for row in get_eod_reports_collection().find({}).sort("updated_at", -1).limit(5000)
            ]
            comments = _eod_comment_reports()
            report_type = request.query_params.get("type", "daily").lower()
            if report_type not in {"daily", "monthly", "sprint", "project"}:
                return Response({"error": "Unsupported report type."}, status=status.HTTP_400_BAD_REQUEST)
            rows = _filter_reports(stored + comments, request.query_params)
            if report_type in {"monthly", "sprint", "project"}:
                rows = _aggregate_reports(
                    [row for row in rows if row.get("report_type") == "daily"],
                    report_type,
                )
            elif report_type == "daily":
                rows = [row for row in rows if row.get("report_type") == "daily"]
            return Response({"count": len(rows), "results": rows}, status=status.HTTP_200_OK)
        except PyMongoError:
            return Response({"error": "Unable to retrieve reports."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    def post(self, request):
        serializer = ReportWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            now = timezone.now()
            document = {
                **serializer.validated_data,
                "report_date": serializer.validated_data["report_date"].isoformat(),
                "created_by": _user_id(request),
                "source": "manual",
                "created_at": now,
                "updated_at": now,
            }
            inserted = get_eod_reports_collection().insert_one(document)
            document["_id"] = inserted.inserted_id
            return Response(_serialize_report(document), status=status.HTTP_201_CREATED)
        except PyMongoError:
            return Response({"error": "Unable to create report."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class EODReportSampleDataView(APIView):
    permission_classes = [IsAuthenticated, EODReportRolePermission]

    def post(self, request):
        collection = get_eod_reports_collection()
        user_id = _user_id(request)
        try:
            collection.create_index(
                [("created_by", 1), ("sample_key", 1)],
                unique=True,
                partialFilterExpression={"sample_key": {"$exists": True}},
                name="eod_sample_report_deduplication",
            )
            sample_options = _available_options()
            existing = collection.find_one({
                "created_by": user_id,
                "source": "sample",
                "sample_key": {"$exists": True},
            })
        except PyMongoError:
            return Response({"error": "Unable to prepare sample reports."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if existing:
            count = collection.count_documents({"created_by": user_id, "source": "sample"})
            return Response(
                {"created": 0, "existing": count, "message": "Sample reports have already been added for this account."},
                status=status.HTTP_200_OK,
            )

        randomizer = random.SystemRandom()
        employees = sample_options["employees"] or [{
            "id": user_id,
            "name": getattr(request.user, "username", "") or getattr(request.user, "email", "You"),
        }]
        projects = sample_options["projects"]
        sprints = sample_options["sprints"]
        activities = [
            ("Completed API integration", "Connected the report views to the authenticated API.", "Verify the remaining edge cases."),
            ("Improved task filtering", "Reviewed assigned tasks and refined the report filters.", "Confirm the sprint filter with the team."),
            ("Updated project documentation", "Documented the latest implementation and rollout steps.", "Share the notes for review."),
            ("Resolved a workflow issue", "Investigated and corrected a task workflow issue.", "Monitor the workflow after deployment."),
            ("Prepared sprint updates", "Reviewed current sprint work and updated progress notes.", "Follow up on the remaining review items."),
            ("Finished UI improvements", "Completed report table layout and responsive behavior.", "Collect feedback from the project team."),
            ("Reviewed pending work", "Triaged outstanding work and clarified the next actions.", "Continue with the highest priority task."),
            ("Tested the latest changes", "Ran checks against the updated project functionality.", "Address any issues found during review."),
        ]
        statuses = ("In Progress", "In Review", "Done", "Ready to start")
        today = timezone.localdate()
        documents = []
        for index in range(12):
            task, completed, next_step = randomizer.choice(activities)
            employee = randomizer.choice(employees)
            project = randomizer.choice(projects) if projects else {}
            sprint = randomizer.choice(sprints) if sprints else {}
            report_date = today - timedelta(days=randomizer.randrange(0, 30))
            document = {
                "title": f"Sample: {task}",
                "report_type": "daily",
                "report_date": report_date.isoformat(),
                "project_id": project.get("id", ""),
                "project": project.get("name", ""),
                "sprint_id": sprint.get("id", ""),
                "sprint": sprint.get("name", ""),
                "employee_id": employee.get("id", ""),
                "employee": employee.get("name", ""),
                "task": task,
                "activity": f"EOD: {completed}",
                "work_completed": completed,
                "status": randomizer.choice(statuses),
                "progress": randomizer.randrange(15, 96),
                "blockers": randomizer.choice(("", "", "", "Waiting for review from a teammate.")),
                "next_steps": next_step,
                "source_data": {"sample": True},
                "created_by": user_id,
                "source": "sample",
                "sample_key": f"sample-v1-{index}",
                "created_at": timezone.now(),
                "updated_at": timezone.now(),
            }
            documents.append(document)

        created = 0
        try:
            for document in documents:
                try:
                    collection.insert_one(document)
                    created += 1
                except DuplicateKeyError:
                    continue
        except PyMongoError:
            return Response(
                {"error": "Unable to save all sample reports.", "created": created},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {"created": created, "existing": 12 - created, "message": f"Added {created} sample reports."},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class EODReportDetailView(APIView):
    permission_classes = [IsAuthenticated, EODReportRolePermission]

    def _find(self, report_id):
        if not ObjectId.is_valid(report_id):
            return None
        return get_eod_reports_collection().find_one({"_id": ObjectId(report_id)})

    def _can_edit(self, request, document):
        return document.get("created_by") == _user_id(request) or getattr(request.user, "role", "") == "admin"

    def patch(self, request, report_id):
        try:
            document = self._find(report_id)
            if not document:
                return Response({"error": "Report not found."}, status=status.HTTP_404_NOT_FOUND)
            if not self._can_edit(request, document):
                return Response({"error": "You do not have permission to edit this report."}, status=status.HTTP_403_FORBIDDEN)
            serializer = ReportWriteSerializer(data={**document, **request.data}, partial=True)
            serializer.is_valid(raise_exception=True)
            updates = dict(serializer.validated_data)
            if isinstance(updates.get("report_date"), date):
                updates["report_date"] = updates["report_date"].isoformat()
            updates["updated_at"] = timezone.now()
            get_eod_reports_collection().update_one({"_id": document["_id"]}, {"$set": updates})
            return Response(_serialize_report({**document, **updates}), status=status.HTTP_200_OK)
        except PyMongoError:
            return Response({"error": "Unable to update report."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    def delete(self, request, report_id):
        try:
            document = self._find(report_id)
            if not document:
                return Response({"error": "Report not found."}, status=status.HTTP_404_NOT_FOUND)
            if not self._can_edit(request, document):
                return Response({"error": "You do not have permission to delete this report."}, status=status.HTTP_403_FORBIDDEN)
            get_eod_reports_collection().delete_one({"_id": document["_id"]})
            return Response(status=status.HTTP_204_NO_CONTENT)
        except PyMongoError:
            return Response({"error": "Unable to delete report."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class EODReportImportView(APIView):
    permission_classes = [IsAuthenticated, EODReportRolePermission]

    def post(self, request):
        request_serializer = ReportImportSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        collection = get_eod_reports_collection()
        try:
            collection.create_index(
                [("import_hash", 1)],
                unique=True,
                sparse=True,
                name="eod_import_deduplication",
            )
        except PyMongoError:
            return Response({"error": "Unable to prepare spreadsheet import."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        imported = []
        errors = []
        duplicates = 0
        for index, row in enumerate(request_serializer.validated_data["rows"], start=1):
            serializer = ReportWriteSerializer(data=row)
            if not serializer.is_valid():
                errors.append({"row": index, "errors": serializer.errors})
                continue
            values = serializer.validated_data
            canonical = {
                **values,
                "report_type": "daily",
                "report_date": values["report_date"].isoformat(),
                "source_data": values.get("source_data", {}),
            }
            fingerprint = hashlib.sha256(
                f"{_user_id(request)}:{json.dumps(canonical, sort_keys=True, default=str, ensure_ascii=False)}".encode("utf-8")
            ).hexdigest()
            now = timezone.now()
            document = {
                **canonical,
                "created_by": _user_id(request),
                "source": "import",
                "import_hash": fingerprint,
                "created_at": now,
                "updated_at": now,
            }
            try:
                result = collection.insert_one(document)
            except DuplicateKeyError:
                duplicates += 1
                continue
            except PyMongoError:
                return Response(
                    {"error": "Unable to save imported report records.", "imported": len(imported), "duplicates": duplicates, "errors": errors},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            document["_id"] = result.inserted_id
            imported.append(_serialize_report(document))
        return Response(
            {"imported": len(imported), "duplicates": duplicates, "errors": errors, "results": imported},
            status=status.HTTP_200_OK,
        )
