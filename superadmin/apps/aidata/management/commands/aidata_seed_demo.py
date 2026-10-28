"""Seed SYNTHETIC AI & Data workspace records for local screenshots and demos.

    DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py aidata_seed_demo --with-users

Refuses to run unless DEBUG is on and the environment is not production, so it can never add fake
records to the live system. Every record is labelled "[Synthetic]" and uses example.test addresses.
Nothing is sent anywhere. Briefs and discovery are read by rules (no model call); one failed and one
running draft are written directly so those states can be photographed, and are marked as seeded.
"""

from __future__ import annotations

import os
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.roles import SUPERADMIN, VIEWER
from apps.accounts.services import set_role
from apps.aidata import services, workspace
from apps.aidata.models import Draft, DraftKind, DraftMode, DraftState, Opportunity, Stage

ENQUIRY_A = """Hi, I'm Sam Example from Example Ledger Ltd [Synthetic]. We're an accountancy practice.
At the moment we re-key supplier statements into Xero by hand, about 40 a month, and it takes two days.
We'd like it to flag mismatches against our ledger automatically. Budget around £2,000, ideally by March.
You can reach me on 07700 900123 or sam@example-ledger.example.
Thanks,
Sam Example"""

NOTES_A = """Discovery call with Sam (synthetic notes).
1. Sam downloads the supplier statement PDF from the supplier portal.
2. Sam re-keys each line into a spreadsheet.
3. Sam compares the spreadsheet with the Xero ledger and marks differences.
4. Sam emails the supplier about each difference.
The new process must flag any line that is not in the ledger. It should keep a record of who checked each statement.
We assume statements arrive as text-based PDFs. Not sure how many suppliers send scanned copies?
Done when a month of statements is checked in under two hours with no missed mismatches.
"""

ENQUIRY_B = """We run a garage and order parts by phone and email. Orders get lost between the counter and the workshop.
We want one queue so nothing is missed. Name: Pat Example. Email: pat@example-garage.example. Organisation: Pat's Garage Ltd [Synthetic]"""


class Command(BaseCommand):
    help = "Seed synthetic AI & Data workspace records (DEBUG only; refuses in production)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-users", action="store_true", help="Also create a synthetic SuperAdmin and Viewer."
        )

    def handle(self, *args, with_users=False, **options):
        if (
            not settings.DEBUG
            or settings.APP_ENVIRONMENT == "production"
            or "prod" in os.environ.get("DJANGO_SETTINGS_MODULE", "")
        ):
            raise CommandError(
                "Refusing to seed demo data: DEBUG is off or this is a production environment."
            )
        admin = self._user("synthetic.admin@example.test", SUPERADMIN, with_users)
        if with_users:
            self._user("synthetic.viewer@example.test", VIEWER, True)
        if admin is None:
            raise CommandError("Create a user first (--with-users) so the records have an actor.")
        if Opportunity.objects.filter(title__contains="[Synthetic]").exists():
            self.stdout.write("Synthetic records already exist. Nothing changed.")
            return
        self._example_ledger(admin)
        self._garage(admin)
        self._failed_and_running(admin)
        self.stdout.write(self.style.SUCCESS("Seeded synthetic AI & Data records."))

    def _user(self, email, role, create):
        user = User.objects.filter(email=email).first()
        if user is None and create:
            user = User.objects.create_user(email=email, password=secrets.token_urlsafe(16))
            set_role(user, role, actor=None)
        return user

    def _example_ledger(self, admin):
        draft, _ = workspace.prepare_brief(
            source_text=ENQUIRY_A,
            source_label="Pasted enquiry (synthetic)",
            key="seed-a-brief",
            actor=admin,
            mode=DraftMode.RULES,
        )
        opportunity = workspace.apply_brief(
            draft,
            draft.payload["fields"],
            admin,
            title="Example Ledger Ltd [Synthetic]",
            offer="ai-proof-of-value",
            next_action="Book a discovery call",
        )
        services.change_stage(opportunity, Stage.DISCOVERY, admin)
        questions, _ = workspace.start_questions(
            opportunity, key="seed-a-q", actor=admin, mode=DraftMode.RULES
        )
        workspace.update_questions(questions, {"q1": "Sam does it all, monthly."}, admin)
        pack, _ = workspace.start_discovery(
            opportunity, notes=NOTES_A, key="seed-a-d", actor=admin, mode=DraftMode.RULES
        )
        workspace.mark_reviewed(pack, admin)
        workspace.approve(pack, admin, note="Synthetic example")
        services.change_stage(opportunity, Stage.QUALIFIED, admin)
        services.change_stage(opportunity, Stage.PROPOSAL, admin)
        proposal, _ = workspace.start_proposal(opportunity, key="seed-a-p", actor=admin)
        workspace.mark_reviewed(proposal, admin)

    def _garage(self, admin):
        draft, _ = workspace.prepare_brief(
            source_text=ENQUIRY_B,
            source_label="Pasted enquiry (synthetic)",
            key="seed-b-brief",
            actor=admin,
            mode=DraftMode.RULES,
        )
        opportunity = workspace.apply_brief(
            draft,
            draft.payload["fields"],
            admin,
            title="Pat's Garage Ltd [Synthetic]",
            offer="ai-opportunity-assessment",
            next_action="Reply with questions about the current process",
        )
        services.change_stage(opportunity, Stage.DISCOVERY, admin)
        services.change_stage(
            opportunity, Stage.QUALIFIED, admin
        )  # blocked from Proposal: no approved discovery

    def _failed_and_running(self, admin):
        opportunity = services.create_opportunity(
            {
                "title": "Property lettings follow-up [Synthetic]",
                "organisation": "Example Lettings Ltd",
                "sector": "property",
                "problem_summary": "Tenants chase repairs by phone.",
            },
            admin,
        )
        now = timezone.now()
        Draft.objects.create(
            opportunity=opportunity,
            kind=DraftKind.DISCOVERY,
            version=1,
            state=DraftState.FAILED,
            mode=DraftMode.RULES,
            requested_mode=DraftMode.AI,
            idempotency_key="seed-failed",
            source_label="Meeting notes (synthetic)",
            source_text="Synthetic notes: tenants report repairs by phone; an agent logs them in a spreadsheet.",
            attempts=2,
            error_category="timeout",
            error_detail="Gave up after 3 attempts (timeout). Seeded row for screenshots.",
            created_by=admin,
            finished_at=now,
        )
        other = services.create_opportunity(
            {
                "title": "Trades scheduling [Synthetic]",
                "organisation": "Example Electrical Ltd",
                "sector": "trades-field-services",
            },
            admin,
        )
        Draft.objects.create(
            opportunity=other,
            kind=DraftKind.QUESTIONS,
            version=1,
            state=DraftState.RUNNING,
            mode=DraftMode.RULES,
            requested_mode=DraftMode.AI,
            idempotency_key="seed-running",
            attempts=1,
            started_at=now,
            heartbeat_at=now,
            lease_expires_at=now + timedelta(minutes=30),
            created_by=admin,
        )
