from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from resourcing.models import ResourcingProject
from resourcing.serializers.projects import ResourcingProjectSerializer
from .common import valid_object_id


class ResourcingProjectListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        projects = (
            ResourcingProject.objects.filter(created_by=request.user)
            .prefetch_related("allocations__user")
        )
        serializer = ResourcingProjectSerializer(projects, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ResourcingProjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = serializer.save(created_by=request.user)
        return Response(
            ResourcingProjectSerializer(project).data,
            status=status.HTTP_201_CREATED,
        )


class ResourcingProjectDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, project_id, user):
        if not valid_object_id(project_id):
            return None
        try:
            return ResourcingProject.objects.get(id=project_id, created_by=user)
        except ResourcingProject.DoesNotExist:
            return None

    def get(self, request, project_id):
        project = self.get_object(project_id, request.user)
        if project is None:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ResourcingProjectSerializer(project).data, status=status.HTTP_200_OK)

    def put(self, request, project_id):
        project = self.get_object(project_id, request.user)
        if project is None:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ResourcingProjectSerializer(project, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, project_id):
        project = self.get_object(project_id, request.user)
        if project is None:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ResourcingProjectSerializer(project, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, project_id):
        project = self.get_object(project_id, request.user)
        if project is None:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
