from django.apps import AppConfig


class PortalConfig(AppConfig):
    name = "apps.portal"
    label = "portal"
    verbose_name = "Client portal"

    def ready(self):
        from apps.audit.services import ACTIONS

        from .audit_actions import PORTAL_ACTIONS

        ACTIONS.update(PORTAL_ACTIONS)
