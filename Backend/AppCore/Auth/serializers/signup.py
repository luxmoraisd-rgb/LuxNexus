from rest_framework import serializers


class SignupSerializer(serializers.Serializer):
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField()
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
