from bson import ObjectId


def valid_object_id(value):
    """Return True only for valid MongoDB ObjectId URL parameters."""
    return isinstance(value, str) and ObjectId.is_valid(value)
