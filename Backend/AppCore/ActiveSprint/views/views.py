"""
API Views implementing all endpoints from the specifications:
- 01 Sprint Management & Creation
- 02 Board Filtering & Search
- 03 Sorting Configuration
- 04 Board View & Column Options
- 05 Task Management & Column Operations
"""
from django.db import models
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample

from appcore.models import Board, Sprint, BoardView, BoardColumn, Task
from appcore.serializers import (
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
)

User = get_user_model()


# ==============================================================================
# SECTION 01: SPRINT MANAGEMENT & CREATION
# ==============================================================================

class BoardSprintsView(APIView):
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


class SprintCreateView(APIView):
    """
    POST /api/sprints
    Create Sprint: Initialize a new sprint. Payload includes name (e.g., "New sprint") and duration dates.
    """
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


class SprintLastCreatedView(APIView):
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


class SprintDatesUpdateView(APIView):
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


class SprintGoalsUpdateView(APIView):
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


class SprintStartView(APIView):
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


class SprintCapacityView(APIView):
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

class BoardSearchView(APIView):
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


class BoardFilterMetadataView(APIView):
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


class ViewFiltersUpdateView(APIView):
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


class ViewFilterPersonView(APIView):
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


class ViewSaveCustomView(APIView):
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


class UserListView(APIView):
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

class BoardSortOptionsView(APIView):
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


class ViewSortView(APIView):
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

class BoardViewsListView(APIView):
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


class ViewHideColumnsView(APIView):
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


class ViewGroupingView(APIView):
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


class ViewOptionsView(APIView):
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

class TaskCreateListView(APIView):
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
        board_id = request.data.get('board_id')
        if not board_id:
            sprint_id = request.data.get('sprint_id')
            if sprint_id:
                sprint = Sprint.objects.filter(pk=sprint_id).first()
                if sprint:
                    board_id = sprint.board_id
            if not board_id:
                first_board = Board.objects.first()
                if not first_board:
                    first_board = Board.objects.create(name="Tasks", key="LUX")
                board_id = first_board.id

        data = request.data.copy()
        data['board_id'] = board_id

        serializer = TaskSerializer(data=data)
        if serializer.is_valid():
            task = serializer.save()
            return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskDetailView(APIView):
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
        serializer = TaskSerializer(task, data=request.data, partial=True)
        if serializer.is_valid():
            updated_task = serializer.save()
            return Response(TaskSerializer(updated_task).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(summary="Delete task")
    def delete(self, request, task_id):
        task = get_object_or_404(Task, pk=task_id)
        task.delete()
        return Response({"message": f"Task {task_id} deleted successfully"}, status=status.HTTP_204_NO_CONTENT)


class ColumnCreateView(APIView):
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


class ColumnDetailView(APIView):
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


class ColumnDuplicateView(APIView):
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


class ColumnTypeUpdateView(APIView):
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


class ColumnExtensionsView(APIView):
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


class ColumnSettingsView(APIView):
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

class MongoHealthCheckView(APIView):
    """
    GET /api/mongodb/check
    Checks connection to MongoDB database and returns real-time diagnostics.
    """
    @extend_schema(summary="Check MongoDB database connection status and server info")
    def get(self, request):
        from appcore.db import check_mongo_connection
        status_info = check_mongo_connection()
        http_status = status.HTTP_200_OK if status_info.get("ok") else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(status_info, status=http_status)


class MongoSyncView(APIView):
    """
    POST /api/mongodb/sync
    Synchronizes Django models into MongoDB collections.
    """
    @extend_schema(summary="Synchronize PostgreSQL/SQLite board data into MongoDB collections")
    def post(self, request):
        from appcore.db import sync_django_models_to_mongo
        sync_result = sync_django_models_to_mongo()
        return Response(sync_result, status=status.HTTP_200_OK)

