"""Billing rules: drafts, numbering, issue, void, payments and their recompute, payment links. Fictional data."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN
from apps.audit.models import AuditEvent
from apps.billing import selectors, services
from apps.billing.models import BillingSettings, Invoice, InvoiceStatus, Payment, PaymentMethod
from tests.billing_helpers import make_draft, make_issued, set_vat


@pytest.fixture
def owner(make_user):
    return make_user(SUPERADMIN, email="owner-billing@example.test")


def test_settings_are_seeded_with_the_public_company_details(db):
    conf = BillingSettings.load()
    assert conf.legal_name == "Vitalos Technologies Limited"
    assert conf.company_number == "16696895"
    assert "DN5 0AT" in conf.registered_address
    assert conf.contact_email == "support@vitalos.co.uk"
    assert conf.vat_registered is False
    assert conf.bank_details == ""  # never invented
    assert conf.payment_terms_days == 14
    assert conf.invoice_prefix == "INV"


def test_only_a_superadmin_can_change_billing(make_user, db):
    lead = make_user(SERVICE_LEAD, email="lead-billing@example.test")
    with pytest.raises(PermissionDenied):
        make_draft(lead)
    with pytest.raises(PermissionDenied):
        services.update_settings({"payment_terms_days": 30}, lead)


def test_draft_has_no_number_and_live_totals(owner):
    invoice = make_draft(owner)
    assert invoice.number is None
    assert invoice.display_number == "Draft"
    assert invoice.ref == f"draft-{invoice.pk}"
    assert invoice.status == InvoiceStatus.DRAFT
    assert invoice.total_pence == 60100
    assert invoice.payment_code == ""
    assert AuditEvent.objects.filter(action="billing.invoice_created").count() == 1


def test_issue_allocates_sequential_numbers_and_snapshots(owner):
    today = date(2026, 10, 28)
    first, note = services.issue_invoice(make_draft(owner), owner, today=today)
    second, _ = services.issue_invoice(make_draft(owner), owner, today=today)
    assert first.number == "INV-2026-0001"
    assert second.number == "INV-2026-0002"
    assert note == "Stripe is not configured, so no payment link was created."
    assert first.status == InvoiceStatus.ISSUED
    assert first.issue_date == today
    assert first.due_date == today + timedelta(days=14)
    assert (first.subtotal_pence, first.vat_pence, first.total_pence) == (60100, 0, 60100)
    assert first.balance_due_pence == 60100
    assert first.vat_number == ""
    assert len(first.payment_code) == 8
    assert set(first.payment_code) <= set(services.PAYMENT_CODE_ALPHABET)
    assert not set(first.payment_code) & set("0O1IL")
    assert first.stripe_payment_link_url == ""
    events = AuditEvent.objects.filter(action="billing.invoice_issued")
    assert {e.summary for e in events} == {"Issued invoice INV-2026-0001", "Issued invoice INV-2026-0002"}
    # Summaries carry numbers, never customer names or amounts.
    assert all("Example" not in e.summary and "£" not in e.summary for e in AuditEvent.objects.all())


def test_numbering_restarts_each_year_and_uses_the_prefix(owner):
    conf = BillingSettings.load()
    conf.invoice_prefix = "VIT"
    conf.save()
    a, _ = services.issue_invoice(make_draft(owner), owner, today=date(2026, 12, 31))
    b, _ = services.issue_invoice(make_draft(owner), owner, today=date(2027, 1, 1))
    assert (a.number, b.number) == ("VIT-2026-0001", "VIT-2027-0001")


def test_issue_twice_is_refused_and_numbers_stay_unique(owner):
    invoice = make_issued(owner)
    with pytest.raises(ValidationError):
        services.issue_invoice(invoice, owner)
    assert Invoice.objects.filter(number=invoice.number).count() == 1


def test_issue_with_a_stale_copy_does_not_double_allocate(owner):
    invoice = make_draft(owner)
    stale = Invoice.objects.get(pk=invoice.pk)
    services.issue_invoice(invoice, owner)
    with pytest.raises(ValidationError):
        services.issue_invoice(stale, owner)
    assert Invoice.objects.exclude(number=None).count() == 1


def test_issue_needs_a_positive_total(owner):
    invoice = make_draft(
        owner, lines=[{"description": "Price to agree", "quantity": 1, "unit_price_pence": 0}]
    )
    with pytest.raises(ValidationError, match="more than"):
        services.issue_invoice(invoice, owner)
    invoice.refresh_from_db()
    assert invoice.status == InvoiceStatus.DRAFT and invoice.number is None


def test_vat_registered_issue_snapshots_rate_and_number(owner):
    set_vat(True, Decimal("20"), "GB123456789")
    invoice = make_issued(owner)
    assert (invoice.subtotal_pence, invoice.vat_pence, invoice.total_pence) == (60100, 12020, 72120)
    assert invoice.vat_rate == Decimal("20.00")
    assert invoice.vat_number == "GB123456789"
    set_vat(False)  # a later change never rewrites an issued invoice
    invoice.refresh_from_db()
    assert invoice.total_pence == 72120


def test_lines_are_editable_only_in_draft(owner):
    invoice = make_draft(owner)
    lines = [{"description": "Changed", "quantity": Decimal("1"), "unit_price_pence": 1000}]
    services.update_draft(invoice, {"bill_to_name": "Sam Example"}, lines, owner)
    assert invoice.total_pence == 1000
    assert invoice.bill_to_name == "Sam Example"
    services.issue_invoice(invoice, owner)
    with pytest.raises(ValidationError, match="Only a draft"):
        services.update_draft(invoice, {}, lines, owner)


def test_void_rules(owner):
    draft = make_draft(owner)
    with pytest.raises(ValidationError, match="reason"):
        services.void_invoice(draft, "  ", owner)
    services.void_invoice(draft, "Raised by mistake", owner)
    assert draft.status == InvoiceStatus.VOID
    with pytest.raises(ValidationError):
        services.void_invoice(draft, "Again", owner)

    paid_part = make_issued(owner)
    services.record_manual_payment(
        invoice=paid_part,
        amount_pence=100,
        method=PaymentMethod.BANK_TRANSFER,
        received_at=timezone.now(),
        actor=owner,
    )
    paid_part.refresh_from_db()
    assert paid_part.status == InvoiceStatus.PARTIALLY_PAID
    with pytest.raises(ValidationError):
        services.void_invoice(paid_part, "Customer cancelled", owner)

    issued = make_issued(owner)
    services.void_invoice(issued, "Customer cancelled", owner)
    assert issued.status == InvoiceStatus.VOID
    assert issued.number  # keeps its number
    assert AuditEvent.objects.filter(action="billing.invoice_voided").count() == 2


def test_recompute_partial_full_and_refund(owner):
    invoice = make_issued(owner)
    first = services.record_manual_payment(
        invoice=invoice,
        amount_pence=10000,
        method=PaymentMethod.BANK_TRANSFER,
        received_at=timezone.now(),
        actor=owner,
        note="Bank ref EX-1",
    )
    invoice.refresh_from_db()
    assert (invoice.status, invoice.amount_paid_pence, invoice.balance_due_pence) == (
        InvoiceStatus.PARTIALLY_PAID,
        10000,
        50100,
    )
    services.record_manual_payment(
        invoice=invoice,
        amount_pence=50100,
        method=PaymentMethod.OTHER,
        received_at=timezone.now(),
        actor=owner,
    )
    invoice.refresh_from_db()
    assert invoice.status == InvoiceStatus.PAID
    assert invoice.balance_due_pence == 0
    assert invoice.paid_at is not None
    # A refund of the first payment reopens the balance.
    first.amount_refunded_pence = first.amount_pence
    first.status = "refunded"
    first.save()
    services.recompute(invoice)
    assert invoice.status == InvoiceStatus.PARTIALLY_PAID
    assert invoice.balance_due_pence == 10000
    assert invoice.paid_at is None


def test_manual_payments_cannot_claim_stripe_or_target_drafts(owner):
    draft = make_draft(owner)
    with pytest.raises(ValidationError):
        services.record_manual_payment(
            invoice=None,
            amount_pence=100,
            method=PaymentMethod.STRIPE_CHECKOUT,
            received_at=timezone.now(),
            actor=owner,
        )
    with pytest.raises(ValidationError):
        services.record_manual_payment(
            invoice=draft,
            amount_pence=100,
            method=PaymentMethod.BANK_TRANSFER,
            received_at=timezone.now(),
            actor=owner,
        )
    with pytest.raises(ValidationError):
        services.record_manual_payment(
            invoice=None,
            amount_pence=0,
            method=PaymentMethod.BANK_TRANSFER,
            received_at=timezone.now(),
            actor=owner,
        )


def test_link_and_unlink_an_unmatched_payment(owner):
    invoice = make_issued(owner)
    payment = services.record_manual_payment(
        invoice=None,
        amount_pence=60100,
        method=PaymentMethod.BANK_TRANSFER,
        received_at=timezone.now(),
        actor=owner,
    )
    assert selectors.unmatched_count() == 1
    services.link_payment(payment, invoice, owner)
    invoice.refresh_from_db()
    assert invoice.status == InvoiceStatus.PAID
    with pytest.raises(ValidationError, match="already linked"):
        services.link_payment(payment, invoice, owner)
    services.unlink_payment(payment, owner)
    invoice.refresh_from_db()
    assert invoice.status == InvoiceStatus.ISSUED
    assert Payment.objects.get(pk=payment.pk).invoice is None
    actions = set(AuditEvent.objects.values_list("action", flat=True))
    assert {"billing.payment_recorded", "billing.payment_linked", "billing.payment_unlinked"} <= actions


def test_outstanding_and_overdue_totals(owner):
    a = make_issued(owner)
    b = make_issued(owner)
    Invoice.objects.filter(pk=b.pk).update(due_date=timezone.localdate() - timedelta(days=1))
    make_draft(owner)
    totals = selectors.outstanding()
    assert totals["outstanding_pence"] == a.total_pence + b.total_pence
    assert totals["overdue_count"] == 1
    assert totals["draft_count"] == 1
    assert [i.number for i in selectors.invoices(overdue=True)] == [b.number]
    assert [i.number for i in selectors.invoices(query="inv-2026-0001")] == [a.number]


def test_settings_update_is_audited_without_values(owner):
    changed = services.update_settings({"payment_terms_days": 30, "bank_details": "Fictional Bank"}, owner)
    assert set(changed) == {"payment_terms_days", "bank_details"}
    event = AuditEvent.objects.get(action="billing.settings_changed")
    assert "Fictional" not in event.summary
    assert BillingSettings.load().payment_terms_days == 30


def test_create_from_opportunity_prefills_the_draft(owner):
    from apps.aidata import services as aidata_services

    opportunity = aidata_services.create_opportunity(
        {
            "title": "Reconciliation pilot",
            "organisation": "Example Ledger Ltd",
            "contact_name": "Sam Example",
            "contact_email": "sam@example-ledger.example",
            "offer": "ai-opportunity-assessment",
        },
        owner,
    )
    invoice = services.create_from_opportunity(opportunity, owner)
    assert invoice.opportunity == opportunity
    assert invoice.bill_to_name == "Sam Example"
    assert invoice.bill_to_organisation == "Example Ledger Ltd"
    assert invoice.lines.get().description == "AI Opportunity Assessment"
    assert invoice.total_pence == 0  # the price is for a person to set


def test_payment_code_normalisation():
    assert services.normalise_code("abcd-efgh") == "ABCDEFGH"
    assert services.normalise_code(" ABCD EFGH ") == "ABCDEFGH"
    assert services.normalise_code("ABCD0FGH") == ""  # 0 is not in the alphabet
    assert services.normalise_code("ABC") == ""
    assert selectors.normalise_number(" inv-2026-0007 ") == "INV-2026-0007"
    assert selectors.normalise_number("../etc") == ""
