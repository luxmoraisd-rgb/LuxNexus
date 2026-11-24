from rest_framework import serializers


REPORT_TYPES = ("daily", "monthly", "sprint", "project")


class ReportWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    report_type = serializers.ChoiceField(choices=REPORT_TYPES, required=False, default="daily")
    report_date = serializers.DateField()
    project_id = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    project = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    sprint_id = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    sprint = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    employee_id = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    employee = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    task = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    activity = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    work_completed = serializers.CharField(max_length=5000, required=False, allow_blank=True, default="")
    status = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    progress = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)
    blockers = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    next_steps = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    source_data = serializers.DictField(required=False, default=dict)

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Report title cannot be empty.")
        return value.strip()


class ReportImportSerializer(serializers.Serializer):
    rows = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
        max_length=1000,
    )
