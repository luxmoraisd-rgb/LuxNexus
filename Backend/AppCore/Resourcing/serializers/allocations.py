from rest_framework import serializers


class UserSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)


class ResourceAllocationSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    project = serializers.CharField()
    user = serializers.CharField()
    user_details = UserSerializer(source="user", read_only=True)
    month = serializers.DateField()
    hours = serializers.DecimalField(max_digits=8, decimal_places=2)

    def validate_month(self, value):
        if value.day != 1:
            raise serializers.ValidationError("Month must use the first day of the month.")
        return value

    def validate_hours(self, value):
        if value < 0:
            raise serializers.ValidationError("Hours cannot be negative.")
        return value
