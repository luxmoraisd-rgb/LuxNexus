from rest_framework import serializers


class StageReportSerializer(serializers.Serializer):
    stage = serializers.CharField()
    count = serializers.IntegerField()


class PriorityReportSerializer(serializers.Serializer):
    priority = serializers.CharField()
    count = serializers.IntegerField()


class DashboardSummarySerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)
    total_tasks = serializers.IntegerField()
    tasks_by_stage = StageReportSerializer(many=True)
    tasks_by_priority = PriorityReportSerializer(many=True)
    updated_at = serializers.DateTimeField(required=False, allow_null=True)
