from django.apps import AppConfig
import importlib

class AcademicsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'academics'

    def ready(self):
        # Import signal handlers explicitly to avoid relative import edge cases
        importlib.import_module('academics.signals')
