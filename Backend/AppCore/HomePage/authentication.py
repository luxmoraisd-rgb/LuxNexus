"""
Authentication and custom permissions for the HomePage API.
"""
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Object-level permission to only allow owners of an object to edit it.
    Assumes the model instance has an `owner` or `created_by` attribute.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        owner = getattr(obj, 'owner', None) or getattr(obj, 'created_by', None)
        return owner == request.user

class IsAssigneeOrOwner(permissions.BasePermission):
    """
    Permission allowing task assignee or task creator to update tasks.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return (
            getattr(obj, 'assignee', None) == request.user or
            getattr(obj, 'created_by', None) == request.user or
            request.user.is_staff
        )

def get_tokens_for_user(user):
    """
    Generate JWT access and refresh tokens for a given user.
    """
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }
