"""Compose the AI & Data and client portal demo seeds so ONE synthetic opportunity flows end to end.

    DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py experience_seed_demo

It runs ``aidata_seed_demo`` (an enquiry read by rules, an approved brief and discovery, a proposal), then
``portal_seed_demo`` (two synthetic customer organisations), then carries the Example Ledger opportunity into the
portal exactly as an operator would: approve the proposal, link the opportunity (the approved brief travels as a
draft), share, propose the brief, and prefill an unpublished project from the proposal, which is then published
so the customer has milestones. The opportunity stays at Proposal while the customer still sees "Submitted", so the
stage-difference prompt can be shown.

For LOCAL use only. It refuses to run without DEBUG or in production, sends no email, never touches a provider, and
prints generated synthetic logins once. Everything it makes is labelled synthetic and uses reserved example.test
addresses.
"""

from __future__ import annotations

import datetime as dt
import io
import os
import secrets

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import User
from apps.aidata import workspace
from apps.aidata.models import DraftKind, DraftState, Opportunity
from apps.portal import continuity, notifications, services
from apps.portal.models import Approval, Challenge, Organisation, Role

STAFF_EMAIL = "synthetic.admin@example.test"
ORG_NAME = "Example Ledger Ltd (synthetic)"
OPPORTUNITY_TITLE = "Example Ledger Ltd [Synthetic]"
MEMBERS = (
    ("sam.synthetic@example-ledger.example.test", "Sam Synthetic", Role.APPROVER),
    ("priya.synthetic@example-ledger.example.test", "Priya Synthetic", Role.CONTRIBUTOR),
)


class Command(BaseCommand):
    help = "Seed one synthetic opportunity through the AI & Data workspace into a portal challenge and project (DEBUG only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Rebuild the synthetic portal data (organisations and challenges only).",
        )
        parser.add_argument(
            "--without-project",
            action="store_true",
            help="Stop before the project: the walkthrough then creates it with 'Create portal project from proposal'.",
        )

    def handle(self, *args, reset=False, without_project=False, **options):
        if (
            not settings.DEBUG
            or settings.APP_ENVIRONMENT == "production"
            or "prod" in os.environ.get("DJANGO_SETTINGS_MODULE", "")
        ):
            raise CommandError(
                "experience_seed_demo creates synthetic data and runs only with DEBUG on outside production."
            )
        if Organisation.objects.filter(name=ORG_NAME).exists() and not reset:
            raise CommandError(
                "Synthetic experience data already exists. Use --reset to rebuild the portal side."
            )
        password = secrets.token_urlsafe(14)
        quiet = io.StringIO()
        with notifications.email_suppressed():
            call_command("aidata_seed_demo", with_users=True, stdout=quiet)
            if reset:
                self._reset()
            call_command(
                "portal_seed_demo", staff_email=STAFF_EMAIL, password=password, reset=reset, stdout=quiet
            )
            staff = User.objects.get(email=STAFF_EMAIL)
            opportunity = self._flow(staff, password, without_project)
        self.stdout.write(
            self.style.SUCCESS(
                "Synthetic experience data created. No email was sent and no model was called."
            )
        )
        self.stdout.write("")
        self.stdout.write("LOCAL synthetic logins (generated now; never real accounts):")
        self.stdout.write(f"  Staff (admin):   {STAFF_EMAIL}   password: {password}")
        for email, name, role in MEMBERS:
            self.stdout.write(f"  Customer ({role}): {email}   password: {password}   ({name})")
        self.stdout.write(
            "  Another organisation (for the isolation check): approver@contoso.example.test, same password."
        )
        self.stdout.write(
            f"  The flow: opportunity {opportunity.ref} for 'Example Ledger Ltd [Synthetic]' -> portal challenge and project; "
            "the opportunity is at Proposal while the customer sees Submitted."
        )

    # ------------------------------------------------------------------------------------------------------

    def _reset(self):
        org = Organisation.objects.filter(name=ORG_NAME).first()
        if org is None:
            return
        # Approvals are protected records; only this synthetic organisation's are removed here.
        Approval.objects.filter(version__deliverable__project__challenge__organisation=org).delete()
        Challenge.objects.filter(organisation=org).delete()
        User.objects.filter(email__in=[m[0] for m in MEMBERS]).delete()
        org.delete()

    def _member(self, org, email, name, role, password, staff):
        member = services.invite_member(
            organisation=org, email=email, full_name=name, role=role, actor=staff, send=False
        )
        member.user.set_password(password)
        member.user.save()
        member.invitations.update(used_at=timezone.now())
        member.accepted_at = timezone.now()
        member.previous_visit_at = timezone.now() - dt.timedelta(days=2)
        member.save()
        return member

    def _flow(self, staff, password, without_project=False):
        opportunity = Opportunity.objects.filter(title=OPPORTUNITY_TITLE).first()
        if opportunity is None:
            raise CommandError("The AI & Data seed did not create the Example Ledger opportunity.")
        proposal = (
            opportunity.drafts.filter(kind=DraftKind.PROPOSAL)
            .exclude(state=DraftState.REJECTED)
            .order_by("-version")
            .first()
        )
        if proposal is not None and proposal.state != DraftState.APPROVED:
            workspace.approve(proposal, staff, note="Synthetic example")
        org = services.create_organisation(name=ORG_NAME, actor=staff, synthetic=True)
        for email, name, role in MEMBERS:
            self._member(org, email, name, role, password, staff)
        challenge = services.link_challenge(
            opportunity=opportunity, organisation=org, actor=staff, title="Supplier statement checking"
        )
        services.share_challenge(challenge, actor=staff)
        brief = challenge.briefs.get(number=1)
        services.propose_brief(brief, actor=staff)
        if proposal is not None and not without_project:
            project, _ = continuity.create_project_from_proposal(challenge, actor=staff)
            services.set_published(project, True, actor=staff)
            today = timezone.localdate()
            for index, milestone in enumerate(project.milestones.order_by("position")):
                services.save_milestone(
                    project,
                    actor=staff,
                    milestone=milestone,
                    status="in_progress" if index == 0 else "not_started",
                    target_date=today + dt.timedelta(days=7 * (index + 1)),
                )
                services.set_published(milestone, True, actor=staff)
            for item in project.items.filter(party="customer"):
                services.set_published(item, True, actor=staff)
            services.save_item(
                project,
                actor=staff,
                kind="responsibility",
                party="vitalos",
                text="Vitalos runs the first statement check and reports the exceptions",
            )
        # The opportunity owner and next action show in the staff status strip.
        opportunity.owner = staff
        opportunity.next_action = "Walk the customer through the first results"
        opportunity.next_action_due = timezone.localdate()
        opportunity.save()
        return opportunity
