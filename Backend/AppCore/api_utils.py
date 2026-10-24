from rest_framework import status
from rest_framework.response import Response


def validation_error(serializer):
    message = "Invalid request."
    if serializer.errors:
        value = next(iter(serializer.errors.values()))
        message = str(value[0] if isinstance(value, list) else value)
    return Response(
        {
            "error": message,
            "message": message,
            "errors": serializer.errors,
        },
        status=status.HTTP_400_BAD_REQUEST,
    )
