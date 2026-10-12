from django.apps import AppConfig


class ArchitectureConfig(AppConfig):
    name = "apps.architecture"
    label = "architecture"
    verbose_name = "Company architecture"

    def ready(self):
        from apps.core import palette

        from .search import palette_provider

        palette.register(palette_provider)
