"""
Serializers for Board, Sprint, BoardView, BoardColumn, Task, and User models.
Supports request payloads and nested responses matching the Agile UI specifications.
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from AppCore.ActiveSprint.models import Board, Sprint, BoardView, BoardColumn, Task
from AppCore.serializers.serializers import normalize_related_id_alias

User = get_user_model()
STORY_POINT_VALUES = {1, 2, 3, 5, 7, 9, 10, 12, 13}


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'display_name', 'initials']

    def get_display_name(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full if full else obj.username

    def get_initials(self, obj):
        if obj.first_name:
            return obj.first_name[0].upper()
        return obj.username[0].upper() if obj.username else "U"


class BoardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Board
        fields = ['id', 'name', 'key', 'description', 'created_at', 'updated_at']


class TaskSerializer(serializers.ModelSerializer):
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

    class Meta:
        model = Task
        fields = [
            'id',
            'task_key',
            'project_id',
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
            'estimated_sp',
            'epic',
            'comments_count',
            'order',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def to_internal_value(self, data):
        data = normalize_related_id_alias(data, "owner", "owner_id")
        return super().to_internal_value(data)

    def validate_estimated_sp(self, value):
        if value is not None and value not in STORY_POINT_VALUES:
            raise serializers.ValidationError(
                "Story points must be one of: 1, 2, 3, 5, 7, 9, 10, 12, 13."
            )
        return value

    def validate(self, attrs):
        estimated_sp = attrs.get("estimated_sp")
        if estimated_sp is not None and estimated_sp not in STORY_POINT_VALUES:
            raise serializers.ValidationError(
                {"estimated_sp": "Story points must be one of: 1, 2, 3, 5, 7, 9, 10, 12, 13."}
            )
        return attrs


class SprintSerializer(serializers.ModelSerializer):
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
            'project_id',
            'name',
            'status',
            'start_date',
            'end_date',
            'duration_text',
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


class SprintCapacitySerializer(serializers.Serializer):
    sprint_id = serializers.IntegerField(source='id')
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


class BoardColumnSerializer(serializers.ModelSerializer):
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


class BoardViewSerializer(serializers.ModelSerializer):
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
    owner_id = serializers.IntegerField(required=False, allow_null=True)
    unassigned = serializers.BooleanField(required=False)
    search_query = serializers.CharField(required=False, allow_blank=True)


class SortConfigSerializer(serializers.Serializer):
    columnId = serializers.CharField(required=True)
    direction = serializers.ChoiceField(choices=['Ascending', 'Descending', 'asc', 'desc'], default='Ascending')
