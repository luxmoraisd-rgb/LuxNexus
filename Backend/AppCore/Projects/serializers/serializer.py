from rest_framework import serializers


class ProjectSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=255, required=True)
    key = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    category = serializers.CharField(max_length=100, required=False, default="Engineering")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    color = serializers.CharField(max_length=50, required=False, default="#6366f1")
    is_default_workspace = serializers.BooleanField(required=False, default=False)
    isDefaultWorkspace = serializers.BooleanField(required=False, default=False)
    progress = serializers.IntegerField(min_value=0, max_value=100, required=False, default=0)
    active_sprint_name = serializers.CharField(max_length=100, required=False, default="Sprint 1")
    activeSprintName = serializers.CharField(max_length=100, required=False, default="Sprint 1")
    start_date = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    startDate = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    created_by = serializers.CharField(required=False, allow_blank=True, default="user")
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)
