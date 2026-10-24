from decimal import Decimal

from bson import ObjectId
from rest_framework import serializers


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
        if attrs["start_date"] > attrs["end_date"]:
            raise serializers.ValidationError(
                "Start date cannot be after end date."
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
