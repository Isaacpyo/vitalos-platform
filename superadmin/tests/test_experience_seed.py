"""experience_seed_demo: one synthetic opportunity flows from the workspace into a portal challenge and project."""

import io

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client

from apps.aidata.models import Opportunity
from apps.portal import continuity
from apps.portal.models import Challenge, Organisation, Project


def test_the_seed_refuses_outside_debug_and_in_production(db, settings):
    settings.DEBUG = False
    with pytest.raises(CommandError, match="DEBUG"):
        call_command("experience_seed_demo", stdout=io.StringIO())
    settings.DEBUG = True
    settings.APP_ENVIRONMENT = "production"
    with pytest.raises(CommandError, match="production|DEBUG"):
        call_command("experience_seed_demo", stdout=io.StringIO())
    assert not Organisation.objects.exists() and not Opportunity.objects.exists()


def test_the_seed_carries_one_opportunity_into_a_challenge_and_a_project(db, settings, mailoutbox):
    settings.DEBUG = True
    settings.APP_ENVIRONMENT = "development"
    out = io.StringIO()
    call_command("experience_seed_demo", stdout=out)
    text = out.getvalue()
    assert mailoutbox == []  # no email is sent
    assert "synthetic.admin@example.test" in text and "sam.synthetic@example-ledger.example.test" in text
    assert "priya.synthetic@example-ledger.example.test" in text and "password:" in text

    opportunity = Opportunity.objects.get(title="Example Ledger Ltd [Synthetic]")
    challenge = opportunity.portal_challenge
    assert challenge.organisation.is_synthetic and challenge.is_shared
    brief = challenge.briefs.get(number=1)
    assert brief.status == "proposed"
    # The seed's opportunity comes from pasted text, so its brief carries the approved fields as agreed facts
    # and never presents the paste as the customer's words.
    assert {s["provenance"] for s in brief.segments} == {"agreed_fact"}
    project = Project.objects.get(challenge=challenge)
    assert (
        project.published_at
        and project.source_proposal_id
        and project.milestones.filter(published_at__isnull=False)
    )
    assert not project.deliverables.filter(
        published_at__isnull=False
    ).exists()  # nothing is shared for review yet
    # The opportunity is at Proposal while the customer still sees Submitted: the prompt can be shown.
    difference = continuity.stage_difference(challenge)
    assert (
        difference
        and difference.opportunity_stage == "Assessment / Proposal"
        and difference.customer_stage == "Submitted"
    )
    # A second organisation exists for the isolation check.
    assert Organisation.objects.filter(name="Contoso Synthetic plc").exists()

    # The generated login works, and the customer sees the linked challenge.
    password = text.split("sam.synthetic@example-ledger.example.test   password: ")[1].split()[0]
    client = Client()
    assert (
        client.post(
            "/portal/sign-in/", {"email": "sam.synthetic@example-ledger.example.test", "password": password}
        ).status_code
        == 302
    )
    page = client.get(f"/portal/challenges/{challenge.pk}/").content.decode()
    assert (
        "Supplier statement checking" in page
        and "Synthetic demonstration organisation" in client.get("/portal/").content.decode()
    )

    # Running it again refuses; --reset rebuilds the portal side without duplicating the opportunity.
    with pytest.raises(CommandError, match="already exists"):
        call_command("experience_seed_demo", stdout=io.StringIO())
    call_command("experience_seed_demo", reset=True, stdout=io.StringIO())
    assert Opportunity.objects.filter(title="Example Ledger Ltd [Synthetic]").count() == 1
    assert Challenge.objects.filter(organisation__name="Example Ledger Ltd (synthetic)").count() == 1


def test_without_project_leaves_the_click_to_the_walkthrough(db, settings):
    settings.DEBUG = True
    settings.APP_ENVIRONMENT = "development"
    call_command("experience_seed_demo", without_project=True, stdout=io.StringIO())
    challenge = Challenge.objects.get(organisation__name="Example Ledger Ltd (synthetic)")
    assert not Project.objects.filter(challenge=challenge).exists()
    project, created = continuity.create_project_from_proposal(challenge, actor=challenge.created_by)
    assert created and project.published_at is None
