from django.conf import settings
from django.core.checks import Error, Warning, register


@register()
def check_email_configuration(app_configs, **kwargs):
    del app_configs, kwargs
    smtp_backend = "django.core.mail.backends.smtp.EmailBackend"
    if settings.EMAIL_BACKEND != smtp_backend:
        return []

    issues = []
    if not settings.EMAIL_HOST:
        issues.append(
            Warning(
                "SMTP email delivery is enabled, but EMAIL_HOST is empty.",
                hint="Set EMAIL_HOST and the remaining SMTP settings in Backend/.env.",
                id="AppCore.W001",
            )
        )
    if settings.EMAIL_USE_TLS and settings.EMAIL_USE_SSL:
        issues.append(
            Error(
                "EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be enabled.",
                hint="Use STARTTLS on port 587 (EMAIL_USE_TLS=true, EMAIL_USE_SSL=false) "
                "or implicit TLS on port 465 (EMAIL_USE_TLS=false, EMAIL_USE_SSL=true).",
                id="AppCore.E001",
            )
        )
    if (
        settings.DEFAULT_FROM_EMAIL.endswith("@nexusapp.local")
        or settings.DEFAULT_FROM_EMAIL.endswith("@example.com")
        or settings.DEFAULT_FROM_EMAIL == "your-account@gmail.com"
    ):
        issues.append(
            Warning(
                "DEFAULT_FROM_EMAIL is a placeholder sender address.",
                hint="Set DEFAULT_FROM_EMAIL to an address verified with your SMTP provider.",
                id="AppCore.W002",
            )
        )
    if bool(settings.EMAIL_HOST_USER) != bool(settings.EMAIL_HOST_PASSWORD):
        issues.append(
            Warning(
                "SMTP username and password are only partially configured.",
                hint="Set both EMAIL_HOST_USER and EMAIL_HOST_PASSWORD, or leave both "
                "blank if your provider does not require SMTP authentication.",
                id="AppCore.W003",
            )
        )
    if settings.EMAIL_HOST.lower() == "smtp.gmail.com" and not (
        settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD
    ):
        issues.append(
            Warning(
                "Gmail SMTP authentication is incomplete.",
                hint="Set EMAIL_HOST_USER to your Gmail address and EMAIL_HOST_PASSWORD "
                "to a Google App Password (not your normal Google password).",
                id="AppCore.W004",
            )
        )
    return issues
