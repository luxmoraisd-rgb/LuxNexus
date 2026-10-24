"""
API Views implementing all endpoints from the specifications:
- 01 Sprint Management & Creation
- 02 Board Filtering & Search
- 03 Sorting Configuration
- 04 Board View & Column Options
- 05 Task Management & Column Operations
"""
from datetime import datetime, timezone
from pathlib import PurePosixPath
from tempfile import TemporaryFile
from urllib.parse import urlsplit
from zipfile import ZIP_STORED, ZipFile

from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.http import FileResponse
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework.permissions import BasePermission, IsAuthenticated
from bson import ObjectId
from gridfs import GridFSBucket
from gridfs.errors import NoFile

from ...db import get_database
from ...Auth.role_permissions import (
    RoleCapabilityPermission,
    TaskDetailRolePermission,
    has_role_permission,
)
from ..models import Board, Sprint, BoardView, BoardColumn, Task
from ..serializers import (
    UserSerializer,
    BoardSerializer,
    SprintSerializer,
    SprintCapacitySerializer,
    SprintDatesSerializer,
    SprintGoalSerializer,
    BoardColumnSerializer,
    BoardViewSerializer,
    BoardViewOptionSerializer,
    TaskSerializer,
    QuickFilterSerializer,
    SortConfigSerializer,
    ProjectKeySerializer,
)

User = get_user_model()


class RoleProtectedAPIView(APIView):
    permission_classes = [IsAuthenticated, RoleCapabilityPermission]


class TaskCommentRolePermission(BasePermission):
    def has_permission(self, request, view):
        if request.method == "GET":
            return has_role_permission(request.user, "view_tasks")
        return (
            request.method in {"POST", "DELETE"}
            and (
                has_role_permission(request.user, "manage_tasks")
                or has_role_permission(request.user, "update_assigned_tasks")
            )
        )

    def has_object_permission(self, request, view, task):
        if has_role_permission(request.user, "manage_tasks"):
            return True
        if request.method == "GET":
            return has_role_permission(request.user, "view_tasks")
        owner = task.owner
        return (
            request.method in {"POST", "DELETE"}
            and has_role_permission(request.user, "update_assigned_tasks")
            and owner is not None
            and owner.email.lower() == request.user.email.lower()
        )


# ==============================================================================
# SECTION 01: SPRINT MANAGEMENT & CREATION
# ==============================================================================

class BoardSprintsView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks"}
    """
    GET /api/boards/{boardId}/sprints
    Fetch Sprints: Retrieve a list of active, future, and past sprints for the board.
    """
    @extend_schema(summary="Fetch all sprints for a board", responses={200: SprintSerializer(many=True)})
    def get(self, request, board_id):
        board = get_object_or_404(Board, pk=board_id)
        sprints = board.sprints.all().prefetch_related('tasks')
        serializer = SprintSerializer(sprints, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SprintCreateView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks", "POST": "manage_sprints"}
    """
    POST /api/sprints
    Create Sprint: Initialize a new sprint. Payload includes name (e.g., "New sprint") and duration dates.
    """
    @extend_schema(summary="List all sprints", responses={200: SprintSerializer(many=True)})
    def get(self, request):
        sprints = Sprint.objects.all().select_related('board').prefetch_related('tasks')
        board_id = request.query_params.get('board_id')
        if board_id:
            sprints = sprints.filter(board_id=board_id)
        return Response(
            SprintSerializer(sprints, many=True).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(summary="Create a new sprint", request=SprintSerializer, responses={201: SprintSerializer})
    def post(self, request):
        board_id = request.data.get('board_id')
        if not board_id:
            first_board = Board.objects.first()
            if not first_board:
                first_board = Board.objects.create(name="Tasks", key="LUX")
            board_id = first_board.id
        
        data = request.data.copy()
        data['board_id'] = board_id
        if "goal" in data and "goals" not in data:
            data["goals"] = data.pop("goal")
        if "dates" in data and "duration_text" not in data:
            data["duration_text"] = data.pop("dates")
        for field in ("id", "isStarted", "isExpanded"):
            data.pop(field, None)
        
        # Calculate next sprint order
        last_sprint = Sprint.objects.filter(board_id=board_id).order_by('-order').first()
        order = (last_sprint.order + 1) if last_sprint else 1
        data.setdefault('order', order)
        data.setdefault('status', 'future')

        serializer = SprintSerializer(data=data)
        if serializer.is_valid():
            sprint = serializer.save()
            return Response(SprintSerializer(sprint).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SprintLastCreatedView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks"}
    """
    GET /api/sprints/last-created
    Fetch Last Sprint Metadata: Retrieve information about the most recently created sprint to display in the creation modal.
    """
    @extend_schema(summary="Fetch metadata of the last created sprint", responses={200: SprintSerializer})
    def get(self, request):
        last_sprint = Sprint.objects.order_by('-created_at').first()
        if not last_sprint:
            return Response({
                "message": "No sprints created yet",
                "suggested_name": "Sprint 1",
                "default_duration_weeks": 1
            }, status=status.HTTP_200_OK)
        serializer = SprintSerializer(last_sprint)
        next_number = Sprint.objects.count() + 1
        data = serializer.data
        data["suggested_next_name"] = f"Sprint {next_number}"
        return Response(data, status=status.HTTP_200_OK)


class SprintDatesUpdateView(RoleProtectedAPIView):
    role_capabilities = {"PUT": "manage_sprints"}
    """
    PUT /api/sprints/{sprintId}/dates
    Add/Update Sprint Dates: Set or modify the start and end dates for a specific sprint (e.g., "5 Oct - 19 Oct").
    """
    @extend_schema(summary="Update sprint dates and duration", request=SprintDatesSerializer)
    def put(self, request, sprint_id):
        sprint = get_object_or_404(Sprint, pk=sprint_id)
        serializer = SprintDatesSerializer(data=request.data)
        if serializer.is_valid():
            if 'start_date' in serializer.validated_data:
                sprint.start_date = serializer.validated_data.get('start_date')
            if 'end_date' in serializer.validated_data:
                sprint.end_date = serializer.validated_data.get('end_date')
            if 'duration_text' in serializer.validated_data:
                sprint.duration_text = serializer.validated_data.get('duration_text')
            sprint.save()
            return Response({
                "message": "Sprint dates updated successfully",
                "sprint": SprintSerializer(sprint).data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SprintGoalsUpdateView(RoleProtectedAPIView):
    role_capabilities = {"PUT": "manage_sprints"}
    """
    PUT /api/sprints/{sprintId}/goals
    Update Sprint Goals: Save text entered into the "Sprint goals" field for a specific sprint.
    """
    @extend_schema(summary="Update sprint goals", request=SprintGoalSerializer)
    def put(self, request, sprint_id):
        sprint = get_object_or_404(Sprint, pk=sprint_id)
        serializer = SprintGoalSerializer(data=request.data)
        if serializer.is_valid():
            sprint.goals = serializer.validated_data['goals']
            sprint.save()
            return Response({
                "message": "Sprint goals updated successfully",
                "goals": sprint.goals,
                "sprint_id": sprint.id
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SprintStartView(RoleProtectedAPIView):
    role_capabilities = {"POST": "manage_sprints"}
    """
    POST /api/sprints/{sprintId}/start
    Start Sprint: Transition a sprint from "Future" to "Active" status.
    """
    @extend_schema(summary="Start a sprint (transition to Active status)")
    def post(self, request, sprint_id):
        sprint = get_object_or_404(Sprint, pk=sprint_id)
        sprint.status = 'active'
        sprint.save()
        return Response({
            "message": f"Sprint '{sprint.name}' is now Active",
            "sprint": SprintSerializer(sprint).data
        }, status=status.HTTP_200_OK)


class SprintDetailView(RoleProtectedAPIView):
    role_capabilities = {
        "GET": "view_tasks",
        "PATCH": "manage_sprints",
        "PUT": "manage_sprints",
        "DELETE": "manage_sprints",
    }

    def get(self, request, sprint_id):
        sprint = get_object_or_404(Sprint, pk=sprint_id)
        return Response(SprintSerializer(sprint).data)

    def patch(self, request, sprint_id):
        sprint = get_object_or_404(Sprint, pk=sprint_id)
        data = request.data.copy()
        if "dates" in data and "duration_text" not in data:
            data["duration_text"] = data.pop("dates")
        if "goal" in data and "goals" not in data:
            data["goals"] = data.pop("goal")
        serializer = SprintSerializer(sprint, data=data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        sprint = serializer.save()
        return Response(SprintSerializer(sprint).data)

    def put(self, request, sprint_id):
        return self.patch(request, sprint_id)

    def delete(self, request, sprint_id):
        sprint = get_object_or_404(Sprint, pk=sprint_id)
        sprint.tasks.update(sprint=None)
        sprint.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SprintCompleteView(RoleProtectedAPIView):
    role_capabilities = {"POST": "manage_sprints"}

    def post(self, request, sprint_id):
        sprint = get_object_or_404(Sprint, pk=sprint_id)
        sprint.status = "completed"
        sprint.save(update_fields=["status", "updated_at"])
        return Response(
            {"message": f"Sprint '{sprint.name}' completed.", "sprint": SprintSerializer(sprint).data},
            status=status.HTTP_200_OK,
        )


class SprintCapacityView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks", "PUT": "manage_sprints"}
    """
    GET /api/sprints/{sprintId}/capacity - Retrieve estimated SP and capacity data for sprint header
    PUT /api/sprints/{sprintId}/capacity - Set or modify the capacity limits for a sprint
    """
    @extend_schema(summary="Fetch sprint capacity and story point summary", responses={200: SprintCapacitySerializer})
    def get(self, request, sprint_id):
        sprint = get_object_or_404(Sprint, pk=sprint_id)
        serializer = SprintCapacitySerializer(sprint)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(summary="Update sprint capacity limit")
    def put(self, request, sprint_id):
        sprint = get_object_or_404(Sprint, pk=sprint_id)
        capacity_limit = request.data.get('capacity_limit')
        if capacity_limit is not None:
            try:
                sprint.capacity_limit = int(capacity_limit)
                sprint.save()
                return Response({
                    "message": "Capacity limit updated successfully",
                    "capacity_data": SprintCapacitySerializer(sprint).data
                }, status=status.HTTP_200_OK)
            except ValueError:
                return Response({"error": "capacity_limit must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"error": "capacity_limit field is required"}, status=status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# SECTION 02: BOARD FILTERING & SEARCH
# ==============================================================================

class BoardSearchView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks"}
    """
    GET /api/boards/{boardId}/search
    Search Board: Perform a text-based search across the board (Search this board).
    """
    @extend_schema(
        summary="Search across tasks, IDs, and titles in a board",
        parameters=[OpenApiParameter(name='q', type=str, description='Search query string')]
    )
    def get(self, request, board_id):
        board = get_object_or_404(Board, pk=board_id)
        query = request.query_params.get('q', '').strip()
        
        tasks_qs = board.tasks.all()
        if query:
            tasks_qs = tasks_qs.filter(
                Q(title__icontains=query) |
                Q(task_key__icontains=query) |
                Q(description__icontains=query) |
                Q(epic__icontains=query) |
                Q(status__icontains=query) |
                Q(task_type__icontains=query)
            )
        serializer = TaskSerializer(tasks_qs, many=True)
        return Response({
            "board_id": board.id,
            "query": query,
            "total_matches": tasks_qs.count(),
            "tasks": serializer.data
        }, status=status.HTTP_200_OK)


class BoardFilterMetadataView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks"}
    """
    GET /api/boards/{boardId}/filters
    Fetch Filter Metadata: Retrieve all available filter options, including Recent filters,
    All columns, Status labels, and Owner lists.
    """
    @extend_schema(summary="Fetch all filter criteria options for board")
    def get(self, request, board_id):
        board = get_object_or_404(Board, pk=board_id)
        
        # Columns
        columns = [
            {"id": c.id, "name": c.name, "type": c.column_type}
            for c in board.columns.all()
        ]
        
        # Status labels
        status_labels = ["All Statuses", "Ready to start", "In Progress", "In Review", "Done"]
        
        # Type labels
        type_labels = ["All Types", "Feature", "Quality", "Bug", "Task"]
        
        # Owners list
        users = User.objects.all()
        owners = [
            {"id": u.id, "name": f"{u.first_name} {u.last_name}".strip() or u.username, "initials": u.first_name[:1] if u.first_name else u.username[:1].upper()}
            for u in users
        ]
        owners.append({"id": None, "name": "Unassigned", "initials": "?"})

        # Recent filters
        recent_filters = [
            {"id": "rf_1", "label": "Assigned to me", "filter": {"me": True}},
            {"id": "rf_2", "label": "Ready to start", "filter": {"status": ["Ready to start"]}},
            {"id": "rf_3", "label": "In Progress features", "filter": {"status": ["In Progress"], "task_type": ["Feature"]}},
        ]

        return Response({
            "board_id": board.id,
            "statuses": status_labels,
            "types": type_labels,
            "columns": columns,
            "owners": owners,
            "recent_filters": recent_filters
        }, status=status.HTTP_200_OK)


class ViewFiltersUpdateView(RoleProtectedAPIView):
    role_capabilities = {"POST": "manage_board", "DELETE": "manage_board"}
    """
    POST /api/views/{viewId}/filters - Apply complex filter logic based on selected criteria
    DELETE /api/views/{viewId}/filters - Clear All Filters: Reset the board view to show all tasks
    """
    @extend_schema(summary="Apply quick filters to board view", request=QuickFilterSerializer)
    def post(self, request, view_id):
        view = get_object_or_404(BoardView, pk=view_id)
        filters = request.data
        view.filters = filters
        view.save()
        return Response({
            "message": "Filters applied successfully",
            "view_id": view.id,
            "active_filters": view.filters
        }, status=status.HTTP_200_OK)

    @extend_schema(summary="Clear all filters from board view")
    def delete(self, request, view_id):
        view = get_object_or_404(BoardView, pk=view_id)
        view.filters = {}
        view.save()
        return Response({
            "message": "All filters cleared successfully",
            "view_id": view.id,
            "active_filters": {}
        }, status=status.HTTP_200_OK)


class ViewFilterPersonView(RoleProtectedAPIView):
    role_capabilities = {"PUT": "manage_board"}
    """
    PUT /api/views/{viewId}/filters/person
    Filter Board by Person: Apply a specific user filter (e.g., filtering to show only tasks assigned to user or team member).
    """
    @extend_schema(summary="Filter view by person / assignee")
    def put(self, request, view_id):
        view = get_object_or_404(BoardView, pk=view_id)
        user_id = request.data.get('user_id')
        unassigned = request.data.get('unassigned', False)
        
        current_filters = view.filters or {}
        if unassigned:
            current_filters['unassigned'] = True
            current_filters.pop('owner_id', None)
        elif user_id is not None:
            current_filters['owner_id'] = user_id
            current_filters.pop('unassigned', None)
        else:
            current_filters.pop('owner_id', None)
            current_filters.pop('unassigned', None)

        view.filters = current_filters
        view.save()
        return Response({
            "message": "Person filter applied successfully",
            "view_id": view.id,
            "filters": view.filters
        }, status=status.HTTP_200_OK)


class ViewSaveCustomView(RoleProtectedAPIView):
    role_capabilities = {"POST": "manage_board"}
    """
    POST /api/views/save
    Save Custom View: Save the current combination of filters, sorting, and grouping as a reusable custom view (Save to this view).
    """
    @extend_schema(summary="Save current configuration as reusable custom view")
    def post(self, request):
        board_id = request.data.get('board_id')
        name = request.data.get('name', 'Custom View')
        view_type = request.data.get('view_type', 'custom')
        filters = request.data.get('filters', {})
        sorting = request.data.get('sorting', [])
        grouping = request.data.get('grouping', {})
        hidden_columns = request.data.get('hidden_columns', [])
        options = request.data.get('options', {})

        if not board_id:
            first_board = Board.objects.first()
            board_id = first_board.id if first_board else None

        board = get_object_or_404(Board, pk=board_id)
        new_view = BoardView.objects.create(
            board=board,
            name=name,
            view_type=view_type,
            is_custom=True,
            filters=filters,
            sorting=sorting,
            grouping=grouping,
            hidden_columns=hidden_columns,
            options=options
        )
        return Response(BoardViewSerializer(new_view).data, status=status.HTTP_201_CREATED)


class UserListView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks"}
    """
    GET /api/users
    Fetch User List: Retrieve users for the "Filter this board by person" dropdown (e.g., Me, Franklin, Unassigned).
    """
    @extend_schema(summary="Retrieve user list for assignee/filter dropdowns", responses={200: UserSerializer(many=True)})
    def get(self, request):
        users = User.objects.all().order_by('id')
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ==============================================================================
# SECTION 03: SORTING CONFIGURATION
# ==============================================================================

class BoardSortOptionsView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks"}
    """
    GET /api/boards/{boardId}/sort-options
    Fetch Sortable Columns: Retrieve a list of all columns available to be used as sorting criteria.
    """
    @extend_schema(summary="Retrieve all available sort columns for a board")
    def get(self, request, board_id):
        board = get_object_or_404(Board, pk=board_id)
        columns = [
            {"columnId": "task_key", "label": "Task ID", "type": "text"},
            {"columnId": "title", "label": "Task Name", "type": "text"},
            {"columnId": "owner", "label": "Owner", "type": "user"},
            {"columnId": "status", "label": "Status", "type": "status"},
            {"columnId": "task_type", "label": "Type", "type": "label"},
            {"columnId": "estimated_sp", "label": "Estimated SP", "type": "number"},
            {"columnId": "epic", "label": "Epic", "type": "text"},
            {"columnId": "created_at", "label": "Created Date", "type": "date"},
        ]
        return Response({
            "board_id": board.id,
            "sort_options": columns
        }, status=status.HTTP_200_OK)


class ViewSortView(RoleProtectedAPIView):
    role_capabilities = {"PUT": "manage_board", "POST": "manage_board", "DELETE": "manage_board"}
    """
    PUT /api/views/{viewId}/sort - Apply/Update Sort: Save primary sorting configuration
    POST /api/views/{viewId}/sort - Add Secondary Sort: Add a new sorting rule to the current view
    DELETE /api/views/{viewId}/sort - Clear Sorting: Remove all active sorting rules from the view
    """
    @extend_schema(summary="Set or replace primary sorting configuration", request=SortConfigSerializer)
    def put(self, request, view_id):
        view = get_object_or_404(BoardView, pk=view_id)
        column_id = request.data.get('columnId')
        direction = request.data.get('direction', 'Ascending')
        if not column_id:
            return Response({"error": "columnId is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        view.sorting = [{"columnId": column_id, "direction": direction}]
        view.save()
        return Response({
            "message": "Sort updated successfully",
            "sorting": view.sorting
        }, status=status.HTTP_200_OK)

    @extend_schema(summary="Add secondary sorting rule", request=SortConfigSerializer)
    def post(self, request, view_id):
        view = get_object_or_404(BoardView, pk=view_id)
        column_id = request.data.get('columnId')
        direction = request.data.get('direction', 'Ascending')
        if not column_id:
            return Response({"error": "columnId is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        current_sort = list(view.sorting or [])
        # Check if already present, update or append
        updated = False
        for rule in current_sort:
            if rule.get('columnId') == column_id:
                rule['direction'] = direction
                updated = True
                break
        if not updated:
            current_sort.append({"columnId": column_id, "direction": direction})
        
        view.sorting = current_sort
        view.save()
        return Response({
            "message": "Secondary sort added successfully",
            "sorting": view.sorting
        }, status=status.HTTP_200_OK)

    @extend_schema(summary="Clear all sorting rules")
    def delete(self, request, view_id):
        view = get_object_or_404(BoardView, pk=view_id)
        view.sorting = []
        view.save()
        return Response({
            "message": "Sorting cleared successfully",
            "sorting": []
        }, status=status.HTTP_200_OK)


# ==============================================================================
# SECTION 04: BOARD VIEW & COLUMN OPTIONS
# ==============================================================================

class BoardViewsListView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks"}
    """
    GET /api/boards/{boardId}/views
    Fetch Board Views: Retrieve available view tabs (Backlog, Kanban, Active Sprint, All Sprints, Hierarchy, Roadmap tracker, Calendar, Chart, Doc).
    """
    @extend_schema(summary="Retrieve available view tabs for board", responses={200: BoardViewSerializer(many=True)})
    def get(self, request, board_id):
        board = get_object_or_404(Board, pk=board_id)
        views = board.views.all()
        serializer = BoardViewSerializer(views, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ViewHideColumnsView(RoleProtectedAPIView):
    role_capabilities = {"PUT": "manage_board"}
    """
    PUT /api/views/{viewId}/hide-columns
    Hide Columns: Update the view state to hide specific columns from the board (Hide / 4).
    """
    @extend_schema(summary="Hide or show specific columns in view")
    def put(self, request, view_id):
        view = get_object_or_404(BoardView, pk=view_id)
        hidden_columns = request.data.get('hidden_columns', [])
        view.hidden_columns = hidden_columns
        view.save()
        return Response({
            "message": "Hidden columns updated successfully",
            "hidden_count": len(hidden_columns),
            "hidden_columns": view.hidden_columns
        }, status=status.HTTP_200_OK)


class ViewGroupingView(RoleProtectedAPIView):
    role_capabilities = {"PUT": "manage_board"}
    """
    PUT /api/views/{viewId}/group
    Apply Grouping: Set the primary column to group the board by (Group by / 1).
    """
    @extend_schema(summary="Set primary grouping column for view")
    def put(self, request, view_id):
        view = get_object_or_404(BoardView, pk=view_id)
        group_column = request.data.get('columnId')
        group_data = {
            "columnId": group_column,
            "enabled": bool(group_column)
        }
        view.grouping = group_data
        view.save()
        return Response({
            "message": "Grouping applied successfully",
            "grouping": view.grouping
        }, status=status.HTTP_200_OK)


class ViewOptionsView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks", "PUT": "manage_board"}
    """
    PUT /api/views/{viewId}/options - Update miscellaneous board settings
    GET /api/views/{viewId}/options - Fetch Board Options (Pin columns, Item height, Conditional coloring, Default item values)
    """
    @extend_schema(summary="Fetch current board options for view", responses={200: BoardViewOptionSerializer})
    def get(self, request, view_id):
        view = get_object_or_404(BoardView, pk=view_id)
        default_options = {
            "pin_columns": True,
            "item_height": "medium",
            "conditional_coloring": True,
            "default_item_values": {
                "estimated_sp": 3,
                "status": "Ready to start",
                "task_type": "Task"
            }
        }
        options = {**default_options, **(view.options or {})}
        return Response(options, status=status.HTTP_200_OK)

    @extend_schema(summary="Update board options for view", request=BoardViewOptionSerializer)
    def put(self, request, view_id):
        view = get_object_or_404(BoardView, pk=view_id)
        current_options = view.options or {}
        current_options.update(request.data)
        view.options = current_options
        view.save()
        return Response({
            "message": "Board options updated successfully",
            "options": view.options
        }, status=status.HTTP_200_OK)


# ==============================================================================
# SECTION 05: TASK MANAGEMENT & COLUMN OPERATIONS
# ==============================================================================

class ProjectKeyView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks", "PUT": "manage_board"}
    """
    GET or PUT /api/backlog/project-key
    Retrieve or update the issue key prefix for the default board.
    """

    @extend_schema(summary="Retrieve the board issue key")
    def get(self, request):
        board = Board.objects.order_by('id').first()
        return Response(
            {'projectKey': board.key if board else 'LUX'},
            status=status.HTTP_200_OK,
        )

    @extend_schema(summary="Update the board issue key", request=ProjectKeySerializer)
    def put(self, request):
        serializer = ProjectKeySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        project_key = serializer.validated_data['projectKey']
        board = Board.objects.order_by('id').first()
        if board is None:
            board = Board.objects.create(name='Tasks', key=project_key)
        else:
            board.key = project_key
            board.save(update_fields=['key', 'updated_at'])
        return Response({'projectKey': board.key}, status=status.HTTP_200_OK)


class BoardAssetListCreateView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks", "POST": "manage_tasks"}
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    max_file_size = 25 * 1024 * 1024
    max_archive_size = 100 * 1024 * 1024

    @staticmethod
    def serialize_asset(asset):
        return {
            "id": str(asset["_id"]),
            "kind": asset["kind"],
            "filename": asset.get("filename"),
            "title": asset.get("title"),
            "url": asset.get("url"),
            "task_id": asset.get("task_id"),
            "download_url": asset.get("download_url"),
            "file_count": asset.get("file_count", 0),
            "size": asset.get("size", 0),
            "uploaded_by": asset.get("uploaded_by"),
            "created_at": asset["created_at"].isoformat(),
        }

    def get(self, request):
        database = get_database()
        task_id = request.query_params.get("task_id")
        query = {"task_id": task_id} if task_id else {}
        assets = database.board_assets.find(query).sort("created_at", -1)
        return Response(
            {"assets": [self.serialize_asset(asset) for asset in assets]},
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        if request.data.get("kind") == "link":
            return self.create_link(request)
        return self.create_archive(request)

    def create_link(self, request):
        task_id = str(request.data.get("task_id") or "").strip()
        title = str(request.data.get("title") or "").strip()
        url = str(request.data.get("url") or "").strip()
        if not url:
            return Response({"url": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            URLValidator(schemes=["http", "https"])(url)
        except ValidationError as error:
            return Response({"url": error.messages}, status=status.HTTP_400_BAD_REQUEST)
        if len(title) > 255:
            return Response(
                {"title": ["Ensure this field has no more than 255 characters."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        document = {
            "kind": "link",
            "task_id": task_id or None,
            "title": title or urlsplit(url).hostname or url,
            "url": url,
            "uploaded_by": request.user.username,
            "created_at": datetime.now(timezone.utc),
        }
        result = get_database().board_assets.insert_one(document)
        document["_id"] = result.inserted_id
        return Response(self.serialize_asset(document), status=status.HTTP_201_CREATED)

    def create_archive(self, request):
        task_id = str(request.data.get("task_id") or "").strip()
        files = request.FILES.getlist("files")
        if not files:
            return Response(
                {"files": ["Select at least one file to upload."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_size = sum(upload.size for upload in files)
        if any(upload.size > self.max_file_size for upload in files):
            return Response(
                {"files": ["Each file must be 25 MB or smaller."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if total_size > self.max_archive_size:
            return Response(
                {"files": ["The combined upload must be 100 MB or smaller."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        seen_names = set()
        with TemporaryFile() as archive_buffer:
            with ZipFile(archive_buffer, mode="w", compression=ZIP_STORED) as archive:
                for uploaded in files:
                    original_name = PurePosixPath(uploaded.name.replace("\\", "/")).name
                    safe_name = original_name or "upload"
                    path = PurePosixPath(safe_name)
                    stem, suffix = path.stem, path.suffix
                    candidate = safe_name
                    duplicate_index = 2
                    while candidate.casefold() in seen_names:
                        candidate = f"{stem} ({duplicate_index}){suffix}"
                        duplicate_index += 1
                    seen_names.add(candidate.casefold())

                    with archive.open(candidate, mode="w") as archive_file:
                        for chunk in uploaded.chunks():
                            archive_file.write(chunk)

            archive_buffer.seek(0, 2)
            archive_size = archive_buffer.tell()
            archive_buffer.seek(0)
            filename = f"ready-to-start-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.zip"
            database = get_database()
            bucket = GridFSBucket(database, bucket_name="board_assets")
            gridfs_id = bucket.upload_from_stream(
                filename,
                archive_buffer,
                metadata={"content_type": "application/zip"},
            )

        document = {
            "kind": "archive",
            "task_id": task_id or None,
            "filename": filename,
            "gridfs_id": gridfs_id,
            "file_count": len(files),
            "size": archive_size,
            "original_names": [upload.name for upload in files],
            "uploaded_by": request.user.username,
            "created_at": datetime.now(timezone.utc),
        }
        asset_id = None
        try:
            result = database.board_assets.insert_one(document)
            asset_id = result.inserted_id
            download_url = f"/api/backlog/board-assets/{asset_id}/download/"
            database.board_assets.update_one(
                {"_id": asset_id},
                {"$set": {"download_url": download_url}},
            )
        except Exception:
            if asset_id is not None:
                database.board_assets.delete_one({"_id": asset_id})
            bucket.delete(gridfs_id)
            raise
        document["_id"] = asset_id
        document["download_url"] = download_url
        return Response(self.serialize_asset(document), status=status.HTTP_201_CREATED)


class BoardAssetDownloadView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks"}

    def get(self, request, asset_id):
        database = get_database()
        asset = database.board_assets.find_one(
            {"_id": ObjectId(asset_id), "kind": "archive"}
        )
        if asset is None:
            return Response({"detail": "Uploaded archive not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            archive = GridFSBucket(database, bucket_name="board_assets").open_download_stream(
                asset["gridfs_id"]
            )
        except NoFile:
            return Response({"detail": "Stored archive data is missing."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            archive,
            as_attachment=True,
            filename=asset["filename"],
            content_type="application/zip",
        )


class BoardAssetDetailView(RoleProtectedAPIView):
    role_capabilities = {"DELETE": "manage_tasks"}

    def delete(self, request, asset_id):
        database = get_database()
        asset_object_id = ObjectId(asset_id)
        asset = database.board_assets.find_one({"_id": asset_object_id})
        if asset is None:
            return Response({"detail": "Task attachment not found."}, status=status.HTTP_404_NOT_FOUND)

        if asset.get("kind") == "archive" and asset.get("gridfs_id"):
            bucket = GridFSBucket(database, bucket_name="board_assets")
            try:
                bucket.delete(asset["gridfs_id"])
            except NoFile:
                pass

        database.board_assets.delete_one({"_id": asset_object_id})
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskCreateListView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks", "POST": "manage_tasks"}
    """
    POST /api/tasks - Add a new task to a specific sprint or board (New task, + Add task)
    GET /api/tasks - List all tasks with optional filtering by board_id or sprint_id
    """
    @extend_schema(summary="List all tasks", responses={200: TaskSerializer(many=True)})
    def get(self, request):
        tasks = Task.objects.all().select_related('board', 'sprint', 'owner')
        board_id = request.query_params.get('board_id')
        sprint_id = request.query_params.get('sprint_id')
        status_filter = request.query_params.get('status')
        type_filter = request.query_params.get('type')

        # Rollover past-due incomplete tasks to Backlog (like Jira & Monday.com)
        today = datetime.now(timezone.utc).date()
        for t in tasks:
            if t.sprint_id and t.due_date and str(t.status).strip().lower() != 'done':
                try:
                    clean_str = str(t.due_date).strip()[:10]
                    d = datetime.strptime(clean_str, "%Y-%m-%d").date()
                    if d < today:
                        t.sprint = None
                        t.save(update_fields=['sprint'])
                except Exception:
                    pass

        if board_id:
            tasks = tasks.filter(board_id=board_id)
        if sprint_id:
            tasks = tasks.filter(sprint_id=sprint_id)
        if status_filter:
            tasks = tasks.filter(status=status_filter)
        if type_filter:
            tasks = tasks.filter(task_type=type_filter)

        serializer = TaskSerializer(tasks, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(summary="Create a new task", request=TaskSerializer, responses={201: TaskSerializer})
    def post(self, request):
        data = request.data.copy()
        for sprint_field in ('sprint_id', 'sprintId'):
            if data.get(sprint_field) in ('', 'backlog'):
                data[sprint_field] = None

        # Jira & Monday.com style: If a task has a past due date and is incomplete, automatically route to Backlog
        start_val = data.get('startDate') or data.get('start_date')
        if start_val:
            data['start_date'] = start_val
            data['startDate'] = start_val

        due_val = data.get('dueDate') or data.get('due_date')
        status_val = data.get('status', 'Ready to start')
        if due_val and str(status_val).strip().lower() != 'done':
            try:
                clean_str = str(due_val).strip()[:10]
                d = datetime.strptime(clean_str, "%Y-%m-%d").date()
                if d < datetime.now(timezone.utc).date():
                    data['sprint_id'] = None
                    data['sprintId'] = None
            except Exception:
                pass

        for points_field in ('estimated_sp', 'sp'):
            if data.get(points_field) is None:
                data.pop(points_field, None)
        if 'estimated_sp' not in data and 'sp' not in data:
            data['sp'] = 3

        board_id = data.get('board_id')
        if not board_id:
            sprint_id = data.get('sprint_id') or data.get('sprintId')
            if sprint_id:
                sprint = Sprint.objects.filter(pk=sprint_id).first()
                if sprint:
                    board_id = sprint.board_id
            if not board_id:
                first_board = Board.objects.first()
                if not first_board:
                    first_board = Board.objects.create(name="Tasks", key="LUX")
                board_id = first_board.id

        data['board_id'] = board_id

        serializer = TaskSerializer(data=data)
        if serializer.is_valid():
            task = serializer.save()
            return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskDetailView(APIView):
    permission_classes = [IsAuthenticated, TaskDetailRolePermission]
    """
    GET /api/tasks/{taskId} - Retrieve task detail
    PUT /api/tasks/{taskId} - Update task detail
    DELETE /api/tasks/{taskId} - Delete task
    """
    @extend_schema(summary="Retrieve task detail", responses={200: TaskSerializer})
    def get(self, request, task_id):
        task = get_object_or_404(Task, pk=task_id)
        return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)

    @extend_schema(summary="Update task detail", request=TaskSerializer)
    def put(self, request, task_id):
        task = get_object_or_404(Task, pk=task_id)
        self.check_object_permissions(request, task)
        serializer = TaskSerializer(task, data=request.data, partial=True)
        if serializer.is_valid():
            updated_task = serializer.save()
            return Response(TaskSerializer(updated_task).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(summary="Delete task")
    def delete(self, request, task_id):
        task = get_object_or_404(Task, pk=task_id)
        self.check_object_permissions(request, task)
        task.delete()
        return Response({"message": f"Task {task_id} deleted successfully"}, status=status.HTTP_204_NO_CONTENT)


class TaskMoveView(APIView):
    permission_classes = [IsAuthenticated, TaskDetailRolePermission]

    def post(self, request, task_id):
        task = get_object_or_404(Task, pk=task_id)
        self.check_object_permissions(request, task)
        sprint_id = request.data.get("sprintId", request.data.get("sprint_id"))
        if sprint_id in (None, "", "backlog"):
            task.sprint = None
        else:
            sprint = get_object_or_404(Sprint, pk=sprint_id, board=task.board)
            task.sprint = sprint
        if "position" in request.data and request.data["position"] is not None:
            try:
                task.order = int(request.data["position"])
            except (TypeError, ValueError):
                return Response(
                    {"position": ["A whole number is required."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        task.save()
        return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)


class TaskBatchUpdateView(APIView):
    permission_classes = [IsAuthenticated, TaskDetailRolePermission]

    def post(self, request):
        task_ids = request.data.get("taskIds")
        updates = request.data.get("updates")
        if not isinstance(task_ids, list) or not task_ids or not isinstance(updates, dict):
            return Response(
                {"error": "taskIds and updates are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tasks = list(Task.objects.filter(pk__in=task_ids).select_related("board", "sprint", "owner"))
        if len(tasks) != len(set(map(str, task_ids))):
            return Response(
                {"error": "One or more tasks were not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        for task in tasks:
            self.check_object_permissions(request, task)

        normalized = updates.copy()
        if "sprintId" in normalized and "sprint_id" not in normalized:
            normalized["sprint_id"] = normalized.pop("sprintId")
        if normalized.get("sprint_id") in ("", "backlog"):
            normalized["sprint_id"] = None
        if "owner" in normalized and "owner_id" not in normalized:
            normalized["owner_id"] = normalized.pop("owner")
        serializers = [TaskSerializer(task, data=normalized, partial=True) for task in tasks]
        for serializer in serializers:
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        updated_tasks = []
        for serializer in serializers:
            updated_tasks.append(serializer.save())
        return Response(TaskSerializer(updated_tasks, many=True).data, status=status.HTTP_200_OK)


class TaskCommentView(APIView):
    permission_classes = [IsAuthenticated, TaskCommentRolePermission]

    @staticmethod
    def _task_comments(task_id):
        return get_database().backlog_task_comments.find(
            {"task_id": str(task_id)}
        ).sort("created_at", 1)

    @staticmethod
    def _serialize(comment):
        value = dict(comment)
        value.pop("_id", None)
        value["id"] = str(value.pop("comment_id"))
        value["created_at"] = value["created_at"].isoformat()
        return value

    def get(self, request, task_id):
        task = get_object_or_404(Task, pk=task_id)
        self.check_object_permissions(request, task)
        comments = [self._serialize(item) for item in self._task_comments(task.id)]
        return Response(comments)

    def post(self, request, task_id):
        task = get_object_or_404(Task, pk=task_id)
        self.check_object_permissions(request, task)
        text = str(request.data.get("text", "")).strip()
        if not text:
            return Response({"text": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        comment = {
            "task_id": str(task.id),
            "comment_id": str(request.data.get("id") or ObjectId()),
            "author": str(request.data.get("author") or request.user.username),
            "role": str(request.data.get("role") or ""),
            "avatarBg": str(request.data.get("avatarBg") or ""),
            "initial": str(request.data.get("initial") or ""),
            "text": text,
            "time": str(request.data.get("time") or "Just now"),
            "likes": 0,
            "isLiked": False,
            "created_at": datetime.now(timezone.utc),
        }
        result = get_database().backlog_task_comments.insert_one(comment)
        comment["_id"] = result.inserted_id
        task.comments_count = get_database().backlog_task_comments.count_documents(
            {"task_id": str(task.id)}
        )
        task.save(update_fields=["comments_count", "updated_at"])
        return Response(self._serialize(comment), status=status.HTTP_201_CREATED)


class TaskCommentDetailView(APIView):
    permission_classes = [IsAuthenticated, TaskCommentRolePermission]

    def delete(self, request, task_id, comment_id):
        task = get_object_or_404(Task, pk=task_id)
        self.check_object_permissions(request, task)
        database = get_database()
        result = database.backlog_task_comments.delete_one(
            {"task_id": str(task.id), "comment_id": str(comment_id)}
        )
        if not result.deleted_count:
            return Response({"detail": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)
        task.comments_count = database.backlog_task_comments.count_documents(
            {"task_id": str(task.id)}
        )
        task.save(update_fields=["comments_count", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ColumnCreateView(RoleProtectedAPIView):
    role_capabilities = {"POST": "manage_board"}
    """
    POST /api/columns
    Add Column to Right: Add a new column immediately to the right of a specified column.
    """
    @extend_schema(summary="Add a new column (optionally to the right of specified column)")
    def post(self, request):
        board_id = request.data.get('board_id')
        if not board_id:
            board = Board.objects.first()
            if not board:
                board = Board.objects.create(name="Tasks", key="LUX")
            board_id = board.id
        else:
            board = get_object_or_404(Board, pk=board_id)

        name = request.data.get('name', 'New Column')
        column_type = request.data.get('column_type', 'text')
        after_column_id = request.data.get('after_column_id')

        # Determine target order
        if after_column_id:
            ref_col = BoardColumn.objects.filter(pk=after_column_id).first()
            order = (ref_col.order + 1) if ref_col else board.columns.count() + 1
            # Shift subsequent columns
            BoardColumn.objects.filter(board=board, order__gte=order).update(order=models.F('order') + 1)
        else:
            order = board.columns.count() + 1

        new_column = BoardColumn.objects.create(
            board=board,
            name=name,
            column_type=column_type,
            order=order,
            settings=request.data.get('settings', {}),
            extensions=request.data.get('extensions', {})
        )
        return Response(BoardColumnSerializer(new_column).data, status=status.HTTP_201_CREATED)


class ColumnDetailView(RoleProtectedAPIView):
    role_capabilities = {"PUT": "manage_board", "DELETE": "manage_board"}
    """
    PUT /api/columns/{columnId} - Rename Column: Update the name of a specific column (Rename)
    DELETE /api/columns/{columnId} - Remove Column: Delete a column from the board view (Remove)
    """
    @extend_schema(summary="Rename column")
    def put(self, request, column_id):
        column = get_object_or_404(BoardColumn, pk=column_id)
        name = request.data.get('name')
        if not name:
            return Response({"error": "name field is required"}, status=status.HTTP_400_BAD_REQUEST)
        column.name = name
        column.save()
        return Response(BoardColumnSerializer(column).data, status=status.HTTP_200_OK)

    @extend_schema(summary="Remove column")
    def delete(self, request, column_id):
        column = get_object_or_404(BoardColumn, pk=column_id)
        column.delete()
        return Response({"message": f"Column {column_id} removed successfully"}, status=status.HTTP_204_NO_CONTENT)


class ColumnDuplicateView(RoleProtectedAPIView):
    role_capabilities = {"POST": "manage_board"}
    """
    POST /api/columns/{columnId}/duplicate
    Duplicate Column: Create a copy of an existing column (Duplicate column).
    """
    @extend_schema(summary="Duplicate column")
    def post(self, request, column_id):
        column = get_object_or_404(BoardColumn, pk=column_id)
        duplicate = BoardColumn.objects.create(
            board=column.board,
            name=f"{column.name} (Copy)",
            column_type=column.column_type,
            order=column.order + 1,
            is_hidden=column.is_hidden,
            settings=column.settings.copy() if column.settings else {},
            extensions=column.extensions.copy() if column.extensions else {}
        )
        return Response(BoardColumnSerializer(duplicate).data, status=status.HTTP_201_CREATED)


class ColumnTypeUpdateView(RoleProtectedAPIView):
    role_capabilities = {"PUT": "manage_board"}
    """
    PUT /api/columns/{columnId}/type
    Change Column Type: Convert a column's data type (e.g., text to number, or status to label).
    """
    @extend_schema(summary="Change column data type")
    def put(self, request, column_id):
        column = get_object_or_404(BoardColumn, pk=column_id)
        column_type = request.data.get('column_type')
        if not column_type:
            return Response({"error": "column_type is required"}, status=status.HTTP_400_BAD_REQUEST)
        column.column_type = column_type
        column.save()
        return Response(BoardColumnSerializer(column).data, status=status.HTTP_200_OK)


class ColumnExtensionsView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks"}
    """
    GET /api/columns/{columnId}/extensions
    Column Extensions: Retrieve available extensions for a specific column.
    """
    @extend_schema(summary="Retrieve available column extensions")
    def get(self, request, column_id):
        column = get_object_or_404(BoardColumn, pk=column_id)
        available_extensions = [
            {"id": "auto_number", "name": "Auto Increment Number", "enabled": False},
            {"id": "date_reminder", "name": "Due Date Reminders", "enabled": False},
            {"id": "formula_calc", "name": "Formula & Rollups", "enabled": False},
            {"id": "user_avatar", "name": "User Avatars & Mentions", "enabled": True},
            {"id": "status_workflow", "name": "Kanban Status Workflow", "enabled": True},
        ]
        return Response({
            "column_id": column.id,
            "column_name": column.name,
            "configured_extensions": column.extensions,
            "available_extensions": available_extensions
        }, status=status.HTTP_200_OK)


class ColumnSettingsView(RoleProtectedAPIView):
    role_capabilities = {"PUT": "manage_board"}
    """
    PUT /api/columns/{columnId}/settings
    Update Column Settings: Modify advanced settings for a specific column (Settings).
    """
    @extend_schema(summary="Update advanced column settings")
    def put(self, request, column_id):
        column = get_object_or_404(BoardColumn, pk=column_id)
        settings_payload = request.data.get('settings', request.data)
        current = column.settings or {}
        current.update(settings_payload)
        column.settings = current
        column.save()
        return Response({
            "message": "Column settings updated successfully",
            "column_id": column.id,
            "settings": column.settings
        }, status=status.HTTP_200_OK)


# ==============================================================================
# MONGODB HEALTH CHECK & SYNC VIEWS
# ==============================================================================

class MongoHealthCheckView(RoleProtectedAPIView):
    role_capabilities = {"GET": "view_tasks"}
    """
    GET /api/mongodb/check
    Checks connection to MongoDB database and returns real-time diagnostics.
    """
    @extend_schema(summary="Check MongoDB database connection status and server info")
    def get(self, request):
        from ..db import check_mongo_connection
        status_info = check_mongo_connection()
        http_status = status.HTTP_200_OK if status_info.get("ok") else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(status_info, status=http_status)


class MongoSyncView(RoleProtectedAPIView):
    role_capabilities = {"POST": "manage_board"}
    """
    POST /api/mongodb/sync
    Synchronizes Django models into MongoDB collections.
    """
    @extend_schema(summary="Synchronize PostgreSQL/SQLite board data into MongoDB collections")
    def post(self, request):
        from ..db import sync_django_models_to_mongo
        sync_result = sync_django_models_to_mongo()
        return Response(sync_result, status=status.HTTP_200_OK)
