"""Create SYNTHETIC client portal data for local screenshots and demonstrations.

Refuses to run unless DEBUG is on and the environment is not production. Everything it creates is labelled
synthetic (the organisations carry the flag and the UI shows a banner), uses reserved example addresses, sends
no email, and is never real customer data. Run it only against a local development database.
"""

from __future__ import annotations

import datetime as dt
import secrets

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.roles import SUPERADMIN
from apps.accounts.services import set_role
from apps.aidata import services as aidata_services
from apps.aidata.models import Opportunity
from apps.portal import notifications, services
from apps.portal.models import (
    ChangeStatus,
    Membership,
    Organisation,
    Role,
)

ORGS = ("Northwind Synthetic Ltd", "Contoso Synthetic plc")
SYNTHETIC_PREFIX = "[Synthetic] "


class Command(BaseCommand):
    help = "Create synthetic client portal organisations, users, challenges, projects and updates (development only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password", default="", help="Password for the synthetic users (random if omitted)."
        )
        parser.add_argument(
            "--staff-email", default="", help="Also create a synthetic SuperAdmin for admin screenshots."
        )
        parser.add_argument(
            "--reset", action="store_true", help="Delete earlier synthetic portal data first."
        )

    def handle(self, *args, **options):
        if settings.APP_ENVIRONMENT == "production" or not settings.DEBUG:
            raise CommandError(
                "portal_seed_demo creates synthetic data and runs only with DEBUG on outside production."
            )
        if Organisation.objects.filter(name__in=ORGS).exists():
            if not options["reset"]:
                raise CommandError("Synthetic portal data already exists. Use --reset to rebuild it.")
            self._reset()
        password = options["password"] or secrets.token_urlsafe(14)
        with notifications.email_suppressed():
            staff = self._staff(options["staff_email"], password)
            self._build(staff, password)
        self.stdout.write(self.style.SUCCESS("Synthetic portal data created (no email was sent)."))
        self.stdout.write(f"Synthetic password for every demo user: {password}")
        self.stdout.write(
            "Customers: approver@northwind.example.test, contributor@northwind.example.test, "
            "viewer@northwind.example.test, signatory@northwind.example.test, approver@contoso.example.test"
        )

    # ------------------------------------------------------------------------------------------------------------

    def _reset(self):
        from apps.portal.models import Approval, Challenge

        orgs = Organisation.objects.filter(name__in=ORGS)
        # Approvals are protected records; only synthetic ones are ever removed here.
        Approval.objects.filter(version__deliverable__project__challenge__organisation__in=orgs).delete()
        Challenge.objects.filter(organisation__in=orgs).delete()
        User.objects.filter(
            email__endswith=".example.test", portal_memberships__organisation__in=orgs
        ).delete()
        orgs.delete()
        Opportunity.objects.filter(title__startswith=SYNTHETIC_PREFIX).delete()

    def _staff(self, email, password):
        if not email:
            return None
        user, created = User.objects.get_or_create(
            email=email.lower(), defaults={"full_name": "Demo Staff (synthetic)"}
        )
        user.set_password(password)
        user.save()
        set_role(user, SUPERADMIN, actor=None)
        return user

    def _member(self, org, email, name, role, password, staff):
        member = services.invite_member(
            organisation=org, email=email, full_name=name, role=role, actor=staff, send=False
        )
        member.user.set_password(password)
        member.user.save()
        member.invitations.update(used_at=timezone.now())
        member.accepted_at = timezone.now()
        member.previous_visit_at = timezone.now() - dt.timedelta(days=3)
        member.save()
        return member

    def _opportunity(self, staff, title, problem, outcome):
        opp = aidata_services.create_opportunity(
            {
                "title": SYNTHETIC_PREFIX + title,
                "organisation": "Synthetic organisation",
                "problem_summary": problem,
                "desired_outcome": outcome,
                "internal_notes": "Internal: synthetic qualification notes that must never reach the customer.",
            },
            staff or User.objects.filter(is_superuser=True).first() or self._fallback_actor(),
        )
        return opp

    def _fallback_actor(self):
        user, _ = User.objects.get_or_create(email="seed-actor@example.test")
        set_role(user, SUPERADMIN, actor=None)
        return user

    def _build(self, staff, password):
        actor = staff or self._fallback_actor()
        today = timezone.localdate()
        nw = services.create_organisation(name=ORGS[0], actor=actor, synthetic=True)
        cs = services.create_organisation(name=ORGS[1], actor=actor, synthetic=True)
        self._member(nw, "viewer@northwind.example.test", "Vera Viewer", Role.VIEWER, password, actor)
        self._member(
            nw, "contributor@northwind.example.test", "Colin Contributor", Role.CONTRIBUTOR, password, actor
        )
        approver = self._member(
            nw, "approver@northwind.example.test", "Alma Approver", Role.APPROVER, password, actor
        )
        self._member(nw, "signatory@northwind.example.test", "Sam Signatory", Role.SIGNATORY, password, actor)
        self._member(cs, "approver@contoso.example.test", "Bea Contoso", Role.APPROVER, password, actor)

        # --- Northwind: a full journey ---
        opp = self._opportunity(
            actor,
            "Supplier invoice matching",
            "Our bookkeeper re-keys supplier invoices into the ledger by hand every week and checks them against statements. It takes most of a day and mistakes slip through.",
            "Invoices matched to the ledger without re-keying, with anything unusual flagged for a person to check.",
        )
        ch = services.link_challenge(
            opportunity=opp, organisation=nw, actor=actor, title="Supplier invoice matching"
        )
        services.update_challenge(
            ch,
            actor=actor,
            journey_stage="active",
            status_note="Pilot under way: prototype review is next",
            internal_notes="Internal: margin assumptions and qualification score.",
        )
        services.share_challenge(ch, actor=actor)
        v1 = ch.briefs.get(number=1)
        services.propose_brief(v1, actor=actor)
        services.review_brief(
            Membership.objects.get(pk=approver.pk), v1, accept=True, comment="", request=None
        )
        v2 = services.save_brief(
            ch,
            actor=actor,
            summary="Adds the weekly statement check",
            change_note="We heard that statements are checked weekly, so the pilot now includes that step.",
            segments=[
                # No source enquiry in the seed, so the problem is Vitalos's wording (an agreed fact).
                {"id": "s1", "text": f"The problem: {opp.problem_summary}", "provenance": "agreed_fact"},
                {"id": "s2", "text": "Statements arrive weekly as PDF and CSV.", "provenance": "agreed_fact"},
                {
                    "id": "s3",
                    "text": "Flag invoices that match more than one ledger line, for a person to decide.",
                    "provenance": "ai_suggestion",
                },
            ],
        )
        services.propose_brief(v2, actor=actor)

        project = services.save_project(
            ch,
            actor=actor,
            name="Invoice matching pilot",
            summary="A four-week pilot that matches supplier invoices to the ledger and flags exceptions for review.",
            agreed_scope="Match supplier invoices from two suppliers to the ledger export. Report matches, near matches and exceptions. No changes are written back to the ledger.",
            status="active",
            target_date=today + dt.timedelta(days=30),
            internal_notes="Internal: fixed fee, 31% margin.",
        )
        services.set_published(project, True, actor=actor)
        m1 = services.save_milestone(
            project,
            actor=actor,
            title="Data received",
            status="complete",
            target_date=today - dt.timedelta(days=12),
            position=1,
            description="Sample ledger export and invoices received.",
        )
        m2 = services.save_milestone(
            project,
            actor=actor,
            title="Prototype review",
            status="awaiting_customer",
            target_date=today + dt.timedelta(days=8),
            position=2,
            description="Walk through the first matching results together.",
        )
        m3 = services.save_milestone(
            project,
            actor=actor,
            title="Pilot go-live decision",
            status="not_started",
            target_date=today + dt.timedelta(days=28),
            position=3,
        )
        for m in (m1, m2, m3):
            services.set_published(m, True, actor=actor)
        for kind, party, text, due in (
            ("responsibility", "vitalos", "Build and run the matching prototype", None),
            ("responsibility", "customer", "Nominate one person to review exceptions", None),
            ("dependency", "customer", "Provide a sample ledger export", today - dt.timedelta(days=2)),
            ("blocker", "customer", "Access to the supplier statements folder", today + dt.timedelta(days=5)),
        ):
            item = services.save_item(project, actor=actor, kind=kind, party=party, text=text, due_date=due)
            services.set_published(item, True, actor=actor)

        report = services.save_deliverable(
            project,
            actor=actor,
            title="Prototype findings report",
            description="What the prototype matched, and what it could not.",
            milestone=m2,
        )
        d1 = services.create_version(
            report,
            actor=actor,
            summary="First findings",
            body="Matched 41 of 50 sample invoices exactly.\n6 were near matches (amount rounding).\n3 had no ledger line.\n\nThis is a synthetic example for demonstration only.",
        )
        services.share_version(d1, actor=actor)
        services.approve_version(Membership.objects.get(pk=approver.pk), d1, comment="Looks right.")
        d2 = services.create_version(
            report,
            actor=actor,
            summary="Adds exception explanations",
            body="Matched 41 of 50 sample invoices exactly.\n6 near matches now show the rounding difference.\n3 exceptions explained: two missing ledger lines, one duplicate invoice.\n\nThis is a synthetic example for demonstration only.",
        )
        services.share_version(d2, actor=actor)
        terms = services.save_deliverable(
            project, actor=actor, title="Pilot terms", description="The agreed pilot terms for acceptance."
        )
        t1 = services.create_version(
            terms,
            actor=actor,
            summary="Pilot terms v1",
            body="Synthetic pilot terms for demonstration. Not a real contract.",
            is_contractual=True,
        )
        services.share_version(t1, actor=actor)

        services.ask_question(
            ch,
            question="Which ledger system do you export from?",
            detail="So we can match the export's column names.",
            due_date=today - dt.timedelta(days=1),
            actor=actor,
        )
        q2 = services.ask_question(ch, question="Who should review exceptions?", actor=actor)
        services.answer_question(
            Membership.objects.get(pk=approver.pk), q2, body="Colin Contributor will review them."
        )
        upd = services.save_update(
            ch,
            title="Week 2: sample data checked",
            body="We checked the sample data and matched most invoices automatically. The next step is a review of the first results with you.",
            project=project,
            actor=actor,
        )
        services.publish_update(upd, actor=actor)
        services.post_staff_message(
            ch, body="Thanks for the sample export. One question on dates is above.", actor=actor
        )
        services.post_customer_message(
            Membership.objects.get(pk=approver.pk), ch, body="Our ledger exports dates as day/month/year."
        )
        change = services.request_change(
            Membership.objects.get(pk=approver.pk),
            project,
            title="Add a second supplier",
            description="Could the pilot include a third supplier's statements as well?",
            affects="scope",
        )
        services.review_change(
            change,
            to_status=ChangeStatus.UNDER_REVIEW,
            response="We are checking what this would involve.",
            note="Internal: check effort.",
            actor=actor,
        )
        services.upload_staff_file(
            ch, _demo_pdf(), actor=actor, title="Pilot overview", visibility="customer", project=project
        )

        svc = services.save_service(
            nw,
            name="Invoice matcher (pilot)",
            description="The matching job running for the pilot.",
            project=project,
            actor=actor,
        )
        services.set_published(svc, True, actor=actor)
        services.report_status(
            svc,
            status="operational",
            summary="Last weekly run completed. No errors were reported.",
            actor=actor,
        )
        svc2 = services.save_service(
            nw, name="Statement import", description="Weekly statement import.", actor=actor
        )
        services.set_published(svc2, True, actor=actor)
        services.report_status(
            svc2,
            status="degraded",
            summary="Two statements arrived late.",
            actor=actor,
            reported_at=timezone.now() - dt.timedelta(days=10),
        )

        # --- Contoso: its own, separate records ---
        opp2 = self._opportunity(
            actor,
            "Support mail triage",
            "Customer support mail is sorted by hand.",
            "Faster, more consistent triage.",
        )
        ch2 = services.link_challenge(
            opportunity=opp2, organisation=cs, actor=actor, title="Support mail triage"
        )
        services.update_challenge(
            ch2, actor=actor, journey_stage="assessment", status_note="Assessment under way"
        )
        services.share_challenge(ch2, actor=actor)
        services.ask_question(ch2, question="How many support emails arrive each day?", actor=actor)


def _demo_pdf():
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(
        "pilot-overview.pdf", b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n", content_type="application/pdf"
    )
