"""Stripe client against a local fake server, payment links on issue, webhook signatures and sync.

Nothing here talks to Stripe. The fake server proves our requests (encoding, headers, idempotency
keys, error mapping, no redirects, no key leaks); it does not prove Stripe accepts them.
"""

import json
import logging
import time
from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from apps.accounts.roles import SUPERADMIN
from apps.audit.models import AuditEvent
from apps.billing import services, stripe_client
from apps.billing.models import BillingSettings, InvoiceStatus, Payment, PaymentMethod
from tests.billing_helpers import FAKE_KEY, WEBHOOK_SECRET, make_draft, make_issued, session_payload


@pytest.fixture
def owner(make_user):
    return make_user(SUPERADMIN, email="owner-stripe@example.test")


# --- Client ---------------------------------------------------------------------------------------


def test_encode_form_uses_bracket_keys():
    pairs = stripe_client.encode_form(
        {
            "line_items": [{"price_data": {"currency": "gbp", "unit_amount": 100}, "quantity": 1}],
            "metadata": {"vitalos_invoice": "INV-2026-0001"},
            "active": False,
            "skip": None,
        }
    )
    assert pairs == [
        ("line_items[0][price_data][currency]", "gbp"),
        ("line_items[0][price_data][unit_amount]", "100"),
        ("line_items[0][quantity]", "1"),
        ("metadata[vitalos_invoice]", "INV-2026-0001"),
        ("active", "false"),
    ]
    with pytest.raises(TypeError):
        stripe_client.encode_form({"unit_amount": 1.5})


def test_client_sends_auth_version_and_idempotency_headers(fake_stripe):
    client = stripe_client.get_client()
    price = client.create_price(
        name="Invoice INV-2026-0001", unit_amount=60100, currency="gbp", idempotency_key="k-1"
    )
    assert price["id"].startswith("price_")
    request = fake_stripe.requests[-1]
    assert request["path"] == "/v1/prices"
    assert request["headers"]["authorization"] == f"Bearer {FAKE_KEY}"
    assert request["headers"]["stripe-version"] == stripe_client.STRIPE_VERSION
    assert request["headers"]["idempotency-key"] == "k-1"
    assert request["headers"]["content-type"] == "application/x-www-form-urlencoded"
    assert request["form"] == {
        "currency": "gbp",
        "unit_amount": "60100",
        "product_data[name]": "Invoice INV-2026-0001",
    }


def test_client_maps_errors_and_never_leaks_the_key(fake_stripe, caplog):
    client = stripe_client.get_client()
    assert FAKE_KEY not in repr(client)
    for status, kind in ((400, stripe_client.StripeRejected), (401, stripe_client.StripeRejected)):
        fake_stripe.fail = {"/v1/prices": status}
        with caplog.at_level(logging.DEBUG), pytest.raises(kind) as raised:
            client.create_price(name="x", unit_amount=1, currency="gbp", idempotency_key="k")
        assert raised.value.status == status
        assert "fake_failure" in str(raised.value)
        assert FAKE_KEY not in str(raised.value)
    for status in (429, 500, 503):
        fake_stripe.fail = {"/v1/prices": status}
        with pytest.raises(stripe_client.StripeUnavailable):
            client.create_price(name="x", unit_amount=1, currency="gbp", idempotency_key="k")
    assert FAKE_KEY not in caplog.text


def test_client_refuses_redirects(fake_stripe):
    fake_stripe.fail = {"/v1/prices": 302}
    with pytest.raises(stripe_client.StripeError):
        stripe_client.get_client().create_price(name="x", unit_amount=1, currency="gbp", idempotency_key="k")
    assert all(r["path"].startswith("/v1/") for r in fake_stripe.requests)


def test_client_unreachable_is_unavailable(settings, monkeypatch):
    settings.BILLING_STRIPE_SECRET_KEY = FAKE_KEY
    monkeypatch.setattr(
        stripe_client, "API_BASE", "http://127.0.0.1:9"
    )  # nothing listens on the discard port
    with pytest.raises(stripe_client.StripeUnavailable) as raised:
        stripe_client.get_client().create_price(name="x", unit_amount=1, currency="gbp", idempotency_key="k")
    assert FAKE_KEY not in str(raised.value)


def test_client_requires_https_or_localhost():
    with pytest.raises(ValueError):
        stripe_client.StripeClient(FAKE_KEY, base_url="http://api.stripe.example")
    with pytest.raises(stripe_client.StripeNotConfigured):
        stripe_client.StripeClient("")


def test_get_client_without_key(settings):
    settings.BILLING_STRIPE_SECRET_KEY = ""
    assert stripe_client.is_configured() is False
    with pytest.raises(stripe_client.StripeNotConfigured):
        stripe_client.get_client()


# --- Payment links ---------------------------------------------------------------------------------


def test_issue_creates_a_single_use_payment_link(owner, fake_stripe):
    invoice, note = services.issue_invoice(make_draft(owner), owner)
    assert note == ""
    assert invoice.stripe_payment_link_id.startswith("plink_")
    assert invoice.stripe_payment_link_url.startswith("https://buy.stripe.com/")
    assert invoice.stripe_payment_link_active is True
    assert invoice.stripe_payment_link_amount_pence == invoice.balance_due_pence
    price, link = fake_stripe.requests
    assert price["path"] == "/v1/prices"
    assert price["form"]["product_data[name]"] == f"Invoice {invoice.number}"
    assert price["form"]["unit_amount"] == str(invoice.balance_due_pence)
    assert price["form"]["currency"] == "gbp"
    assert link["path"] == "/v1/payment_links"
    assert link["form"]["metadata[vitalos_invoice]"] == invoice.number
    assert link["form"]["payment_intent_data[metadata][vitalos_invoice]"] == invoice.number
    assert link["form"]["after_completion[type]"] == "redirect"
    assert (
        link["form"]["after_completion[redirect][url]"]
        == f"https://vitalos.example/pay/thank-you?invoice={invoice.number}"
    )
    assert link["form"]["restrictions[completed_sessions][limit]"] == "1"
    assert link["form"]["line_items[0][quantity]"] == "1"
    assert price["headers"]["idempotency-key"] and link["headers"]["idempotency-key"]
    assert AuditEvent.objects.filter(action="billing.payment_link_created").exists()


def test_issue_survives_a_stripe_error_and_link_can_be_retried(owner, fake_stripe):
    fake_stripe.fail = {"/v1/payment_links": 500}
    invoice, note = services.issue_invoice(make_draft(owner), owner)
    assert invoice.status == InvoiceStatus.ISSUED
    assert invoice.number
    assert "not created" in note
    assert invoice.stripe_payment_link_url == ""
    fake_stripe.fail = {}
    services.create_payment_link(invoice, actor=owner)
    invoice.refresh_from_db()
    assert invoice.stripe_payment_link_active


def test_full_payment_deactivates_the_link(owner, fake_stripe):
    invoice = make_issued(owner)
    link_id = invoice.stripe_payment_link_id
    services.record_manual_payment(
        invoice=invoice,
        amount_pence=invoice.total_pence,
        method=PaymentMethod.BANK_TRANSFER,
        received_at=timezone.now(),
        actor=owner,
    )
    invoice.refresh_from_db()
    assert invoice.status == InvoiceStatus.PAID
    assert invoice.stripe_payment_link_active is False
    deactivate = fake_stripe.requests[-1]
    assert deactivate["path"] == f"/v1/payment_links/{link_id}"
    assert deactivate["form"] == {"active": "false"}


def test_partial_payment_retires_a_link_for_the_old_amount(owner, fake_stripe):
    invoice = make_issued(owner)
    services.record_manual_payment(
        invoice=invoice,
        amount_pence=100,
        method=PaymentMethod.BANK_TRANSFER,
        received_at=timezone.now(),
        actor=owner,
    )
    invoice.refresh_from_db()
    assert invoice.status == InvoiceStatus.PARTIALLY_PAID
    assert invoice.stripe_payment_link_active is False
    services.create_payment_link(invoice, actor=owner)
    invoice.refresh_from_db()
    assert invoice.stripe_payment_link_amount_pence == invoice.balance_due_pence == invoice.total_pence - 100


def test_create_link_refused_for_drafts_and_without_key(owner, settings):
    draft = make_draft(owner)
    with pytest.raises(services.BillingError):
        services.create_payment_link(draft, actor=owner)
    issued = make_issued(owner)
    settings.BILLING_STRIPE_SECRET_KEY = ""
    with pytest.raises(stripe_client.StripeNotConfigured):
        services.create_payment_link(issued, actor=owner)


# --- Webhook ---------------------------------------------------------------------------------------


def _post_event(client, event, *, secret=WEBHOOK_SECRET, timestamp=None, header=None):
    body = json.dumps(event).encode()
    signature = header or stripe_client.sign_payload(body, secret, timestamp or int(time.time()))
    return client.post(
        "/api/webhooks/stripe/", data=body, content_type="application/json", HTTP_STRIPE_SIGNATURE=signature
    )


def _event(kind, obj, event_id="evt_test_0001"):
    return {"id": event_id, "object": "event", "type": kind, "data": {"object": obj}}


def test_signature_verification():
    body = b'{"id":"evt_1"}'
    now = 1_800_000_000
    header = stripe_client.sign_payload(body, WEBHOOK_SECRET, now)
    assert stripe_client.verify_signature(body, header, WEBHOOK_SECRET, now=now)
    assert stripe_client.verify_signature(body, header + ",v1=deadbeef", WEBHOOK_SECRET, now=now)
    assert not stripe_client.verify_signature(body, header, "whsec_wrong", now=now)
    assert not stripe_client.verify_signature(body + b" ", header, WEBHOOK_SECRET, now=now)
    assert not stripe_client.verify_signature(body, header, WEBHOOK_SECRET, now=now + 301)
    assert not stripe_client.verify_signature(body, "t=abc,v1=00", WEBHOOK_SECRET, now=now)
    assert not stripe_client.verify_signature(body, "", WEBHOOK_SECRET, now=now)
    assert not stripe_client.verify_signature(body, header, "", now=now)


def test_webhook_fails_closed_without_a_secret(db, settings):
    settings.BILLING_STRIPE_WEBHOOK_SECRET = ""
    response = _post_event(Client(), _event("checkout.session.completed", {}))
    assert response.status_code == 503


def test_webhook_rejects_bad_signatures(db, settings):
    settings.BILLING_STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    client = Client()
    event = _event("checkout.session.completed", session_payload("INV-2026-0001", 100))
    assert _post_event(client, event, secret="whsec_wrong").status_code == 400
    assert _post_event(client, event, timestamp=int(time.time()) - 600).status_code == 400
    assert _post_event(client, event, header="t=1,v1=abc").status_code == 400
    assert client.get("/api/webhooks/stripe/").status_code == 405
    assert Payment.objects.count() == 0


def test_webhook_size_limit(db, settings):
    settings.BILLING_STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    big = _event("ping", {"padding": "x" * (600 * 1024)})
    assert _post_event(Client(), big).status_code == 413


def test_webhook_records_a_paid_session_once(owner, settings):
    settings.BILLING_STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    invoice = make_issued(owner)
    client = Client()
    event = _event("checkout.session.completed", session_payload(invoice.number, invoice.total_pence))
    first = _post_event(client, event)
    assert first.status_code == 200 and first.json() == {"status": "recorded"}
    replay = _post_event(client, event)
    assert replay.json() == {"status": "duplicate"}
    payment = Payment.objects.get()
    assert payment.invoice == invoice
    assert payment.method == PaymentMethod.STRIPE_CHECKOUT
    assert payment.payer_email == "payer@example-studio.example"
    invoice.refresh_from_db()
    assert invoice.status == InvoiceStatus.PAID
    assert AuditEvent.objects.filter(action="billing.payment_recorded").count() == 1


def test_webhook_payment_link_session_and_async_success(owner, settings):
    settings.BILLING_STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    invoice = make_issued(owner)
    unpaid = session_payload(invoice.number, 5000, session_id="cs_test_async_01", payment_status="unpaid")
    assert _post_event(Client(), _event("checkout.session.completed", unpaid)).json() == {"status": "ignored"}
    paid = {**unpaid, "payment_status": "paid", "payment_link": "plink_test_1"}
    response = _post_event(Client(), _event("checkout.session.async_payment_succeeded", paid, "evt_2"))
    assert response.json() == {"status": "recorded"}
    payment = Payment.objects.get()
    assert payment.method == PaymentMethod.STRIPE_PAYMENT_LINK
    invoice.refresh_from_db()
    assert invoice.status == InvoiceStatus.PARTIALLY_PAID


def test_webhook_unknown_invoice_is_kept_unmatched(db, settings):
    settings.BILLING_STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    session = session_payload("INV-2026-0999", 4200, metadata={})  # falls back to client_reference_id
    assert _post_event(Client(), _event("checkout.session.completed", session)).json() == {
        "status": "recorded"
    }
    payment = Payment.objects.get()
    assert payment.invoice is None
    assert payment.reference == "INV-2026-0999"


def test_webhook_refund_marks_payment_and_recomputes(owner, settings):
    settings.BILLING_STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    invoice = make_issued(owner)
    session = session_payload(invoice.number, invoice.total_pence)
    _post_event(Client(), _event("checkout.session.completed", session))
    charge = {
        "id": "ch_test_1",
        "object": "charge",
        "payment_intent": session["payment_intent"],
        "amount": invoice.total_pence,
        "amount_refunded": invoice.total_pence,
    }
    response = _post_event(Client(), _event("charge.refunded", charge, "evt_r1"))
    assert response.json() == {"status": "refunded"}
    payment = Payment.objects.get()
    assert payment.status == "refunded"
    invoice.refresh_from_db()
    assert invoice.status == InvoiceStatus.ISSUED
    assert invoice.balance_due_pence == invoice.total_pence
    # Replaying the refund changes nothing.
    _post_event(Client(), _event("charge.refunded", charge, "evt_r1"))
    assert AuditEvent.objects.filter(action="billing.payment_refunded").count() == 1


def test_webhook_ignores_unknown_events(db, settings):
    settings.BILLING_STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    response = _post_event(Client(), _event("customer.created", {"id": "cus_1"}))
    assert response.status_code == 200 and response.json() == {"status": "ignored"}


def test_webhook_never_logs_bodies(owner, settings, caplog):
    settings.BILLING_STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    invoice = make_issued(owner)
    with caplog.at_level(logging.DEBUG):
        _post_event(Client(), _event("checkout.session.completed", session_payload(invoice.number, 100)))
    assert "payer@example-studio.example" not in caplog.text


# --- Sync ------------------------------------------------------------------------------------------


def test_sync_records_sessions_idempotently_across_pages(owner, fake_stripe):
    invoice = make_issued(owner)
    fake_stripe.requests.clear()
    fake_stripe.sessions = [
        session_payload(invoice.number, 1000, session_id=f"cs_test_s{i:03d}") for i in range(3)
    ]
    fake_stripe.sessions.append({**session_payload("", 500, session_id="cs_test_other"), "metadata": {}})
    result = services.sync_from_stripe(actor=owner)
    assert (result.seen, result.recorded) == (3, 3)
    listing = fake_stripe.requests[0]
    assert listing["method"] == "GET"
    assert listing["form"]["status"] == "complete"
    assert "created[gte]" in listing["form"]
    again = services.sync_from_stripe(actor=owner)
    assert again.recorded == 0
    assert Payment.objects.count() == 3
    invoice.refresh_from_db()
    assert invoice.amount_paid_pence == 3000
    assert BillingSettings.load().last_stripe_sync_at is not None


def test_sync_pages_are_bounded(owner, fake_stripe, monkeypatch):
    invoice = make_issued(owner)
    fake_stripe.sessions = [
        session_payload(invoice.number, 1, session_id=f"cs_test_p{i:03d}") for i in range(5)
    ]
    original = stripe_client.StripeClient.list_checkout_sessions

    def small_pages(self, **kwargs):
        return original(self, **{**kwargs, "limit": 2})

    monkeypatch.setattr(stripe_client.StripeClient, "list_checkout_sessions", small_pages)
    result = services.sync_from_stripe(max_pages=2)
    assert result.pages == 2 and result.recorded == 4


def test_tick_sync_runs_at_most_every_ten_minutes_and_never_raises(owner, fake_stripe, settings):
    now = timezone.now()
    services.tick_sync(now)
    calls = len(fake_stripe.requests)
    assert calls == 1
    services.tick_sync(now + timedelta(minutes=5))
    assert len(fake_stripe.requests) == calls
    services.tick_sync(now + timedelta(minutes=11))
    assert len(fake_stripe.requests) == calls + 1
    fake_stripe.fail = {"/v1/checkout/sessions": 500}
    assert services.tick_sync(now + timedelta(minutes=30)) == 0
    settings.BILLING_STRIPE_SECRET_KEY = ""
    assert services.tick_sync(now + timedelta(hours=2)) == 0


def test_content_tick_calls_billing_sync(owner, monkeypatch):
    from apps.content_sync import tick

    called = []
    monkeypatch.setattr(services, "tick_sync", lambda now=None: called.append(now) or 0)
    tick.run()
    assert len(called) == 1

    def boom(now=None):
        raise RuntimeError("billing broke")

    monkeypatch.setattr(services, "tick_sync", boom)
    tick.run()  # never fails the tick


def test_sync_command(owner, fake_stripe):
    import io

    from django.core.management import call_command
    from django.core.management.base import CommandError

    invoice = make_issued(owner)
    fake_stripe.sessions = [session_payload(invoice.number, invoice.total_pence)]
    out = io.StringIO()
    call_command("billing_sync_stripe", "--days", "7", stdout=out)
    assert "recorded 1 new payment" in out.getvalue()
    with pytest.raises(CommandError):
        call_command("billing_sync_stripe", "--days", "0")
