"""AI & Data budget maths, seeded offer prices and opportunity retention. Fictional data only."""

import io
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.accounts.roles import SUPERADMIN
from apps.aidata import selectors, services
from apps.aidata.models import BudgetSettings, CostEntry, OfferPrice, Opportunity, Stage
from apps.aidata.templatetags.aidata_ui import bar_width, gbp
from apps.audit.models import AuditEvent


def cost(category, amount, kind="actual", recurrence="none"):
    return CostEntry.objects.create(
        date=date(2026, 10, 28),
        category=category,
        supplier="Example Supplier",
        description="Fictional cost",
        amount=Decimal(amount),
        kind=kind,
        recurrence=recurrence,
    )


def line(summary, key):
    return next(item for item in summary["lines"] if item.key == key)


def test_seeded_prices_are_the_blueprint_values_all_proposed(db):
    prices = {p.key: (p.price, p.basis, p.status) for p in OfferPrice.objects.all()}
    assert prices == {
        "ai-opportunity-assessment": (Decimal("350.00"), "fixed", "proposed"),
        "ai-proof-of-value": (Decimal("1500.00"), "from", "proposed"),
        "production-ai-engineering": (Decimal("3000.00"), "from", "proposed"),
        "managed-ai-operations": (Decimal("250.00"), "per_month", "proposed"),
    }
    labels = [selectors.price_label(p) for p in selectors.offer_prices()]
    assert labels == ["£350 fixed", "From £1,500", "From £3,000", "From £250 per month"]


def test_seeded_budget_ceilings_and_no_seeded_spend(db):
    budget = BudgetSettings.load()
    assert budget.overall_ceiling == Decimal("1000")
    assert [budget.ceiling_for(key) for key in ("outreach", "ai-api", "infrastructure", "website", "contracts",
                                                "contingency")] == [200, 150, 150, 100, 150, 250]  # fmt: skip
    assert not CostEntry.objects.exists()
    summary = selectors.budget_summary()
    assert summary["overall"].used == 0 and summary["overall"].status == "ok"
    assert summary["ceilings_mismatch"] is False


def test_per_category_actual_planned_committed_and_remaining(db):
    cost("ai-api", "40.50")
    cost("ai-api", "9.50")
    cost("ai-api", "30", kind="planned")
    cost("ai-api", "5", kind="commitment", recurrence="monthly")  # 12 x £5 = £60
    cost("website", "12", kind="commitment", recurrence="annual")
    summary = selectors.budget_summary()
    ai = line(summary, "ai-api")
    assert (ai.actual, ai.planned, ai.committed) == (Decimal("50.00"), Decimal("30.00"), Decimal("60"))
    assert ai.used == Decimal("140.00") and ai.remaining == Decimal("10.00")
    assert ai.status == "warn" and ai.percent == 93
    assert line(summary, "website").committed == Decimal("12")
    assert summary["overall"].used == Decimal("152.00") and summary["overall"].status == "ok"


def test_warning_at_eighty_percent_and_over_ceiling(db):
    cost("website", "79.99")
    assert line(selectors.budget_summary(), "website").status == "ok"
    cost("website", "0.01")
    assert line(selectors.budget_summary(), "website").status == "warn"  # exactly 80 %
    cost("website", "20.01")
    website = line(selectors.budget_summary(), "website")
    assert (
        website.status == "over"
        and website.over_by == Decimal("0.01")
        and website.remaining == Decimal("-0.01")
    )


def test_ceiling_mismatch_is_flagged(db):
    BudgetSettings.objects.filter(pk=1).update(ceiling_contingency=Decimal("300"))
    summary = selectors.budget_summary()
    assert summary["ceilings_mismatch"] and summary["category_total"] == Decimal("1050")


def test_display_helpers():
    assert gbp(Decimal("1500")) == "£1,500" and gbp(Decimal("40.5")) == "£40.50"
    assert gbp(Decimal("-3")) == "−£3" and gbp(None) == "—"
    assert bar_width(0) == "w-0" and bar_width(81) == "w-[80%]" and bar_width(250) == "w-full"


# --- Retention ------------------------------------------------------------------------------------


@pytest.fixture
def admin(make_user):
    return make_user(SUPERADMIN, email="owner@example.test")


def closed(admin, stage, days_ago, **extra):
    opportunity = services.create_opportunity(
        {"title": f"{stage} example", "contact_name": "Sam Example", "contact_email": "sam@example-ledger.example",
         "contact_role": "Owner", "internal_notes": "Prefers calls", **extra},
        admin,
    )  # fmt: skip
    services.add_note(opportunity, "Called Sam on his mobile", admin)
    Opportunity.objects.filter(pk=opportunity.pk).update(
        stage=stage, closed_at=timezone.now() - timedelta(days=days_ago)
    )
    opportunity.refresh_from_db()
    return opportunity


def run(*args) -> str:
    out = io.StringIO()
    call_command("aidata_retention", *args, stdout=out)
    return out.getvalue()


def test_retention_dry_run_changes_nothing(admin):
    old = closed(admin, Stage.LOST, 800)
    output = run()
    assert "Dry run: would anonymise 1 opportunity(ies)" in output and old.ref in output
    old.refresh_from_db()
    assert old.contact_email == "sam@example-ledger.example" and old.anonymised_at is None


def test_retention_apply_anonymises_only_what_the_policy_covers(admin):
    lost = closed(admin, Stage.LOST, 800)
    won = closed(admin, Stage.WON, 800, estimated_value=Decimal("1500"))
    held = closed(admin, Stage.ON_HOLD, 800)
    recent = closed(admin, Stage.LOST, 300)
    active = closed(admin, Stage.DISCOVERY, 800)
    output = run("--apply")
    assert "Anonymised 3 opportunity(ies)." in output
    for item in (lost, won, held):
        item.refresh_from_db()
        assert (item.contact_name, item.contact_email, item.contact_role) == ("[removed]", "", "")
        assert item.internal_notes == "[removed]" and item.anonymised_at is not None
        assert list(item.notes.values_list("body", flat=True)) == ["[removed]"]
    won.refresh_from_db()
    assert won.estimated_value == Decimal("1500.00") and won.title == "won example"  # commercial record kept
    for item in (recent, active):
        item.refresh_from_db()
        assert item.contact_email == "sam@example-ledger.example" and item.anonymised_at is None
    assert AuditEvent.objects.filter(action="aidata.anonymised").count() == 3
    assert "Anonymised 0" in run("--apply")  # idempotent
