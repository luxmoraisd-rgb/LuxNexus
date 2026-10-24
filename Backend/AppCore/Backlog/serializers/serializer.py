"""
Serializers for Board, Sprint, BoardView, BoardColumn, Task, and User models.
Supports request payloads and nested responses matching the Agile UI specifications.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from AppCore.serializers.serializers import MongoModelSerializer
from ..models import Board, Sprint, BoardView, BoardColumn, Task

User = get_user_model()


class UserSerializer(MongoModelSerializer):
    name = serializers.SerializerMethodField()
    initial = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'email',
            'name',
            'initial',
            'display_name',
            'initials',
        ]

    def get_name(self, obj):
        return self.get_display_name(obj)

    def get_initial(self, obj):
        return self.get_initials(obj)

    def get_display_name(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full if full else obj.username

    def get_initials(self, obj):
        if obj.first_name:
            return obj.first_name[0].upper()
        return obj.username[0].upper() if obj.username else "U"


class BoardSerializer(MongoModelSerializer):
    class Meta:
        model = Board
        fields = ['id', 'name', 'key', 'description', 'created_at', 'updated_at']


class TaskSerializer(MongoModelSerializer):
    taskId = serializers.CharField(source='task_key', required=False)
    type = serializers.CharField(source='task_type', required=False)
    sp = serializers.IntegerField(source='estimated_sp', required=False)
    sprintId = serializers.PrimaryKeyRelatedField(
        queryset=Sprint.objects.all(), source='sprint', required=False, allow_null=True
    )
    board = BoardSerializer(read_only=True)
    board_id = serializers.PrimaryKeyRelatedField(
        queryset=Board.objects.all(), source='board', write_only=True, required=False
    )
    sprint = serializers.PrimaryKeyRelatedField(read_only=True)
    sprint_id = serializers.PrimaryKeyRelatedField(
        queryset=Sprint.objects.all(), source='sprint', write_only=True, required=False, allow_null=True
    )
    owner_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='owner', write_only=True, required=False, allow_null=True
    )
    owner = UserSerializer(read_only=True)
    startDate = serializers.CharField(source='start_date', required=False, allow_blank=True, allow_null=True)
    start_date = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    dueDate = serializers.CharField(source='due_date', required=False, allow_blank=True, allow_null=True)
    due_date = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Task
        fields = [
            'id',
            'task_key',
            'taskId',
            'title',
            'description',
            'board',
            'board_id',
            'sprint',
            'sprint_id',
            'owner',
            'owner_id',
            'status',
            'task_type',
            'type',
            'estimated_sp',
            'sp',
            'epic',
            'sprintId',
            'start_date',
            'startDate',
            'due_date',
            'dueDate',
            'comments_count',
            'order',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        board = attrs.get('board', getattr(self.instance, 'board', None))
        sprint = attrs.get('sprint', getattr(self.instance, 'sprint', None))
        if sprint and board and sprint.board_id != board.id:
            raise serializers.ValidationError(
                {'sprint_id': 'The selected sprint belongs to a different board.'}
            )

        # Jira & Monday.com style: Incomplete tasks with past due dates belong to the Backlog
        due_date = attrs.get('due_date', getattr(self.instance, 'due_date', None))
        status = attrs.get('status', getattr(self.instance, 'status', 'Ready to start'))
        if due_date and str(status).strip().lower() != 'done':
            try:
                from datetime import datetime, timezone
                clean_str = str(due_date).strip()[:10]
                d = datetime.strptime(clean_str, "%Y-%m-%d").date()
                if d < datetime.now(timezone.utc).date():
                    attrs['sprint'] = None
            except Exception:
                pass

        return attrs


class SprintSerializer(MongoModelSerializer):
    dates = serializers.CharField(source='duration_text', read_only=True)
    isStarted = serializers.SerializerMethodField()
    isCompleted = serializers.SerializerMethodField()
    board = BoardSerializer(read_only=True)
    board_id = serializers.PrimaryKeyRelatedField(
        queryset=Board.objects.all(), source='board', write_only=True, required=False
    )
    total_sp = serializers.ReadOnlyField()
    issues_count = serializers.ReadOnlyField()
    tasks = TaskSerializer(many=True, read_only=True)

    class Meta:
        model = Sprint
        fields = [
            'id',
            'board',
            'board_id',
            'name',
            'status',
            'start_date',
            'end_date',
            'duration_text',
            'dates',
            'isStarted',
            'isCompleted',
            'goals',
            'capacity_limit',
            'total_sp',
            'issues_count',
            'order',
            'tasks',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'total_sp', 'issues_count', 'created_at', 'updated_at']

    def get_isStarted(self, obj):
        return obj.status == 'active'

    def get_isCompleted(self, obj):
        return obj.status == 'completed'


class SprintCapacitySerializer(serializers.Serializer):
    sprint_id = serializers.CharField(source='id')
    name = serializers.CharField()
    total_sp = serializers.IntegerField()
    capacity_limit = serializers.IntegerField()
    capacity_label = serializers.SerializerMethodField()
    issues_count = serializers.IntegerField()
    status = serializers.CharField()

    def get_capacity_label(self, obj):
        return f"{obj.total_sp} SP sum"


class SprintDatesSerializer(serializers.Serializer):
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    duration_text = serializers.CharField(required=False, allow_blank=True)


class SprintGoalSerializer(serializers.Serializer):
    goals = serializers.CharField(allow_blank=True, required=True)


class BoardColumnSerializer(MongoModelSerializer):
    board = BoardSerializer(read_only=True)
    board_id = serializers.PrimaryKeyRelatedField(
        queryset=Board.objects.all(), source='board', write_only=True, required=False
    )

    class Meta:
        model = BoardColumn
        fields = [
            'id',
            'board',
            'board_id',
            'name',
            'column_type',
            'order',
            'is_hidden',
            'settings',
            'extensions',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BoardViewSerializer(MongoModelSerializer):
    board = BoardSerializer(read_only=True)
    board_id = serializers.PrimaryKeyRelatedField(
        queryset=Board.objects.all(), source='board', write_only=True, required=False
    )

    class Meta:
        model = BoardView
        fields = [
            'id',
            'board',
            'board_id',
            'name',
            'view_type',
            'is_custom',
            'is_default',
            'filters',
            'sorting',
            'grouping',
            'hidden_columns',
            'options',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BoardViewOptionSerializer(serializers.Serializer):
    pin_columns = serializers.BooleanField(required=False, default=True)
    item_height = serializers.CharField(required=False, default="medium")
    conditional_coloring = serializers.BooleanField(required=False, default=True)
    default_item_values = serializers.DictField(required=False, default=dict)


class QuickFilterSerializer(serializers.Serializer):
    status = serializers.ListField(child=serializers.CharField(), required=False)
    task_type = serializers.ListField(child=serializers.CharField(), required=False)
    owner_id = serializers.CharField(required=False, allow_null=True)
    unassigned = serializers.BooleanField(required=False)
    search_query = serializers.CharField(required=False, allow_blank=True)


class SortConfigSerializer(serializers.Serializer):
    columnId = serializers.CharField(required=True)
    direction = serializers.ChoiceField(choices=['Ascending', 'Descending', 'asc', 'desc'], default='Ascending')


class ProjectKeySerializer(serializers.Serializer):
    projectKey = serializers.CharField(max_length=20, trim_whitespace=True)

    def validate_projectKey(self, value):
        value = value.upper()
        if not value:
            raise serializers.ValidationError('This field may not be blank.')
        return value
