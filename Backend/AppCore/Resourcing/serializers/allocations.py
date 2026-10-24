from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.serializers import UserSerializer
from jira_clone.models import ResourceAllocation, ResourcingProject
from .common import StringPrimaryKeyRelatedField

User = get_user_model()


class ResourceAllocationSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    project = StringPrimaryKeyRelatedField(
        queryset=ResourcingProject.objects.all(),
        pk_field=serializers.CharField(),
    )
    user = StringPrimaryKeyRelatedField(
        queryset=User.objects.all(),
        pk_field=serializers.CharField(),
    )
    user_details = UserSerializer(source="user", read_only=True)

    class Meta:
        model = ResourceAllocation
        fields = ["id", "project", "user", "user_details", "month", "hours"]

    def validate_month(self, value):
        if value.day != 1:
            raise serializers.ValidationError("Month must use the first day of the month.")
        return value

    def validate_hours(self, value):
        if value < 0:
            raise serializers.ValidationError("Hours cannot be negative.")
        return value
