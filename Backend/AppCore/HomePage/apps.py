from django.apps import AppConfig

class HomePageConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'AppCore.HomePage'
    label = 'appcore'
    verbose_name = 'Home Page'
