

from datetime import date

from rest_framework import serializers


class GoalSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
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
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
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
    pillar_id = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def validate(self, attrs):
        date_fields_provided = {"start_date", "end_date"} & attrs.keys()
        if date_fields_provided:
            instance = self.context.get("instance", {})
            start_date = attrs.get("start_date", instance.get("start_date"))
            end_date = attrs.get("end_date", instance.get("end_date"))
            if isinstance(start_date, str):
                start_date = date.fromisoformat(start_date) if start_date else None
            if isinstance(end_date, str):
                end_date = date.fromisoformat(end_date) if end_date else None

            if (start_date is None) != (end_date is None):
                raise serializers.ValidationError({
                    "start_date": "Both start and end dates are required."
                })
            if start_date and end_date and end_date < start_date:
                raise serializers.ValidationError({
                    "end_date": "End date must be on or after the start date."
                })

        return attrs
