from django.apps import AppConfig


class BacklogConfig(AppConfig):
    default_auto_field = 'django_mongodb_backend.fields.ObjectIdAutoField'
    name = 'AppCore.Backlog'
    label = 'backlog'
    verbose_name = 'Agile Board & Sprints Core'
