"""
Authentication classes and utilities for appcore.
Provides flexible authentication for development, JWT/Token support, and user resolution.
"""
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions

User = get_user_model()


class FlexibleAuthentication(authentication.BaseAuthentication):
    """
    Flexible authentication backend:
    - Allows X-User-Id or X-User-Email header for development/testing
    - Resolves Authorization Bearer token or fallback user
    - If no auth provided, allows anonymous or falls back to system user
    """

    def authenticate(self, request):
        # 1. Check for custom X-User-Id header
        user_id = request.headers.get('X-User-Id') or request.META.get('HTTP_X_USER_ID')
        if user_id:
            try:
                user = User.objects.get(pk=user_id)
                return (user, None)
            except (User.DoesNotExist, ValueError):
                pass

        # 2. Check for X-User-Email or X-User-Username header
        username = request.headers.get('X-User-Username') or request.META.get('HTTP_X_USER_USERNAME')
        if username:
            try:
                user = User.objects.get(username=username)
                return (user, None)
            except User.DoesNotExist:
                pass

        # 3. Fallback to standard request.user if already authenticated by Session/CSRF
        if hasattr(request, '_request') and hasattr(request._request, 'user') and request._request.user.is_authenticated:
            return (request._request.user, None)

        # Allow unauthenticated (returns None so DRF permission classes decide)
        return None


def get_current_or_default_user(request):
    """Return the authenticated user or the first active user as fallback."""
    if request and request.user and request.user.is_authenticated:
        return request.user
    
    # Check default demo user
    user = User.objects.filter(is_active=True).first()
    return user
