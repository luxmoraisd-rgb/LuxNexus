

from rest_framework import serializers


class GoalSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=255)
    status = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
        default="on track",
    )
    progress = serializers.IntegerField(
        min_value=0,
        max_value=100,
        default=0,
        required=False,
    )
    time_period = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
        default="",
    )
    timePeriod = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
        default="",
    )
    accountable_team = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default="",
    )
    team = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default="",
    )
    owner = serializers.JSONField(
        required=False,
        allow_null=True,
        default=None,
    )
    due_date = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default="",
    )
    dueDate = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default="",
    )
    status_summary = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    statusSummary = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    comments = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
    )
    privacy = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
        default="",
    )
    parent = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None,
    )
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
