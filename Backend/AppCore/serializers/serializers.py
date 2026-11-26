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
