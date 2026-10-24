from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if not (attrs.get("username") or "").strip() and not (
            attrs.get("email") or ""
        ).strip():
            raise serializers.ValidationError(
                {
                    "error": (
                        "Please provide your registered email address or username."
                    ),
                    "email": "Email address is required.",
                }
            )
        return attrs
