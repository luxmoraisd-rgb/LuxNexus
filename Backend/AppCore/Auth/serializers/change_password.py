from rest_framework import serializers


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=False, allow_blank=True, write_only=True)
    old_password = serializers.CharField(required=False, allow_blank=True, write_only=True)
    new_password = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)
    otp = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        new_pass = attrs.get("new_password")
        confirm_pass = attrs.get("confirm_password")
        if new_pass != confirm_pass:
            raise serializers.ValidationError({"confirm_password": ["The new passwords do not match."]})
        return attrs
