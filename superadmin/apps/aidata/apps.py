from django.apps import AppConfig


class AiDataConfig(AppConfig):
    name = "apps.aidata"
    label = "aidata"
    verbose_name = "AI & Data"

    def ready(self):
        # Registered here (not in apps/audit/services.py) so parallel workstreams do not collide.
        from apps.audit.services import ACTIONS

        ACTIONS.update(
            {
                "aidata.draft_queued": "Queued an AI & Data draft",
                "aidata.draft_prepared": "AI & Data draft prepared (by AI or rules)",
                "aidata.draft_failed": "An AI & Data draft failed",
                "aidata.draft_recovered": "Recovered an interrupted AI & Data draft",
                "aidata.draft_retried": "Retried an AI & Data draft",
                "aidata.draft_cancelled": "Cancelled an AI & Data draft",
                "aidata.draft_edited": "Edited an AI & Data draft",
                "aidata.draft_reviewed": "Reviewed an AI & Data draft",
                "aidata.draft_approved": "Approved an AI & Data draft",
                "aidata.draft_rejected": "Rejected an AI & Data draft",
                "aidata.draft_revised": "Started a new version of an AI & Data draft",
                "aidata.brief_approved": "Approved an AI & Data brief",
                "aidata.opportunity_qualified": "Qualified an AI & Data opportunity",
                "aidata.proposal_exported": "Exported an AI & Data proposal draft",
                "aidata.assistant_asked": "Asked the AI & Data opportunity assistant",
            }
        )
