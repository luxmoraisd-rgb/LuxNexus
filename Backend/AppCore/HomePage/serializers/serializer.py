from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from AppCore.HomePage.models import Workspace, Project, Task, DashboardWidget, Portfolio
from AppCore.serializers.serializers import MongoModelSerializer

class UserSerializer(MongoModelSerializer):
    display_name = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'display_name', 'initials']

    def get_display_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username

    def get_initials(self, obj):
        first = obj.first_name[:1] if obj.first_name else obj.username[:1]
        last = obj.last_name[:1] if obj.last_name else ''
        return (first + last).upper() if last else first.upper()


class RegisterSerializer(MongoModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'first_name', 'last_name']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data.get('username'), password=data.get('password'))
        if not user:
            raise serializers.ValidationError("Invalid username or password.")
        data['user'] = user
        return data


class WorkspaceSerializer(MongoModelSerializer):
    owner_details = UserSerializer(source='owner', read_only=True)
    project_count = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = ['id', 'name', 'description', 'owner', 'owner_details', 'project_count', 'created_at']
        read_only_fields = ['id', 'owner', 'created_at']

    def get_project_count(self, obj):
        return obj.projects.count()


class ProjectSerializer(MongoModelSerializer):
    owner_details = UserSerializer(source='owner', read_only=True)
    members_details = UserSerializer(source='members', many=True, read_only=True)
    total_tasks_count = serializers.IntegerField(read_only=True)
    tasks_due_soon_count = serializers.IntegerField(read_only=True)
    completed_tasks_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Project
        fields = [
            'id',
            'workspace',
            'name',
            'description',
            'owner',
            'owner_details',
            'members',
            'members_details',
            'color',
            'icon',
            'status',
            'is_favorite',
            'total_tasks_count',
            'tasks_due_soon_count',
            'completed_tasks_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']


class TaskSerializer(MongoModelSerializer):
    assignee_details = UserSerializer(source='assignee', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    date_range_display = serializers.CharField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id',
            'title',
            'description',
            'project',
            'project_name',
            'workspace',
            'assignee',
            'assignee_details',
            'created_by',
            'start_date',
            'due_date',
            'is_completed',
            'completed_at',
            'priority',
            'status_category',
            'is_overdue',
            'date_range_display',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'is_overdue', 'date_range_display', 'created_at', 'updated_at']


class DashboardWidgetSerializer(MongoModelSerializer):
    class Meta:
        model = DashboardWidget
        fields = ['id', 'user', 'widget_type', 'position', 'is_visible', 'settings']
        read_only_fields = ['id', 'user']


class DashboardSummarySerializer(serializers.Serializer):
    greeting = serializers.CharField()
    current_date = serializers.CharField()
    user = UserSerializer()
    stats = serializers.DictField()
    my_tasks = serializers.DictField()
    recent_projects = ProjectSerializer(many=True)
    workspaces = WorkspaceSerializer(many=True)
