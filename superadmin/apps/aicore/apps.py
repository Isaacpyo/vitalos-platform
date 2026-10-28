from django.apps import AppConfig


class AiCoreConfig(AppConfig):
    name = "apps.aicore"
    label = "aicore"
    verbose_name = "AI Engineering Core"

    def ready(self):
        # Audit vocabulary for this app, registered here so the shared ACTIONS list is not edited
        # by every workstream (the Activity filter reads the dict at request time).
        from apps.audit.services import ACTIONS

        ACTIONS.update({"aicore.settings_changed": "Changed the AI & Data model settings"})
