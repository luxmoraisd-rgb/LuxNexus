from rest_framework import status, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q

from AppCore.Backlog.models.model import Sprint, Task
from AppCore.Backlog.serializers.serializer import SprintSerializer, TaskSerializer
from AppCore.Auth.role_permissions import AdminOnlyDeletePermission, RoleModulePermission
from AppCore.project_access import (
    accessible_project_ids,
    is_project_admin,
    require_project_access,
    task_project_id,
)


class AllSprintsOverviewView(APIView):
    """
    GET /api/all-sprints/
    Returns all sprints across the project with aggregated statistics:
    - metrics: total_sprints, active_sprints, planned_sprints, completed_sprints, total_sp, active_sp, planned_sp, completed_sp
    - sprints: serialized list of sprints with tasks, duration, and story point breakdown
    - tasks: all tasks in the project
    """
    permission_classes = [IsAuthenticated, RoleModulePermission]

    def get(self, request):
        sprints_qs = Sprint.objects.all().prefetch_related('tasks').order_by('order', '-created_at')
        project_ids = accessible_project_ids(request.user)
        if project_ids is not None:
            sprints_qs = sprints_qs.filter(project_id__in=project_ids)

        status_filter = request.query_params.get('status')
        if status_filter:
            status_map = {
                'active': 'active',
                'planned': 'future',
                'future': 'future',
                'completed': 'completed',
            }
            mapped = status_map.get(status_filter.lower(), status_filter.lower())
            sprints_filtered = sprints_qs.filter(status=mapped)
        else:
            sprints_filtered = sprints_qs

        search = request.query_params.get('search')
        if search:
            sprints_filtered = sprints_filtered.filter(name__icontains=search.strip())

        requested_project = request.query_params.get('project_id')
        if requested_project:
            require_project_access(request.user, requested_project)
            sprints_qs = sprints_qs.filter(project_id=requested_project)
            sprints_filtered = sprints_filtered.filter(project_id=requested_project)

        all_sprints = list(sprints_qs)
        def sprint_tasks(sprint):
            tasks = sprint.tasks.all()
            return (
                tasks
                if project_ids is None
                else tasks.filter(Q(project_id__in=project_ids) | Q(project_id=""))
            )

        active_sprints = [s for s in all_sprints if s.status == 'active']
        planned_sprints = [s for s in all_sprints if s.status == 'future']
        completed_sprints = [s for s in all_sprints if s.status == 'completed']

        total_sp = sum(task.estimated_sp for sprint in all_sprints for task in sprint_tasks(sprint))
        active_sp = sum(task.estimated_sp for sprint in active_sprints for task in sprint_tasks(sprint))
        planned_sp = sum(task.estimated_sp for sprint in planned_sprints for task in sprint_tasks(sprint))
        completed_sp = sum(task.estimated_sp for sprint in completed_sprints for task in sprint_tasks(sprint))

        metrics = {
            'total_sprints': len(all_sprints),
            'active_sprints': len(active_sprints),
            'planned_sprints': len(planned_sprints),
            'completed_sprints': len(completed_sprints),
            'total_sp': total_sp,
            'active_sp': active_sp,
            'planned_sp': planned_sp,
            'completed_sp': completed_sp,
            'total_tasks': sum(sprint_tasks(s).count() for s in all_sprints),
        }

        all_tasks_qs = Task.objects.all().select_related('sprint', 'owner', 'board').order_by('order', '-created_at')
        if project_ids is not None:
            all_tasks_qs = all_tasks_qs.filter(
                (
                    Q(project_id__in=project_ids)
                    & (
                        Q(sprint__isnull=True)
                        | Q(sprint__project_id__in=project_ids)
                    )
                )
                | Q(project_id="", sprint__project_id__in=project_ids)
            )

        return Response({
            'metrics': metrics,
            'sprints': SprintSerializer(
                sprints_filtered, many=True, context={"request": request}
            ).data,
            'all_sprints_summary': SprintSerializer(
                all_sprints, many=True, context={"request": request}
            ).data,
            'tasks': TaskSerializer(
                all_tasks_qs,
                many=True,
                context={"request": request},
            ).data,
        }, status=status.HTTP_200_OK)


class SprintViewSet(viewsets.ModelViewSet):
    permission_classes = [
        IsAuthenticated,
        RoleModulePermission,
        AdminOnlyDeletePermission,
    ]
    queryset = Sprint.objects.all().prefetch_related('tasks').order_by('order', '-created_at')
    serializer_class = SprintSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'status', 'goals']
    ordering_fields = ['name', 'start_date', 'end_date', 'created_at', 'order']

    def get_queryset(self):
        queryset = Sprint.objects.all().prefetch_related('tasks').order_by('order', '-created_at')
        requested_project = self.request.query_params.get("project_id")
        if requested_project:
            require_project_access(self.request.user, requested_project)
        project_ids = accessible_project_ids(self.request.user)
        if project_ids is not None:
            queryset = queryset.filter(project_id__in=project_ids)
        s_status = self.request.query_params.get('status')
        if s_status:
            status_map = {
                'active': 'active',
                'planned': 'future',
                'future': 'future',
                'completed': 'completed',
            }
            mapped = status_map.get(s_status.lower(), s_status.lower())
            queryset = queryset.filter(status=mapped)
        return queryset

    def get_object(self):
        obj = get_object_or_404(Sprint.objects.all(), pk=self.kwargs["pk"])
        require_project_access(self.request.user, obj.project_id)
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        project_id = serializer.validated_data.get("project_id")
        if project_id:
            require_project_access(self.request.user, project_id)
        elif not is_project_admin(self.request.user):
            raise PermissionDenied("A project assignment is required.")
        serializer.save()

    def perform_update(self, serializer):
        project_id = serializer.validated_data.get(
            "project_id", serializer.instance.project_id
        )
        if project_id:
            require_project_access(self.request.user, project_id)
        elif not is_project_admin(self.request.user):
            raise PermissionDenied("A project assignment is required.")
        serializer.save()


class TaskViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, RoleModulePermission]
    queryset = Task.objects.all().select_related('sprint', 'owner', 'board').order_by('order', '-created_at')
    serializer_class = TaskSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['title', 'task_key', 'epic', 'description']
    ordering_fields = ['title', 'estimated_sp', 'created_at', 'order']

    def get_queryset(self):
        queryset = Task.objects.all().select_related('sprint', 'owner', 'board').order_by('order', '-created_at')
        requested_project = self.request.query_params.get("project_id")
        if requested_project:
            require_project_access(self.request.user, requested_project)
        project_ids = accessible_project_ids(self.request.user)
        if project_ids is not None:
            queryset = queryset.filter(
                (
                    Q(project_id__in=project_ids)
                    & (
                        Q(sprint__isnull=True)
                        | Q(sprint__project_id__in=project_ids)
                    )
                )
                | Q(project_id="", sprint__project_id__in=project_ids)
            )
        if requested_project:
            queryset = queryset.filter(
                Q(project_id=requested_project)
                | Q(project_id="", sprint__project_id=requested_project)
            )
        t_status = self.request.query_params.get('status')
        if t_status:
            queryset = queryset.filter(status__iexact=t_status)
        owner = self.request.query_params.get('owner')
        if owner:
            queryset = queryset.filter(owner__username__iexact=owner)
        sprint = self.request.query_params.get('sprint')
        if sprint:
            queryset = queryset.filter(sprint_id=sprint)
        task_type = self.request.query_params.get('task_type') or self.request.query_params.get('type')
        if task_type:
            queryset = queryset.filter(task_type__iexact=task_type)
        return queryset

    def get_object(self):
        obj = get_object_or_404(Task.objects.all(), pk=self.kwargs["pk"])
        require_project_access(self.request.user, task_project_id(obj))
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        project_id = serializer.validated_data.get("project_id")
        if project_id:
            require_project_access(self.request.user, project_id)
        elif not is_project_admin(self.request.user):
            raise PermissionDenied("A project assignment is required.")
        sprint = serializer.validated_data.get("sprint")
        if sprint:
            require_project_access(self.request.user, sprint.project_id)
        serializer.save()

    def perform_update(self, serializer):
        project_id = serializer.validated_data.get(
            "project_id", task_project_id(serializer.instance)
        )
        if project_id:
            require_project_access(self.request.user, project_id)
        elif not is_project_admin(self.request.user):
            raise PermissionDenied("A project assignment is required.")
        sprint = serializer.validated_data.get("sprint", serializer.instance.sprint)
        if sprint:
            require_project_access(self.request.user, sprint.project_id)
        serializer.save()