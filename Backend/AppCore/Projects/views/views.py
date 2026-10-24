import random
import re
from datetime import datetime, timezone
from bson import ObjectId
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..db import get_projects_collection
from ..models import ensure_seed_projects, serialize_project
from ..serializers.serializer import ProjectSerializer


def get_query_id(pk):
    """Attempt to parse pk into an ObjectId or return string."""
    if not pk:
        return None
    if ObjectId.is_valid(pk):
        return ObjectId(pk)
    return str(pk)


class ProjectViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    @property
    def collection(self):
        return get_projects_collection()

    def list(self, request):
        """List all workspace projects with optional search and category filters."""
        ensure_seed_projects()

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
        results = [serialize_project(doc) for doc in cursor]
        return Response(results, status=status.HTTP_200_OK)

    def retrieve(self, request, pk=None):
        """Get single project by ID or key."""
        ensure_seed_projects()

        doc = None
        if ObjectId.is_valid(pk):
            doc = self.collection.find_one({"_id": ObjectId(pk)})

        if not doc:
            doc = self.collection.find_one({"$or": [{"id": pk}, {"key": pk.upper()}]})

        if not doc:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(serialize_project(doc), status=status.HTTP_200_OK)

    def create(self, request):
        """Create a new project in MongoDB."""
        serializer = ProjectSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        name = data["name"].strip()

        # Generate unique project key if not provided
        key = data.get("key", "").strip()
        if not key:
            prefix = "".join([w[0].upper() for w in name.split() if w])[:4] or "PRJ"
            key = f"NEX-{prefix}-{random.randint(100, 999)}"

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
            "progress": data.get("progress", 0),
            "active_sprint_name": data.get("active_sprint_name") or data.get("activeSprintName", "Sprint 1"),
            "activeSprintName": data.get("active_sprint_name") or data.get("activeSprintName", "Sprint 1"),
            "start_date": data.get("start_date") or data.get("startDate", now.split("T")[0]),
            "startDate": data.get("start_date") or data.get("startDate", now.split("T")[0]),
            "created_by": str(getattr(request.user, "email", getattr(request.user, "username", "user"))),
            "created_at": now,
            "updated_at": now,
        }

        res = self.collection.insert_one(doc)
        doc["_id"] = res.inserted_id
        return Response(serialize_project(doc), status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        """Update fields on a project."""
        target_id = get_query_id(pk)
        query = {"_id": target_id} if isinstance(target_id, ObjectId) else {"$or": [{"_id": pk}, {"id": pk}]}

        existing = self.collection.find_one(query)
        if not existing:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        updates = {}
        for k in ("name", "key", "category", "description", "color", "progress"):
            if k in request.data:
                updates[k] = request.data[k]

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

        updates["updated_at"] = datetime.now(timezone.utc).isoformat()

        self.collection.update_one(query, {"$set": updates})
        updated_doc = self.collection.find_one(query)
        return Response(serialize_project(updated_doc), status=status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        """Delete project from MongoDB."""
        target_id = get_query_id(pk)
        query = {"_id": target_id} if isinstance(target_id, ObjectId) else {"$or": [{"_id": pk}, {"id": pk}]}

        res = self.collection.delete_one(query)
        if res.deleted_count == 0:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Aggregate workspace project metrics."""
        ensure_seed_projects()

        total_projects = self.collection.count_documents({})
        docs = list(self.collection.find({}))

        categories = {}
        total_progress = 0
        for doc in docs:
            cat = doc.get("category", "General")
            categories[cat] = categories.get(cat, 0) + 1
            total_progress += doc.get("progress", 0)

        avg_progress = round(total_progress / max(total_projects, 1))

        return Response(
            {
                "total_projects": total_projects,
                "categories": categories,
                "average_velocity": avg_progress,
                "active_workspaces": self.collection.count_documents(
                    {"$or": [{"is_default_workspace": True}, {"isDefaultWorkspace": True}]}
                ),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def set_active(self, request, pk=None):
        """Set project as the active default workspace."""
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
