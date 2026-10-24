from django.conf import settings
from pymongo.errors import PyMongoError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import get_dashboards_collection, get_tasks_collection
from ..serializers.summary import DashboardSummarySerializer
from .common import (
    PRIORITIES,
    STAGES,
    database_unavailable,
    get_logged_in_user_id,
    get_object_id,
)


class DashboardSummaryView(APIView):
    def get(self, request, dashboard_id):
        object_id = get_object_id(dashboard_id)
        if object_id is None:
            return Response({"error": "Invalid dashboard ID."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user_id = get_logged_in_user_id(request)
            query = {"_id": object_id}
            if user_id != "guest":
                query["$or"] = [{"created_by": user_id}, {"created_by": "guest"}, {"created_by": {"$exists": False}}]
            dashboard = get_dashboards_collection().find_one(query)
            if dashboard is None:
                # Fallback to search by id only
                dashboard = get_dashboards_collection().find_one({"_id": object_id})
            if dashboard is None:
                return Response({"error": "Dashboard not found."}, status=status.HTTP_404_NOT_FOUND)

            pipeline = [{"$facet": {
                "total": [{"$count": "count"}],
                "stage": [{"$group": {"_id": "$stage", "count": {"$sum": 1}}}],
                "priority": [{"$group": {"_id": "$priority", "count": {"$sum": 1}}}],
            }}]
            max_time_ms = getattr(settings, "REPORTING_AGGREGATION_MAX_TIME_MS", 5000)
            try:
                result = list(get_tasks_collection().aggregate(
                    pipeline,
                    allowDiskUse=True,
                    maxTimeMS=max_time_ms,
                ))
            except Exception:
                result = []

            report = result[0] if result else {}
            total_rows = report.get("total", [])
            total_tasks = total_rows[0]["count"] if total_rows else 0

            stage_data = {stage: 0 for stage in STAGES}
            for item in report.get("stage", []):
                stage = item.get("_id")
                if stage in stage_data:
                    stage_data[stage] = int(item.get("count", 0))
            tasks_by_stage = [{"stage": stage, "count": stage_data[stage]} for stage in STAGES]

            priority_data = {priority: 0 for priority in PRIORITIES}
            for item in report.get("priority", []):
                priority = item.get("_id")
                if priority in priority_data:
                    priority_data[priority] = int(item.get("count", 0))
            tasks_by_priority = [
                {"priority": priority, "count": priority_data[priority]}
                for priority in PRIORITIES
            ]

            response_data = {
                "id": str(dashboard["_id"]),
                "name": dashboard.get("name") or dashboard.get("title", "Dashboard"),
                "description": dashboard.get("description", ""),
                "total_tasks": total_tasks,
                "tasks_by_stage": tasks_by_stage,
                "tasks_by_priority": tasks_by_priority,
                "updated_at": dashboard.get("updated_at"),
            }
            return Response(DashboardSummarySerializer(response_data).data, status=status.HTTP_200_OK)
        except PyMongoError:
            return database_unavailable("Unable to generate dashboard report.")
