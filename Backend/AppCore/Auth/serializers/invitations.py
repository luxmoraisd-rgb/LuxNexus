from rest_framework import serializers

from ..role_permissions import ROLE_LABELS


class CreateInvitationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=tuple(ROLE_LABELS))

    def validate_email(self, value):
        return value.strip().lower()


class InvitationTokenSerializer(serializers.Serializer):
    token = serializers.CharField(min_length=32, max_length=200)
