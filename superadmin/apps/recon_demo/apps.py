from django.apps import AppConfig


class ReconDemoConfig(AppConfig):
    name = "apps.recon_demo"
    label = "recon_demo"
    verbose_name = "AI & Data demonstrator"

    def ready(self):
        # Registered here (not in apps/audit/services.py) so parallel workstreams do not collide.
        from apps.audit.services import ACTIONS

        ACTIONS.update(
            {
                "recon_demo.run_created": "Started a demonstrator reconciliation run",
                "recon_demo.run_retried": "Retried a failed demonstrator run",
                "recon_demo.run_continued": "Continued a failed demonstrator run without the model",
                "recon_demo.review_decided": "Decided a demonstrator review item",
            }
        )
