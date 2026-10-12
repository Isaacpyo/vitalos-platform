from django.apps import AppConfig


class EnquiriesConfig(AppConfig):
    name = "apps.enquiries"
    label = "enquiries"
    verbose_name = "Enquiries"

    def ready(self):
        from apps.core import palette

        from .selectors import palette_provider

        palette.register(palette_provider)
