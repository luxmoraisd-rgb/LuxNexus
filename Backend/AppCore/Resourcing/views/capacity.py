from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from resourcing.models import ResourcingProject
from resourcing.serializers.capacity import CapacityProjectSerializer


class CapacityPlanningView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = request.query_params.get("start")
        end = request.query_params.get("end")
        projects = ResourcingProject.objects.filter(created_by=request.user).prefetch_related("allocations__user")
        if start:
            projects = projects.filter(end_date__gte=start)
        if end:
            projects = projects.filter(start_date__lte=end)
        serializer = CapacityProjectSerializer(projects, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
