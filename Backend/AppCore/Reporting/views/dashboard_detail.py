from django.utils import timezone
from pymongo.errors import PyMongoError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import get_dashboards_collection
from ..serializers.dashboards import DashboardSerializer, DashboardWriteSerializer
from .common import convert_dashboard, database_unavailable, get_logged_in_user_id, get_object_id


class DashboardDetailView(APIView):
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
                return Response({"error": "Dashboard not found."}, status=status.HTTP_404_NOT_FOUND)
            return Response(DashboardSerializer(convert_dashboard(dashboard)).data, status=status.HTTP_200_OK)
        except PyMongoError:
            return database_unavailable("Unable to retrieve dashboard.")

    def patch(self, request, dashboard_id):
        object_id = get_object_id(dashboard_id)
        if object_id is None:
            return Response({"error": "Invalid dashboard ID."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = DashboardWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data:
            return Response({"error": "No fields provided for update."}, status=status.HTTP_400_BAD_REQUEST)
        update_data = dict(serializer.validated_data)
        update_data["updated_at"] = timezone.now()
        try:
            collection = get_dashboards_collection()
            query = {"_id": object_id}
            result = collection.update_one(query, {"$set": update_data})
            if result.matched_count == 0:
                return Response({"error": "Dashboard not found."}, status=status.HTTP_404_NOT_FOUND)
            dashboard = collection.find_one(query)
            if dashboard is None:
                return Response({"error": "Dashboard not found."}, status=status.HTTP_404_NOT_FOUND)
            return Response(DashboardSerializer(convert_dashboard(dashboard)).data, status=status.HTTP_200_OK)
        except PyMongoError:
            return database_unavailable("Unable to update dashboard.")

    def delete(self, request, dashboard_id):
        object_id = get_object_id(dashboard_id)
        if object_id is None:
            return Response({"error": "Invalid dashboard ID."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = get_dashboards_collection().delete_one({"_id": object_id})
            if result.deleted_count == 0:
                return Response({"error": "Dashboard not found."}, status=status.HTTP_404_NOT_FOUND)
            return Response({"message": "Dashboard deleted successfully."}, status=status.HTTP_200_OK)
        except PyMongoError:
            return database_unavailable("Unable to delete dashboard.")
