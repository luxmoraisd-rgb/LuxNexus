from decimal import Decimal

from bson import ObjectId
from django.utils import timezone
from rest_framework import serializers


def normalize_related_id_alias(data, alias, field_name):
    if alias not in data or field_name in data:
        return data

    normalized = data.copy()
    value = normalized.pop(alias)
    if isinstance(value, dict):
        value = value.get("id") or value.get("pk")
    normalized[field_name] = None if value in (None, "") else value
    return normalized


class MongoModelSerializer(serializers.ModelSerializer):
    def build_standard_field(self, field_name, model_field):
        if (
            model_field.primary_key
            and model_field.get_internal_type() == "ObjectIdAutoField"
        ):
            return serializers.CharField, {"read_only": True}
        return super().build_standard_field(field_name, model_field)


class ProjectInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    start_date = serializers.DateField()
    end_date = serializers.DateField()

    def validate(self, attrs):
        if attrs["start_date"] < timezone.localdate():
            raise serializers.ValidationError(
                {"start_date": "Start date cannot be earlier than today."}
            )
        if attrs["start_date"] > attrs["end_date"]:
            raise serializers.ValidationError(
                {"end_date": "End date must be on or after the start date."}
            )
        return attrs


class AllocationInputSerializer(serializers.Serializer):
    project = serializers.CharField()
    user = serializers.CharField()
    month = serializers.DateField()
    hours = serializers.DecimalField(
        max_digits=8,
        decimal_places=2,
        min_value=Decimal("0"),
    )

    def validate_project(self, value):
        if not ObjectId.is_valid(value):
            raise serializers.ValidationError("Invalid project id.")
        return value

    def validate_user(self, value):
        if not ObjectId.is_valid(value):
            raise serializers.ValidationError("Invalid user id.")
        return value

    def validate_month(self, value):
        if value.day != 1:
            raise serializers.ValidationError(
                "Month must use the first day of the month."
            )
        return value
