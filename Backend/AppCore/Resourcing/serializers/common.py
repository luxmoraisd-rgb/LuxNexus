from rest_framework import serializers


class StringPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """Represent MongoDB ObjectId primary keys as JSON-safe strings."""

    def to_representation(self, value):
        return str(value.pk)
