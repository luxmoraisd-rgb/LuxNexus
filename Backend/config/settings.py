import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "development-only-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "false").lower() == "true"
DEFAULT_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

INSTALLED_APPS = [
    "config.apps.MongoContentTypesConfig",
    "config.apps.MongoAuthConfig",
    "corsheaders",
    "rest_framework",
    "django_mongodb_backend",
    "AppCore.apps.AppCoreConfig",
    "AppCore.Backlog.apps.BacklogConfig",
]

DATABASES = {
    "default": {
        "ENGINE": "django_mongodb_backend",
        "HOST": os.getenv("MONGODB_URI", "mongodb://localhost:27017/"),
        "NAME": os.getenv("MONGODB_DATABASE", "nexusapp"),
    }
}

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
CORS_ALLOW_CREDENTIALS = True

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "nexusapp")
DATABASE_ROUTERS = ["django_mongodb_backend.routers.MongoRouter"]
MIGRATION_MODULES = {
    "auth": "config.mongo_migrations.auth",
    "contenttypes": "config.mongo_migrations.contenttypes",
}

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "AppCore.renderers.MongoJSONRenderer",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "AppCore.Auth.authentication.MongoTokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "UNAUTHENTICATED_USER": None,
}

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    },
]

EMAIL_HOST = os.getenv("EMAIL_HOST", "")
if EMAIL_HOST:
    EMAIL_BACKEND = os.getenv(
        "EMAIL_BACKEND",
        "django.core.mail.backends.smtp.EmailBackend",
    )
else:
    EMAIL_BACKEND = os.getenv(
        "EMAIL_BACKEND",
        "django.core.mail.backends.console.EmailBackend",
    )
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "false").lower() == "true"
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "10"))
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@example.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
SECURE_SSL_REDIRECT = os.getenv("DJANGO_SECURE_SSL_REDIRECT", "false").lower() == "true"
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG

if SECURE_SSL_REDIRECT:
    SECURE_HSTS_SECONDS = 31_536_000
