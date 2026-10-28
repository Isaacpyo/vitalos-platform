"""Enquiry → opportunity intake for AI & Data form relays (docs/ai-data/PLAN.md). Fictional data only."""

import logging
from datetime import date
from decimal import Decimal

import pytest

from apps.aidata import intake, services
from apps.aidata.models import Opportunity, Stage
from apps.enquiries import ingest
from apps.enquiries.models import Enquiry

GOAL = """Vitalos AI & Data enquiry
Sector: Accounting and bookkeeping
Business problem or workflow:
We match supplier statements to the purchase ledger by hand every month.
It takes two days.
Current tools and process:
Xero and spreadsheets
Desired outcome:
Exceptions flagged automatically
Indicative budget: £1,000–£5,000 (enquirer's estimate)"""


def notification_body(goal=GOAL) -> str:
    quoted = "\n".join(f"> {line}" if line else ">" for line in goal.split("\n"))
    return (
        "New enquiry\nSam Example\nExample Ledger Ltd\nAI and data · Within 3 months\n"
        "Reply to Sam: mailto:sam@example-ledger.example\n\nGoal\n"
        f"{quoted}\n\nContact details\nName: Sam Example\nOrganisation: Example Ledger Ltd\n"
        "Work email: sam@example-ledger.example\nRole: Practice owner\n\nEnquiry details\n"
        "Intent: AI and data (ai)\nTimeframe: Within 3 months (3-months)\nSource page: /ai-data/contact\n"
    )


def raw(*, message_id="ai-1", body=None, **extra) -> bytes:
    headers = {
        "Reply-To": "Sam Example <sam@example-ledger.example>",
        "Auto-Submitted": "auto-generated",
        "X-Vitalos-Notification": "web.enquiry-notification",
        "X-Vitalos-Reference": "VIT-0A1B2C3D4E5F",
        "X-Vitalos-Pipeline": "ai-data",
        "X-Vitalos-Offer": "ai-opportunity-assessment",
        **extra,
    }
    lines = [
        "From: Vitalos <support@vitalos.co.uk>",
        "To: support@vitalos.co.uk",
        "Subject: New enquiry: AI and data · Sam Example, Example Ledger Ltd · VIT-0A1B2C3D4E5F",
        f"Message-ID: <{message_id}@x.example>",
        "Date: Mon, 26 Oct 2026 09:00:00 +0000",
        *[f"{name}: {value}" for name, value in headers.items() if value is not None],
        "Content-Type: text/plain; charset=utf-8",
        "",
        body if body is not None else notification_body(),
    ]
    return "\r\n".join(lines).encode()


def file(data: bytes) -> Enquiry:
    message, created = ingest.ingest(data, provider="cloudflare")
    assert created
    return message.enquiry


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    monkeypatch.setattr("apps.aidata.services.timezone.localdate", lambda: date(2026, 10, 30))  # a Friday


def test_kept_headers_include_the_pipeline_and_offer():
    assert "X-Vitalos-Pipeline" in ingest.KEPT_HEADERS and "X-Vitalos-Offer" in ingest.KEPT_HEADERS


def test_ai_data_form_relay_opens_an_opportunity_in_new(db):
    enquiry = file(raw())
    opportunity = Opportunity.objects.get(enquiry=enquiry)
    assert opportunity.ref == "OPP-0001" and opportunity.stage == Stage.NEW
    assert (opportunity.contact_name, opportunity.contact_email) == (
        "Sam Example",
        "sam@example-ledger.example",
    )
    assert opportunity.contact_role == "Practice owner" and opportunity.organisation == "Example Ledger Ltd"
    assert opportunity.source == "website_form" and opportunity.website_reference == "VIT-0A1B2C3D4E5F"
    assert opportunity.offer == "ai-opportunity-assessment" and opportunity.estimated_value == Decimal(
        "350.00"
    )
    assert opportunity.next_action == "Review enquiry and reply"
    assert opportunity.next_action_due == date(2026, 11, 2)  # Friday -> Monday
    assert opportunity.sector == "accounting-bookkeeping" and opportunity.budget_band == "1k-5k"
    assert (
        opportunity.problem_summary.startswith("We match supplier statements")
        and "two days" in opportunity.problem_summary
    )
    assert opportunity.current_tools == "Xero and spreadsheets"
    assert opportunity.desired_outcome == "Exceptions flagged automatically"
    assert opportunity.timeframe == "Within 3 months"
    assert opportunity.signed_scope_reference == ""


def test_without_the_pipeline_header_no_opportunity_is_opened(db):
    file(raw(**{"X-Vitalos-Pipeline": None}))
    assert Opportunity.objects.count() == 0


def test_the_header_from_outside_vitalos_is_ignored(db):
    data = raw().replace(b"From: Vitalos <support@vitalos.co.uk>", b"From: Someone <someone@example.test>")
    file(data)
    assert Opportunity.objects.count() == 0


def test_an_unknown_offer_is_ignored(db):
    file(raw(**{"X-Vitalos-Offer": "free-consulting"}))
    opportunity = Opportunity.objects.get()
    assert opportunity.offer == "" and opportunity.estimated_value is None


def test_intake_is_idempotent(db):
    enquiry = file(raw())
    first = Opportunity.objects.get()
    assert services.create_from_enquiry(enquiry, offer="ai-proof-of-value") == first
    # A repeated website notification for the same reference links to the enquiry; still one opportunity.
    linked, created = ingest.ingest(raw(message_id="ai-2"), provider="cloudflare")
    assert created and linked.enquiry == enquiry
    assert Opportunity.objects.count() == 1


def test_a_failing_intake_never_fails_the_ingest(db, monkeypatch, caplog):
    def boom(*args, **kwargs):
        raise RuntimeError("sam@example-ledger.example broke it")

    monkeypatch.setattr("apps.aidata.services.create_from_enquiry", boom)
    with caplog.at_level(logging.ERROR):
        enquiry = file(raw())
    assert Enquiry.objects.filter(pk=enquiry.pk).exists() and Opportunity.objects.count() == 0
    assert "AI & Data intake failed" in caplog.text
    assert "sam@example-ledger.example" not in caplog.text  # no personal data in logs


def test_plain_text_without_the_composed_goal_becomes_the_problem_summary(db):
    file(raw(body="Please call me about automating our invoices."))
    assert Opportunity.objects.get().problem_summary == "Please call me about automating our invoices."


def test_long_text_is_truncated_safely():
    text = "word " * 2000
    fields = intake.parse(text)
    assert len(fields.problem) <= intake.MAX_TEXT and fields.problem.endswith("…")


def test_not_given_sections_are_blank():
    goal = GOAL.replace("Xero and spreadsheets", "Not given").replace("£1,000–£5,000", "Not given")
    fields = intake.parse(notification_body(goal))
    assert fields.tools == "" and fields.budget_band == ""


def test_create_from_any_enquiry_by_hand(db, make_user):
    from apps.accounts.roles import SERVICE_LEAD
    from apps.enquiries import services as enquiry_services

    enquiry = enquiry_services.create_enquiry(
        subject="Question about automation",
        from_name="Jo Example",
        from_email="jo@example-garage.example",
        to_email="support@vitalos.co.uk",
        source=Enquiry.Source.EMAIL,
        snippet="Can AI help with our parts orders?",
    )
    actor = make_user(SERVICE_LEAD)
    opportunity = services.create_from_enquiry(enquiry, actor=actor)
    assert opportunity.source == "other" and opportunity.created_by == actor
    assert opportunity.problem_summary == "Can AI help with our parts orders?"
    assert opportunity.title == f"Jo Example ({enquiry.ref})"


@pytest.mark.parametrize(
    ("value", "key"),
    [
        ("Accounting and bookkeeping", "accounting-bookkeeping"),
        ("Accounting & bookkeeping practices", "accounting-bookkeeping"),
        ("accounting-bookkeeping", "accounting-bookkeeping"),
        ("Trades & field services", "trades-field-services"),
        ("Retail and e-commerce", "retail-ecommerce"),
        ("Other", "other"),
        ("Not given", ""),
        ("Space mining", ""),
    ],
)
def test_sector_labels_map_to_keys(value, key):
    assert intake.sector_key(value) == key
