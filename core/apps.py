from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"
    
    def ready(self):
        """Register storage backends when Django starts"""
        # Import backends to trigger registration
        from core import backends  # noqa