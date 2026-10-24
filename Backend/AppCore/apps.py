from django.apps import AppConfig


class AppCoreConfig(AppConfig):
    name = "AppCore"

    def ready(self):
        from . import checks  # noqa: F401
