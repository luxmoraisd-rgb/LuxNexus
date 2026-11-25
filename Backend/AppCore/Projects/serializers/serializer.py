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
    active_sprint_name = serializers.CharField(max_length=100, required=False, default="Sprint 1")
    activeSprintName = serializers.CharField(max_length=100, required=False, default="Sprint 1")
    start_date = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    startDate = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    end_date = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    endDate = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    status = serializers.ChoiceField(
        choices=("Planned", "Active", "On Hold", "Completed", "Archived"),
        required=False,
        default="Active",
    )
    lead = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    project_lead = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    members = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        default=list,
    )
    created_by = serializers.CharField(required=False, allow_blank=True, default="user")
    created_at = serializers.CharField(read_only=True)
    updated_at = serializers.CharField(read_only=True)

    def validate_key(self, value):
        return value.strip().upper()

    def validate_members(self, value):
        return list(dict.fromkeys(member.strip() for member in value if member.strip()))
