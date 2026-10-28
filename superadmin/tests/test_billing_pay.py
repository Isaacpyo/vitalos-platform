"""The public /pay/checkout/ endpoint the vitalos.co.uk/pay form posts to. Fictional data, fake Stripe."""

from urllib.parse import parse_qs, urlsplit

import pytest
from django.core.cache import cache
from django.test import Client
from django.utils import timezone

from apps.accounts.roles import SUPERADMIN
from apps.billing import public, services
from apps.billing.models import Invoice, PaymentMethod
from tests.billing_helpers import make_draft, make_issued

SITE = "https://vitalos.example"


@pytest.fixture(autouse=True)
def fresh_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(make_user):
    return make_user(SUPERADMIN, email="owner-pay@example.test")


@pytest.fixture
def invoice(owner, fake_stripe):
    item = make_issued(owner)
    fake_stripe.requests.clear()
    return item


def _post(data, **extra):
    return Client(enforce_csrf_checks=True).post("/pay/checkout/", data, **extra)


def _error(response):
    assert response.status_code == 303
    location = response["Location"]
    parts = urlsplit(location)
    assert f"{parts.scheme}://{parts.netloc}{parts.path}" == f"{SITE}/pay"
    return parse_qs(parts.query)


def test_success_redirects_303_to_stripe_checkout(invoice, fake_stripe):
    code = invoice.payment_code_display.lower()  # case and hyphen insensitive
    response = _post({"invoice": invoice.number.lower(), "code": code})
    assert response.status_code == 303
    assert response["Location"] == fake_stripe.checkout_url
    request = fake_stripe.requests[-1]
    assert request["path"] == "/v1/checkout/sessions"
    form = request["form"]
    assert form["mode"] == "payment"
    assert form["line_items[0][price_data][currency]"] == "gbp"
    assert form["line_items[0][price_data][unit_amount]"] == str(invoice.balance_due_pence)
    assert form["line_items[0][price_data][product_data][name]"] == f"Invoice {invoice.number}"
    assert form["metadata[vitalos_invoice]"] == invoice.number
    assert form["payment_intent_data[metadata][vitalos_invoice]"] == invoice.number
    assert form["client_reference_id"] == invoice.number
    assert form["customer_email"] == invoice.bill_to_email
    assert form["success_url"] == f"{SITE}/pay/thank-you?invoice={invoice.number}"
    assert form["cancel_url"] == f"{SITE}/pay?invoice={invoice.number}&cancelled=1"
    assert request["headers"]["idempotency-key"].startswith("vitalos-billing-checkout-")


def test_code_with_spaces_and_turnstile_token_alias(invoice, fake_stripe, settings, monkeypatch):
    settings.TURNSTILE_SECRET_KEY = "turnstile-test-secret"
    seen = []
    monkeypatch.setattr(public, "_turnstile_ok", lambda token, ip: seen.append(token) or token == "good")
    code = f"{invoice.payment_code[:4]} {invoice.payment_code[4:]}"
    response = _post({"invoice": invoice.number, "code": code, "turnstileToken": "good"})
    assert response["Location"] == fake_stripe.checkout_url
    response = _post({"invoice": invoice.number, "code": code, "cf-turnstile-response": "bad"})
    assert _error(response) == {"invoice": [invoice.number], "error": ["verification"]}
    assert seen == ["good", "bad"]


@pytest.mark.parametrize("case", ["unknown", "wrong-code", "draft", "void", "blank"])
def test_not_found_is_one_generic_code(case, owner, invoice, fake_stripe):
    number, code = invoice.number, invoice.payment_code
    if case == "unknown":
        number = "INV-2026-9999"
    elif case == "wrong-code":
        code = "ZZZZZZZZ" if code != "ZZZZZZZZ" else "YYYYYYYY"
    elif case == "draft":
        draft = make_draft(owner)
        number = f"draft-{draft.pk}"
    elif case == "void":
        services.void_invoice(invoice, "Raised by mistake", owner)
    elif case == "blank":
        number, code = "", ""
    response = _post({"invoice": number, "code": code})
    query = _error(response)
    assert query["error"] == ["not-found"]
    assert not code or code not in response["Location"]  # never echo the code
    assert not any(r["path"] == "/v1/checkout/sessions" for r in fake_stripe.requests)


def test_paid_invoice(owner, invoice):
    services.record_manual_payment(
        invoice=invoice,
        amount_pence=invoice.total_pence,
        method=PaymentMethod.BANK_TRANSFER,
        received_at=timezone.now(),
        actor=owner,
    )
    response = _post({"invoice": invoice.number, "code": invoice.payment_code})
    assert _error(response) == {"invoice": [invoice.number], "error": ["paid"]}


def test_unavailable_without_key_or_on_stripe_error(invoice, fake_stripe, settings):
    fake_stripe.fail = {"/v1/checkout/sessions": 500}
    response = _post({"invoice": invoice.number, "code": invoice.payment_code})
    assert _error(response)["error"] == ["unavailable"]
    settings.BILLING_STRIPE_SECRET_KEY = ""
    response = _post({"invoice": invoice.number, "code": invoice.payment_code})
    assert _error(response)["error"] == ["unavailable"]


def test_no_open_redirect_from_a_bad_session_url(invoice, fake_stripe):
    for url in (
        "https://evil.example/pay",
        "http://checkout.stripe.com/c/x",
        "https://checkout.stripe.com.evil.example/",
    ):
        fake_stripe.checkout_url = url
        cache.clear()
        response = _post({"invoice": invoice.number, "code": invoice.payment_code})
        assert _error(response)["error"] == ["unavailable"]


def test_invoice_parameter_is_never_reflected_unless_it_is_a_number(db):
    response = _post({"invoice": "https://evil.example/<script>", "code": "x"})
    assert _error(response) == {"error": ["not-found"]}


def test_honeypot_redirects_as_not_found_and_stores_nothing(invoice, fake_stripe):
    response = _post(
        {"invoice": invoice.number, "code": invoice.payment_code, "website": "https://spam.example"}
    )
    assert _error(response)["error"] == ["not-found"]
    assert fake_stripe.requests == []


def test_rate_limit_per_ip(invoice):
    for _ in range(services.IP_LIMIT[0]):
        _post({"invoice": invoice.number, "code": "ZZZZZZZZ"})
    response = _post({"invoice": invoice.number, "code": invoice.payment_code})
    assert _error(response)["error"] == ["rate-limited"]


def test_rate_limit_per_invoice_across_ips(invoice):
    for i in range(services.INVOICE_LIMIT[0]):
        _post({"invoice": invoice.number, "code": "ZZZZZZZZ"}, REMOTE_ADDR=f"192.0.2.{i + 1}")
    response = _post({"invoice": invoice.number, "code": invoice.payment_code}, REMOTE_ADDR="198.51.100.7")
    assert _error(response)["error"] == ["rate-limited"]


def test_post_only_and_no_csrf_needed(db):
    assert Client().get("/pay/checkout/").status_code == 405
    response = Client(enforce_csrf_checks=True).post(
        "/pay/checkout/", {"invoice": "INV-2026-0001", "code": "x"}
    )
    assert response.status_code == 303


def test_nothing_is_stored_on_refusals(invoice):
    before = Invoice.objects.count()
    _post({"invoice": invoice.number, "code": "ZZZZZZZZ"})
    assert Invoice.objects.count() == before
