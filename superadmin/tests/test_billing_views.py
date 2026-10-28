"""Billing pages: access, POST-only and CSRF, the editor, issue/void/payments, the document and nav."""

from decimal import Decimal

import pytest
from django.test import Client
from django.utils import timezone

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, VIEWER
from apps.audit.models import AuditEvent
from apps.billing import services
from apps.billing.models import BillingSettings, Invoice, InvoiceStatus, Payment, PaymentMethod
from tests.billing_helpers import make_draft, make_issued, set_vat
from tests.conftest import login


@pytest.fixture
def owner(make_user):
    return make_user(SUPERADMIN, email="owner-views@example.test")


@pytest.fixture
def admin_client(owner):
    return login(Client(), owner)


def _pages(invoice, draft):
    return [
        "/billing/",
        "/billing/invoices/",
        "/billing/invoices/new/",
        f"/billing/invoices/{invoice.number}/",
        f"/billing/invoices/{invoice.number}/document/",
        f"/billing/invoices/{invoice.number}/summary.txt",
        f"/billing/invoices/{draft.ref}/",
        f"/billing/invoices/{draft.ref}/edit/",
        f"/billing/invoices/{draft.ref}/document/",
        "/billing/payments/",
        "/billing/payments/new/",
        "/billing/settings/",
    ]


def test_superadmin_sees_every_page(owner, admin_client):
    invoice, draft = make_issued(owner), make_draft(owner)
    for url in _pages(invoice, draft):
        assert admin_client.get(url).status_code == 200, url


@pytest.mark.parametrize("role", [SERVICE_LEAD, VIEWER, None])
def test_other_roles_get_403(role, owner, make_user):
    invoice, draft = make_issued(owner), make_draft(owner)
    client = login(Client(), make_user(role, email=f"{role or 'none'}-b@example.test"))
    for url in _pages(invoice, draft):
        assert client.get(url).status_code == 403, url
    assert client.post(f"/billing/invoices/{draft.ref}/issue/").status_code == 403
    assert client.post("/billing/payments/sync/").status_code == 403


def test_anonymous_goes_to_login(owner):
    invoice, draft = make_issued(owner), make_draft(owner)
    for url in _pages(invoice, draft):
        response = Client().get(url)
        assert response.status_code == 302 and "/login/" in response["Location"], url


def test_state_changes_are_post_only_and_need_csrf(owner):
    draft = make_draft(owner)
    client = login(Client(enforce_csrf_checks=True), owner)
    for url in (
        f"/billing/invoices/{draft.ref}/issue/",
        f"/billing/invoices/{draft.ref}/void/",
        f"/billing/invoices/{draft.ref}/payment-link/",
        "/billing/payments/sync/",
    ):
        assert client.get(url).status_code == 405, url
        assert client.post(url).status_code == 403, url  # no CSRF token
    draft.refresh_from_db()
    assert draft.status == InvoiceStatus.DRAFT


def test_nav_shows_billing_with_invoices_and_payments_to_superadmin_only(owner, admin_client, make_user):
    html = admin_client.get("/billing/invoices/").content.decode()
    assert 'data-nav-parent="billing"' in html
    assert 'data-nav="invoices"' in html and 'data-nav="payments"' in html
    lead = login(Client(), make_user(SERVICE_LEAD, email="lead-nav@example.test"))
    html = lead.get("/").content.decode()
    assert 'data-nav-parent="billing"' not in html


def _editor_post(data_lines, **fields):
    data = {
        "bill_to_name": "Alex Example",
        "bill_to_organisation": "Example Studio Ltd",
        "bill_to_email": "accounts@example-studio.example",
        "bill_to_address": "1 Example Street",
        "notes": "",
        "lines-TOTAL_FORMS": str(len(data_lines)),
        "lines-INITIAL_FORMS": "0",
        "lines-MIN_NUM_FORMS": "0",
        "lines-MAX_NUM_FORMS": "50",
    }
    for index, (description, quantity, price) in enumerate(data_lines):
        data[f"lines-{index}-description"] = description
        data[f"lines-{index}-quantity"] = quantity
        data[f"lines-{index}-unit_price"] = price
    data.update(fields)
    return data


def test_editor_creates_edits_and_issues(owner, admin_client):
    response = admin_client.post(
        "/billing/invoices/new/",
        _editor_post([("Assessment", "1", "350.00"), ("", "", ""), ("Travel", "2", "12.255")]),
    )
    assert response.status_code == 400  # 12.255 has too many decimal places
    response = admin_client.post(
        "/billing/invoices/new/",
        _editor_post([("Assessment", "1", "350.00"), ("", "", ""), ("Travel", "2", "12.25")]),
    )
    invoice = Invoice.objects.get()
    assert response.status_code == 302 and response["Location"] == f"/billing/invoices/{invoice.ref}/"
    assert invoice.total_pence == 37450
    assert [line.description for line in invoice.lines.all()] == ["Assessment", "Travel"]

    response = admin_client.post(
        f"/billing/invoices/{invoice.ref}/edit/", _editor_post([("Assessment", "1", "400")], issue="1")
    )
    invoice.refresh_from_db()
    assert invoice.status == InvoiceStatus.ISSUED
    assert response["Location"] == f"/billing/invoices/{invoice.number}/"
    # Lines are locked once issued.
    response = admin_client.get(f"/billing/invoices/{invoice.number}/edit/")
    assert response.status_code == 302


def test_editor_needs_a_line(owner, admin_client):
    response = admin_client.post("/billing/invoices/new/", _editor_post([("", "", "")]))
    assert response.status_code == 400
    assert "Add at least one line" in response.content.decode()
    assert Invoice.objects.count() == 0


def test_issue_without_stripe_says_not_configured(owner, admin_client):
    draft = make_draft(owner)
    response = admin_client.post(f"/billing/invoices/{draft.ref}/issue/", follow=True)
    html = response.content.decode()
    assert "Issued INV-" in html
    assert "Stripe is not configured" in html
    draft.refresh_from_db()
    assert draft.status == InvoiceStatus.ISSUED


def test_create_payment_link_without_stripe_is_a_clear_message(owner, admin_client):
    invoice = make_issued(owner)
    response = admin_client.post(f"/billing/invoices/{invoice.number}/payment-link/", follow=True)
    assert "Stripe is not configured" in response.content.decode()


def test_void_from_the_page(owner, admin_client):
    invoice = make_issued(owner)
    assert admin_client.post(f"/billing/invoices/{invoice.number}/void/", {"reason": ""}).status_code == 400
    response = admin_client.post(f"/billing/invoices/{invoice.number}/void/", {"reason": "Raised twice"})
    assert response.status_code == 302
    invoice.refresh_from_db()
    assert invoice.status == InvoiceStatus.VOID


def test_record_payment_from_the_invoice(owner, admin_client):
    invoice = make_issued(owner)
    response = admin_client.post(
        f"/billing/invoices/{invoice.number}/payments/",
        {
            "invoice": invoice.pk,
            "amount": "100.00",
            "method": "bank_transfer",
            "received_on": timezone.localdate().isoformat(),
            "note": "Bank ref EX-42",
        },
    )
    assert response.status_code == 302
    invoice.refresh_from_db()
    assert invoice.status == InvoiceStatus.PARTIALLY_PAID
    assert invoice.amount_paid_pence == 10000
    assert AuditEvent.objects.filter(action="billing.payment_recorded").exists()


def test_payments_page_lists_unmatched_and_links(owner, admin_client):
    invoice = make_issued(owner)
    payment = services.record_manual_payment(
        invoice=None, amount_pence=5000, method=PaymentMethod.OTHER, received_at=timezone.now(), actor=owner
    )
    html = admin_client.get("/billing/payments/?matched=unmatched").content.decode()
    assert 'data-testid="unmatched"' in html
    assert "Stripe is not configured" in html
    response = admin_client.post(f"/billing/payments/{payment.pk}/link/", {"invoice": invoice.pk})
    assert response.status_code == 302
    assert Payment.objects.get(pk=payment.pk).invoice == invoice
    admin_client.post(f"/billing/payments/{payment.pk}/unlink/")
    assert Payment.objects.get(pk=payment.pk).invoice is None


def test_record_unmatched_payment_page(owner, admin_client):
    response = admin_client.post(
        "/billing/payments/new/",
        {"amount": "25.00", "method": "bank_transfer", "received_on": timezone.localdate().isoformat()},
    )
    assert response.status_code == 302
    assert Payment.objects.get().invoice is None


def test_sync_button_without_stripe(owner, admin_client):
    response = admin_client.post("/billing/payments/sync/", follow=True)
    assert "Stripe is not configured" in response.content.decode()


def test_settings_page_saves_and_validates(owner, admin_client):
    conf = BillingSettings.load()
    data = {
        "legal_name": conf.legal_name,
        "company_number": conf.company_number,
        "registered_address": conf.registered_address,
        "contact_email": conf.contact_email,
        "website": conf.website,
        "vat_registered": "on",
        "vat_number": "",
        "default_vat_rate": "20",
        "payment_terms_days": "30",
        "invoice_prefix": "INV",
        "bank_details": "",
        "footer_note": conf.footer_note,
    }
    assert admin_client.post("/billing/settings/", data).status_code == 400  # VAT number required
    data.pop("vat_registered")
    data["invoice_prefix"] = "inv1"
    assert admin_client.post("/billing/settings/", data).status_code == 400
    data["invoice_prefix"] = "INV"
    assert admin_client.post("/billing/settings/", data).status_code == 302
    assert BillingSettings.load().payment_terms_days == 30
    assert AuditEvent.objects.filter(action="billing.settings_changed").exists()


# --- Document ----------------------------------------------------------------------------------------


def test_document_unregistered_has_no_vat_and_shows_payment_details(owner, admin_client):
    invoice = make_issued(owner)
    Invoice.objects.filter(pk=invoice.pk).update(
        stripe_payment_link_url="https://buy.stripe.com/test_fictional",
        stripe_payment_link_id="plink_test_fictional",
        stripe_payment_link_active=True,
        stripe_payment_link_amount_pence=invoice.balance_due_pence,
    )
    html = admin_client.get(f"/billing/invoices/{invoice.number}/document/").content.decode()
    assert "Vitalos Technologies Limited" in html
    assert "16696895" in html
    assert "DN5 0AT" in html
    assert 'data-testid="vat-line"' not in html
    assert "VAT number" not in html
    assert 'data-testid="document-qr"' in html and "<svg" in html
    assert "buy.stripe.com/test_fictional" in html
    assert invoice.payment_code_display in html
    assert "/pay" in html
    assert 'data-testid="bank-details"' not in html
    assert "@page" in html and "A4" in html
    assert "data-print" in html


def test_document_vat_registered_shows_vat(owner, admin_client):
    set_vat(True, Decimal("20"), "GB999999973")
    invoice = make_issued(owner)
    html = admin_client.get(f"/billing/invoices/{invoice.number}/document/").content.decode()
    assert 'data-testid="vat-line"' in html
    assert "GB999999973" in html
    assert "£120.20" in html


def test_document_paid_stamp_and_draft_watermark(owner, admin_client):
    invoice = make_issued(owner)
    services.record_manual_payment(
        invoice=invoice,
        amount_pence=invoice.total_pence,
        method=PaymentMethod.BANK_TRANSFER,
        received_at=timezone.now(),
        actor=owner,
    )
    html = admin_client.get(f"/billing/invoices/{invoice.number}/document/").content.decode()
    assert 'data-testid="paid-stamp"' in html
    assert "How to pay" not in html
    draft = make_draft(owner)
    html = admin_client.get(f"/billing/invoices/{draft.ref}/document/").content.decode()
    assert 'data-testid="draft-watermark"' in html


def test_document_and_pages_escape_customer_text(owner, admin_client):
    evil = '<script>alert("x")</script>'
    invoice = make_issued(
        owner,
        bill_to_name=evil,
        bill_to_address=evil,
        notes=evil,
        lines=[{"description": evil, "quantity": Decimal("1"), "unit_price_pence": 100}],
    )
    for url in (
        f"/billing/invoices/{invoice.number}/document/",
        f"/billing/invoices/{invoice.number}/",
        "/billing/invoices/",
    ):
        html = admin_client.get(url).content.decode()
        assert evil not in html, url
        assert "&lt;script&gt;" in html, url


def test_summary_text(owner, admin_client):
    invoice = make_issued(owner)
    response = admin_client.get(f"/billing/invoices/{invoice.number}/summary.txt")
    assert response["Content-Type"].startswith("text/plain")
    text = response.content.decode()
    assert f"Invoice {invoice.number}" in text
    assert invoice.payment_code_display in text
    assert "vitalos.example/pay" in text


def test_opportunity_page_has_create_invoice_for_superadmin(owner, admin_client):
    from apps.aidata import services as aidata_services

    opportunity = aidata_services.create_opportunity({"title": "Pilot", "organisation": "Example Ltd"}, owner)
    html = admin_client.get(opportunity.get_absolute_url()).content.decode()
    assert 'data-testid="create-invoice"' in html
    response = admin_client.post(f"/billing/invoices/from-opportunity/{opportunity.ref}/")
    invoice = Invoice.objects.get()
    assert response["Location"] == f"/billing/invoices/{invoice.ref}/edit/"
    assert invoice.opportunity == opportunity


def test_unknown_invoice_is_404(admin_client):
    assert admin_client.get("/billing/invoices/INV-2026-0404/").status_code == 404
    assert admin_client.get("/billing/invoices/draft-999/").status_code == 404
