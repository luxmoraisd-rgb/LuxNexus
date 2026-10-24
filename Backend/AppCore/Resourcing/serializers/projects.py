from rest_framework import serializers

from accounts.serializers import UserSerializer
from jira_clone.models import ResourcingProject
from .allocations import ResourceAllocationSerializer


class ResourcingProjectSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    created_by = UserSerializer(read_only=True)
    allocations = ResourceAllocationSerializer(many=True, read_only=True)

    class Meta:
        model = ResourcingProject
        fields = [
            "id", "name", "start_date", "end_date", "created_by",
            "allocations", "created_at", "updated_at",
        ]

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("Start date cannot be after end date.")
        return attrs
