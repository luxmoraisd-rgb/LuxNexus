from django.conf import settings
from django.utils import timezone
from pymongo.errors import PyMongoError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import get_dashboards_collection
from ..serializers.dashboards import DashboardSerializer, DashboardWriteSerializer
from .common import convert_dashboard, database_unavailable, get_logged_in_user_id


class DashboardListCreateView(APIView):
    def get(self, request):
        try:
            user_id = get_logged_in_user_id(request)
            limit = getattr(settings, "REPORTING_MAX_DASHBOARDS", 100)
            query = (
                {"$or": [{"created_by": user_id}, {"created_by": "guest"}, {"created_by": {"$exists": False}}]}
                if user_id != "guest"
                else {}
            )
            dashboards = (
                get_dashboards_collection()
                .find(query)
                .sort("updated_at", -1)
                .limit(limit)
            )
            data = [convert_dashboard(item) for item in dashboards]
            return Response(DashboardSerializer(data, many=True).data, status=status.HTTP_200_OK)
        except PyMongoError:
            return database_unavailable("Unable to retrieve dashboards.")

    def post(self, request):
        serializer = DashboardWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            now = timezone.now()
            name = serializer.validated_data.get("name") or serializer.validated_data.get("title")
            dashboard = {
                "name": name,
                "title": name,
                "description": serializer.validated_data.get("description", ""),
                "type": serializer.validated_data.get("type", "purple"),
                "starred": serializer.validated_data.get("starred", False),
                "icon": serializer.validated_data.get("icon", "chart"),
                "created_by": get_logged_in_user_id(request),
                "created_at": now,
                "updated_at": now,
            }
            result = get_dashboards_collection().insert_one(dashboard)
            dashboard["_id"] = result.inserted_id
            return Response(
                DashboardSerializer(convert_dashboard(dashboard)).data,
                status=status.HTTP_201_CREATED,
            )
        except PyMongoError:
            return database_unavailable("Unable to create dashboard.")
