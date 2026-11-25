from rest_framework import serializers

from .allocations import ResourceAllocationSerializer
from .allocations import UserSerializer


class ResourcingProjectSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    created_by = UserSerializer(read_only=True)
    allocations = ResourceAllocationSerializer(many=True, read_only=True)
    name = serializers.CharField(max_length=200)
    start_date = serializers.DateField()
    end_date = serializers.DateField()

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("Start date cannot be after end date.")
        return attrs
