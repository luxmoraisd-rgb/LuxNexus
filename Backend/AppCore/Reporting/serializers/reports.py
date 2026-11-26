from rest_framework import serializers


REPORT_TYPES = ("daily",)


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
    activity = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    status = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    progress = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)
    source_data = serializers.DictField(required=False, default=dict)

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Report title cannot be empty.")
        return value.strip()
