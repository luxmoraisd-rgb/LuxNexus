
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument

from rest_framework import status, viewsets
from rest_framework.response import Response

from ..db import db
from ..serializers import GoalSerializer


class GoalViewSet(viewsets.ViewSet):
    @property
    def collection(self):
        return db["goals"]

    ALLOWED_SORT_FIELDS = {
        "name",
        "status",
        "progress",
        "time_period",
        "timePeriod",
        "team",
        "accountable_team",
        "owner",
        "created_at",
        "updated_at",
    }

    def _serialize_goal(self, goal):
        """Convert MongoDB fields into API-friendly values."""
        if not goal:
            return {}
        goal["id"] = str(goal.pop("_id", goal.get("id", "")))

        if isinstance(goal.get("parent"), ObjectId):
            goal["parent"] = str(goal["parent"])

        team_val = goal.get("accountable_team", goal.get("team", ""))
        goal["accountable_team"] = team_val
        goal["team"] = team_val

        period_val = goal.get("time_period", goal.get("timePeriod", ""))
        goal["time_period"] = period_val
        goal["timePeriod"] = period_val

        due_date_val = goal.get("due_date", goal.get("dueDate", ""))
        goal["due_date"] = due_date_val
        goal["dueDate"] = due_date_val

        status_summary_val = goal.get("status_summary", goal.get("statusSummary", ""))
        goal["status_summary"] = status_summary_val
        goal["statusSummary"] = status_summary_val

        if "comments" not in goal or not isinstance(goal["comments"], list):
            goal["comments"] = []

        return goal

    def list(self, request):
        """List goals with optional filters, sorting and pagination."""
        filters = {}

        for field in ("status", "team", "accountable_team", "owner", "time_period", "timePeriod"):
            value = request.query_params.get(field)
            if value:
                if field in ("team", "accountable_team"):
                    filters["accountable_team"] = value
                elif field in ("time_period", "timePeriod"):
                    filters["time_period"] = value
                else:
                    filters[field] = value

        search = request.query_params.get("search")
        if search:
            filters["name"] = {
                "$regex": search,
                "$options": "i",
            }

        ordering = request.query_params.get("ordering", "-updated_at")
        descending = ordering.startswith("-")
        sort_field = ordering[1:] if descending else ordering

        if sort_field not in self.ALLOWED_SORT_FIELDS:
            return Response(
                {"error": "Invalid ordering field"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        db_sort_field = sort_field
        if db_sort_field in ("team", "accountable_team"):
            db_sort_field = "accountable_team"
        elif db_sort_field in ("time_period", "timePeriod"):
            db_sort_field = "time_period"

        page = request.query_params.get("page", "1")
        page_size = request.query_params.get("page_size", "50")

        try:
            page = int(page)
            page_size = int(page_size)
        except (TypeError, ValueError):
            return Response(
                {"error": "page and page_size must be integers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if page < 1 or page_size < 1 or page_size > 100:
            return Response(
                {"error": "page must be positive and page_size must be 1–100"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total = self.collection.count_documents(filters)

        cursor = (
            self.collection.find(filters)
            .sort(db_sort_field, -1 if descending else 1)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )

        goals = [self._serialize_goal(goal) for goal in cursor]

        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "results": GoalSerializer(goals, many=True).data,
        })

    def retrieve(self, request, pk=None):
        try:
            goal_id = ObjectId(pk)
        except (InvalidId, TypeError):
            return Response(
                {"error": "Invalid goal ID"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        goal = self.collection.find_one({"_id": goal_id})

        if not goal:
            return Response(
                {"error": "Goal not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            GoalSerializer(self._serialize_goal(goal)).data
        )

    def create(self, request):
        serializer = GoalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)

        parent = data.get("parent")
        if parent:
            try:
                parent_id = ObjectId(parent)
            except (InvalidId, TypeError):
                return Response(
                    {"error": "Invalid parent ID"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not self.collection.find_one({"_id": parent_id}):
                return Response(
                    {"error": "Parent goal not found"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            parent_id = None

        now = datetime.now(timezone.utc)
        team_val = data.get("accountable_team") or data.get("team") or ""
        period_val = data.get("time_period") or data.get("timePeriod") or ""
        due_date_val = data.get("due_date") or data.get("dueDate") or ""
        status_summary_val = data.get("status_summary") or data.get("statusSummary") or ""

        document = {
            "name": data["name"],
            "status": data.get("status", "on track"),
            "progress": data.get("progress", 0),
            "accountable_team": team_val,
            "team": team_val,
            "time_period": period_val,
            "timePeriod": period_val,
            "owner": data.get("owner", None),
            "due_date": due_date_val,
            "dueDate": due_date_val,
            "status_summary": status_summary_val,
            "statusSummary": status_summary_val,
            "comments": data.get("comments", []),
            "privacy": data.get("privacy", ""),
            "parent": parent_id,
            "created_at": now,
            "updated_at": now,
        }

        result = self.collection.insert_one(document)
        document["_id"] = result.inserted_id

        return Response(
            GoalSerializer(self._serialize_goal(document)).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, pk=None):
        return self._update_goal(request, pk, partial=False)

    def partial_update(self, request, pk=None):
        return self._update_goal(request, pk, partial=True)

    def _update_goal(self, request, pk, partial):
        try:
            goal_id = ObjectId(pk)
        except (InvalidId, TypeError):
            return Response(
                {"error": "Invalid goal ID"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = self.collection.find_one({"_id": goal_id})

        if not existing:
            return Response(
                {"error": "Goal not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = GoalSerializer(
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)

        if "parent" in data:
            parent = data["parent"]

            if parent:
                try:
                    parent_id = ObjectId(parent)
                except (InvalidId, TypeError):
                    return Response(
                        {"error": "Invalid parent ID"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if parent_id == goal_id:
                    return Response(
                        {"error": "A goal cannot be its own parent"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if not self.collection.find_one({"_id": parent_id}):
                    return Response(
                        {"error": "Parent goal not found"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                
                ancestor_id = parent_id
                visited = set()

                while ancestor_id and ancestor_id not in visited:
                    if ancestor_id == goal_id:
                        return Response(
                            {"error": "Circular goal hierarchy is not allowed"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    visited.add(ancestor_id)
                    ancestor = self.collection.find_one(
                        {"_id": ancestor_id},
                        {"parent": 1},
                    )

                    if not ancestor:
                        break

                    ancestor_id = ancestor.get("parent")

                    if not isinstance(ancestor_id, ObjectId):
                        break

                data["parent"] = parent_id
            else:
                data["parent"] = None

        if "accountable_team" in data or "team" in data:
            team_val = data.get("accountable_team") if "accountable_team" in data else data.get("team", "")
            data["accountable_team"] = team_val
            data["team"] = team_val

        if "time_period" in data or "timePeriod" in data:
            period_val = data.get("time_period") if "time_period" in data else data.get("timePeriod", "")
            data["time_period"] = period_val
            data["timePeriod"] = period_val

        if "due_date" in data or "dueDate" in data:
            due_date_val = data.get("due_date") if "due_date" in data else data.get("dueDate", "")
            data["due_date"] = due_date_val
            data["dueDate"] = due_date_val

        if "status_summary" in data or "statusSummary" in data:
            status_summary_val = data.get("status_summary") if "status_summary" in data else data.get("statusSummary", "")
            data["status_summary"] = status_summary_val
            data["statusSummary"] = status_summary_val

        data["updated_at"] = datetime.now(timezone.utc)

        updated = self.collection.find_one_and_update(
            {"_id": goal_id},
            {"$set": data},
            return_document=ReturnDocument.AFTER,
        )

        return Response(
            GoalSerializer(self._serialize_goal(updated)).data
        )

    def destroy(self, request, pk=None):
        try:
            goal_id = ObjectId(pk)
        except (InvalidId, TypeError):
            return Response(
                {"error": "Invalid goal ID"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not self.collection.find_one({"_id": goal_id}):
            return Response(
                {"error": "Goal not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if self.collection.find_one({"parent": goal_id}):
            return Response(
                {"error": "Cannot delete a goal that has child goals"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self.collection.delete_one({"_id": goal_id})

        return Response(status=status.HTTP_204_NO_CONTENT)
