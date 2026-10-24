from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from resourcing.models import ResourceAllocation
from resourcing.serializers.allocations import ResourceAllocationSerializer
from .common import valid_object_id


class ResourceAllocationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        allocations = ResourceAllocation.objects.filter(project__created_by=request.user).select_related("project", "user")
        return Response(ResourceAllocationSerializer(allocations, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ResourceAllocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = serializer.validated_data["project"]
        if project.created_by != request.user:
            return Response(
                {"detail": "You do not have permission to modify this project."},
                status=status.HTTP_403_FORBIDDEN,
            )
        allocation = serializer.save()
        return Response(ResourceAllocationSerializer(allocation).data, status=status.HTTP_201_CREATED)


class ResourceAllocationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, allocation_id, user):
        if not valid_object_id(allocation_id):
            return None
        try:
            return ResourceAllocation.objects.select_related("project", "user").get(
                id=allocation_id, project__created_by=user
            )
        except ResourceAllocation.DoesNotExist:
            return None

    def get(self, request, allocation_id):
        allocation = self.get_object(allocation_id, request.user)
        if allocation is None:
            return Response({"detail": "Allocation not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ResourceAllocationSerializer(allocation).data, status=status.HTTP_200_OK)

    def put(self, request, allocation_id):
        allocation = self.get_object(allocation_id, request.user)
        if allocation is None:
            return Response({"detail": "Allocation not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ResourceAllocationSerializer(allocation, data=request.data)
        serializer.is_valid(raise_exception=True)
        target_project = serializer.validated_data.get("project", allocation.project)
        if target_project.created_by != request.user:
            return Response(
                {"detail": "You do not have permission to modify this project."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, allocation_id):
        allocation = self.get_object(allocation_id, request.user)
        if allocation is None:
            return Response({"detail": "Allocation not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ResourceAllocationSerializer(allocation, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        target_project = serializer.validated_data.get("project", allocation.project)
        if target_project.created_by != request.user:
            return Response(
                {"detail": "You do not have permission to modify this project."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, allocation_id):
        allocation = self.get_object(allocation_id, request.user)
        if allocation is None:
            return Response({"detail": "Allocation not found."}, status=status.HTTP_404_NOT_FOUND)
        allocation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
