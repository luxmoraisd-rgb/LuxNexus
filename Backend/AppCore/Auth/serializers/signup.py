import re

from rest_framework import serializers


EMPLOYEE_ID_PATTERN = r"LUX-SD-(?:CHN|BNG|HYD)-(?:00[1-9]|0[1-9]\d|[1-9]\d{2})"


class SignupSerializer(serializers.Serializer):
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField()
    employee_id = serializers.CharField(max_length=15)
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )
    invitation_token = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
        max_length=200,
    )
    fullName = serializers.CharField(required=False, allow_blank=True)
    name = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_employee_id(self, value):
        employee_id = value.strip().upper()
        if not re.fullmatch(EMPLOYEE_ID_PATTERN, employee_id):
            raise serializers.ValidationError(
                "Use LUX-SD-CHN-001 through LUX-SD-CHN-999, replacing CHN with BNG or HYD for your branch."
            )
        return employee_id

    def validate(self, attrs):
        confirmation = attrs.get("confirm_password")
        if confirmation and confirmation != attrs["password"]:
            raise serializers.ValidationError(
                {
                    "confirm_password": "Passwords do not match.",
                    "error": (
                        "Passwords do not match. Please ensure both password "
                        "fields are identical."
                    ),
                }
            )
        return attrs
