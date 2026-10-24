from rest_framework import serializers


class DashboardWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    title = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    description = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    type = serializers.CharField(max_length=50, required=False, allow_blank=True, default="purple")
    starred = serializers.BooleanField(required=False, default=False)
    icon = serializers.CharField(max_length=50, required=False, allow_blank=True, default="chart")

    def validate(self, attrs):
        title = attrs.get("title") or attrs.get("name")
        if not title or not title.strip():
            raise serializers.ValidationError({"name": "Dashboard name cannot be empty."})
        attrs["name"] = title.strip()
        attrs["title"] = title.strip()
        return attrs


class DashboardSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    title = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    type = serializers.CharField(required=False, allow_blank=True, default="purple")
    starred = serializers.BooleanField(required=False, default=False)
    icon = serializers.CharField(required=False, allow_blank=True, default="chart")
    created_at = serializers.DateTimeField(required=False, allow_null=True)
    updated_at = serializers.DateTimeField(required=False, allow_null=True)
