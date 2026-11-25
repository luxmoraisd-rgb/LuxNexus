import random
import re
from datetime import datetime, timezone
from bson import ObjectId
from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from gridfs import GridFSBucket
from gridfs.errors import NoFile

from AppCore.Auth.role_permissions import (
    RoleCapabilityPermission,
    RoleModulePermission,
)
from ..db import get_database, get_projects_collection
from ..models import serialize_project
from ..serializers.serializer import ProjectSerializer
from ...project_access import (
    is_project_admin,
    project_is_assigned_to,
    require_admin,
    require_project_access,
)


def get_query_id(pk):
    """Attempt to parse pk into an ObjectId or return string."""
    if not pk:
        return None
    if ObjectId.is_valid(pk):
        return ObjectId(pk)
    return str(pk)


def validate_project_members(member_ids):
    invalid_ids = [member_id for member_id in member_ids if not ObjectId.is_valid(member_id)]
    if invalid_ids:
        raise ValidationError({"members": ["Select valid app members."]})

    object_ids = [ObjectId(member_id) for member_id in member_ids]
    existing_ids = {
        str(user["_id"])
        for user in get_database().users.find(
            {"_id": {"$in": object_ids}},
            {"_id": 1},
        )
    }
    if existing_ids != set(member_ids):
        raise ValidationError({"members": ["One or more selected members do not exist."]})


def delete_project_data(database, project):
    project_ids = {
        str(value)
        for value in (project.get("_id"), project.get("id"), project.get("key"))
        if value is not None and str(value).strip()
    }

    from AppCore.Backlog.models import Sprint as BacklogSprint, Task as BacklogTask
    from AppCore.ActiveSprint.models import Sprint as ActiveSprint, Task as ActiveTask

    backlog_related_sprint_ids = list(
        BacklogTask.objects.filter(project_id__in=project_ids)
        .exclude(sprint_id__isnull=True)
        .values_list("sprint_id", flat=True)
    )
    active_related_sprint_ids = list(
        ActiveTask.objects.filter(project_id__in=project_ids)
        .exclude(sprint_id__isnull=True)
        .values_list("sprint_id", flat=True)
    )
    backlog_sprints = BacklogSprint.objects.filter(
        Q(project_id__in=project_ids) | Q(pk__in=backlog_related_sprint_ids)
    )
    active_sprints = ActiveSprint.objects.filter(
        Q(project_id__in=project_ids) | Q(pk__in=active_related_sprint_ids)
    )
    backlog_sprint_ids = list(backlog_sprints.values_list("id", flat=True))
    active_sprint_ids = list(active_sprints.values_list("id", flat=True))
    backlog_tasks = BacklogTask.objects.filter(
        Q(project_id__in=project_ids)
        | Q(project_id="", sprint_id__in=backlog_sprint_ids)
    )
    active_tasks = ActiveTask.objects.filter(
        Q(project_id__in=project_ids)
        | Q(project_id="", sprint_id__in=active_sprint_ids)
    )
    backlog_task_ids = [str(task_id) for task_id in backlog_tasks.values_list("id", flat=True)]
    if backlog_task_ids:
        assets = list(
            database.board_assets.find({"task_id": {"$in": backlog_task_ids}})
        )
        archive_assets = [
            asset
            for asset in assets
            if asset.get("kind") == "archive" and asset.get("gridfs_id")
        ]
        if archive_assets:
            bucket = GridFSBucket(database, bucket_name="board_assets")
            for asset in archive_assets:
                try:
                    bucket.delete(asset["gridfs_id"])
                except NoFile:
                    pass
        database.board_assets.delete_many({"task_id": {"$in": backlog_task_ids}})
        database.backlog_task_comments.delete_many(
            {"task_id": {"$in": backlog_task_ids}}
        )

    with transaction.atomic():
        backlog_tasks.delete()
        active_tasks.delete()
        backlog_sprints.delete()
        active_sprints.delete()

    project_refs = list(project_ids)
    project_refs.extend(
        ObjectId(value) for value in project_ids if ObjectId.is_valid(value)
    )
    database.allocations.delete_many({"project": {"$in": project_refs}})


class ProjectViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, RoleModulePermission, RoleCapabilityPermission]
    role_capabilities = {
        "GET": "view_tasks",
        "POST": "manage_portfolios",
        "PATCH": "manage_portfolios",
        "PUT": "manage_portfolios",
        "DELETE": "manage_portfolios",
    }

    @property
    def collection(self):
        return get_projects_collection()

    def list(self, request):
        """List all workspace projects with optional search and category filters."""
        query = {}
        category = request.query_params.get("category")
        if category and category.lower() != "all":
            query["category"] = {"$regex": f"^{re.escape(category)}$", "$options": "i"}

        search = request.query_params.get("search")
        if search:
            escaped = re.escape(search.strip())
            query["$or"] = [
                {"name": {"$regex": escaped, "$options": "i"}},
                {"key": {"$regex": escaped, "$options": "i"}},
                {"description": {"$regex": escaped, "$options": "i"}},
            ]

        cursor = self.collection.find(query).sort("created_at", -1)
        is_admin = is_project_admin(request.user)
        results = [
            serialize_project(doc)
            for doc in cursor
            if is_admin or project_is_assigned_to(request.user, doc)
        ]
        return Response(results, status=status.HTTP_200_OK)

    def retrieve(self, request, pk=None):
        """Get single project by ID or key."""
        doc = None
        if ObjectId.is_valid(pk):
            doc = self.collection.find_one({"_id": ObjectId(pk)})

        if not doc:
            doc = self.collection.find_one({"$or": [{"id": pk}, {"key": pk.upper()}]})

        if not doc:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        require_project_access(request.user, str(doc.get("_id", doc.get("id", pk))))
        return Response(serialize_project(doc), status=status.HTTP_200_OK)

    def create(self, request):
        """Create a new project in MongoDB."""
        serializer = ProjectSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        validate_project_members(data.get("members", []))
        name = data["name"].strip()
        if not is_project_admin(request.user):
            assigned_identity = str(
                getattr(request.user, "email", "")
                or getattr(request.user, "username", "")
            )
            data["lead"] = assigned_identity
            data["project_lead"] = assigned_identity

        # Generate an unused key when the client does not supply one.
        key = data.get("key", "").strip()
        if not key:
            prefix = "".join([w[0].upper() for w in name.split() if w])[:4] or "PRJ"
            first_number = random.randrange(900)
            for offset in range(900):
                candidate = f"NEX-{prefix}-{100 + (first_number + offset) % 900}"
                if not self.collection.find_one({
                    "key": {"$regex": f"^{re.escape(candidate)}$", "$options": "i"}
                }):
                    key = candidate
                    break
            else:
                return Response(
                    {"key": ["No project keys are available for this name."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            key = key.upper()
            if self.collection.find_one({"key": {"$regex": f"^{re.escape(key)}$", "$options": "i"}}):
                return Response({"key": ["A project with this key already exists."]}, status=status.HTTP_400_BAD_REQUEST)

        now = datetime.now(timezone.utc).isoformat()
        is_default = bool(data.get("is_default_workspace") or data.get("isDefaultWorkspace"))

        # If marking this project as active workspace, unset others
        if is_default:
            self.collection.update_many(
                {},
                {"$set": {"is_default_workspace": False, "isDefaultWorkspace": False}},
            )

        doc = {
            "name": name,
            "key": key.upper(),
            "category": data.get("category", "Engineering"),
            "description": data.get("description", ""),
            "color": data.get("color", "#6366f1"),
            "is_default_workspace": is_default,
            "isDefaultWorkspace": is_default,
            "active_sprint_name": data.get("active_sprint_name") or data.get("activeSprintName", "Sprint 1"),
            "activeSprintName": data.get("active_sprint_name") or data.get("activeSprintName", "Sprint 1"),
            "start_date": data.get("start_date") or data.get("startDate", now.split("T")[0]),
            "startDate": data.get("start_date") or data.get("startDate", now.split("T")[0]),
            "end_date": data.get("end_date") or data.get("endDate", ""),
            "endDate": data.get("end_date") or data.get("endDate", ""),
            "status": data.get("status", "Active"),
            "lead": data.get("lead") or data.get("project_lead", ""),
            "project_lead": data.get("lead") or data.get("project_lead", ""),
            "members": data.get("members", []),
            "created_by": str(getattr(request.user, "email", getattr(request.user, "username", "user"))),
            "created_at": now,
            "updated_at": now,
        }

        res = self.collection.insert_one(doc)
        doc["_id"] = res.inserted_id
        return Response(serialize_project(doc), status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        """Update fields on a project."""
        if any(field in request.data for field in ("lead", "project_lead", "members")) and not is_project_admin(
            request.user
        ):
            raise PermissionDenied("Only Admin users can change project assignments.")
        target_id = get_query_id(pk)
        query = {"_id": target_id} if isinstance(target_id, ObjectId) else {"$or": [{"_id": pk}, {"id": pk}]}

        existing = self.collection.find_one(query)
        if not existing:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        require_project_access(
            request.user, str(existing.get("_id", existing.get("id", pk)))
        )

        updates = {}
        if "members" in request.data:
            member_serializer = ProjectSerializer(data={"name": "validation", "members": request.data["members"]})
            member_serializer.is_valid(raise_exception=True)
            updates["members"] = member_serializer.validated_data["members"]
            validate_project_members(updates["members"])
        for k in ("name", "key", "category", "description", "color", "status", "lead", "project_lead"):
            if k in request.data:
                updates[k] = request.data[k]
        if "key" in updates:
            updates["key"] = str(updates["key"]).strip().upper()
            if self.collection.find_one({
                "key": {"$regex": f"^{re.escape(updates['key'])}$", "$options": "i"},
                "_id": {"$ne": existing["_id"]},
            }):
                return Response({"key": ["A project with this key already exists."]}, status=status.HTTP_400_BAD_REQUEST)

        if "is_default_workspace" in request.data or "isDefaultWorkspace" in request.data:
            val = bool(request.data.get("is_default_workspace", request.data.get("isDefaultWorkspace")))
            updates["is_default_workspace"] = val
            updates["isDefaultWorkspace"] = val
            if val:
                self.collection.update_many(
                    {},
                    {"$set": {"is_default_workspace": False, "isDefaultWorkspace": False}},
                )

        if "active_sprint_name" in request.data or "activeSprintName" in request.data:
            sprint_val = request.data.get("active_sprint_name", request.data.get("activeSprintName"))
            updates["active_sprint_name"] = sprint_val
            updates["activeSprintName"] = sprint_val

        if "start_date" in request.data or "startDate" in request.data:
            date_val = request.data.get("start_date", request.data.get("startDate"))
            updates["start_date"] = date_val
            updates["startDate"] = date_val

        if "end_date" in request.data or "endDate" in request.data:
            date_val = request.data.get("end_date", request.data.get("endDate"))
            updates["end_date"] = date_val
            updates["endDate"] = date_val

        updates["updated_at"] = datetime.now(timezone.utc).isoformat()

        self.collection.update_one(query, {"$set": updates})
        updated_doc = self.collection.find_one(query)
        return Response(serialize_project(updated_doc), status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        """Delete project from MongoDB."""
        require_admin(request.user)
        target_id = get_query_id(pk)
        query = {"_id": target_id} if isinstance(target_id, ObjectId) else {"$or": [{"_id": pk}, {"id": pk}]}

        existing_doc = self.collection.find_one(query)
        if not existing_doc:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        delete_project_data(get_database(), existing_doc)
        res = self.collection.delete_one(query)
        if res.deleted_count == 0:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Aggregate workspace project metrics."""
        is_admin = is_project_admin(request.user)
        docs = [
            doc
            for doc in self.collection.find({})
            if is_admin or project_is_assigned_to(request.user, doc)
        ]
        total_projects = len(docs)

        categories = {}
        for doc in docs:
            cat = doc.get("category", "General")
            categories[cat] = categories.get(cat, 0) + 1

        return Response(
            {
                "total_projects": total_projects,
                "categories": categories,
                "active_workspaces": sum(
                    1
                    for doc in docs
                    if doc.get("is_default_workspace", doc.get("isDefaultWorkspace", False))
                ),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def set_active(self, request, pk=None):
        """Set project as the active default workspace."""
        require_admin(request.user)
        target_id = get_query_id(pk)
        query = {"_id": target_id} if isinstance(target_id, ObjectId) else {"$or": [{"_id": pk}, {"id": pk}]}

        existing = self.collection.find_one(query)
        if not existing:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        # Unset all others
        self.collection.update_many(
            {},
            {"$set": {"is_default_workspace": False, "isDefaultWorkspace": False}},
        )

        # Set this one
        self.collection.update_one(
            query,
            {"$set": {"is_default_workspace": True, "isDefaultWorkspace": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )

        updated_doc = self.collection.find_one(query)
        return Response(serialize_project(updated_doc), status=status.HTTP_200_OK)
