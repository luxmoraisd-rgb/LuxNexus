from rest_framework import status, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from AppCore.Backlog.models.model import Sprint, Task
from AppCore.Backlog.serializers.serializer import SprintSerializer, TaskSerializer


class AllSprintsOverviewView(APIView):
    """
    GET /api/all-sprints/
    Returns all sprints across the project with aggregated statistics:
    - metrics: total_sprints, active_sprints, planned_sprints, completed_sprints, total_sp, active_sp, planned_sp, completed_sp
    - sprints: serialized list of sprints with tasks, duration, and story point breakdown
    - tasks: all tasks in the project
    """
    permission_classes = [AllowAny]

    def get(self, request):
        sprints_qs = Sprint.objects.all().prefetch_related('tasks').order_by('order', '-created_at')

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

        all_sprints = list(sprints_qs)
        active_sprints = [s for s in all_sprints if s.status == 'active']
        planned_sprints = [s for s in all_sprints if s.status == 'future']
        completed_sprints = [s for s in all_sprints if s.status == 'completed']

        total_sp = sum(s.total_sp for s in all_sprints)
        active_sp = sum(s.total_sp for s in active_sprints)
        planned_sp = sum(s.total_sp for s in planned_sprints)
        completed_sp = sum(s.total_sp for s in completed_sprints)

        metrics = {
            'total_sprints': len(all_sprints),
            'active_sprints': len(active_sprints),
            'planned_sprints': len(planned_sprints),
            'completed_sprints': len(completed_sprints),
            'total_sp': total_sp,
            'active_sp': active_sp,
            'planned_sp': planned_sp,
            'completed_sp': completed_sp,
            'total_tasks': sum(s.tasks.count() for s in all_sprints),
        }

        all_tasks_qs = Task.objects.all().select_related('sprint', 'owner', 'board').order_by('order', '-created_at')

        return Response({
            'metrics': metrics,
            'sprints': SprintSerializer(sprints_filtered, many=True).data,
            'all_sprints_summary': SprintSerializer(all_sprints, many=True).data,
            'tasks': TaskSerializer(all_tasks_qs, many=True).data,
        }, status=status.HTTP_200_OK)


class SprintViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    queryset = Sprint.objects.all().prefetch_related('tasks').order_by('order', '-created_at')
    serializer_class = SprintSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'status', 'goals']
    ordering_fields = ['name', 'start_date', 'end_date', 'created_at', 'order']

    def get_queryset(self):
        queryset = Sprint.objects.all().prefetch_related('tasks').order_by('order', '-created_at')
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


class TaskViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    queryset = Task.objects.all().select_related('sprint', 'owner', 'board').order_by('order', '-created_at')
    serializer_class = TaskSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['title', 'task_key', 'epic', 'description']
    ordering_fields = ['title', 'estimated_sp', 'created_at', 'order']

    def get_queryset(self):
        queryset = Task.objects.all().select_related('sprint', 'owner', 'board').order_by('order', '-created_at')
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