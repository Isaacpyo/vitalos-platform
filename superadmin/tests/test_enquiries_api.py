"""Website form and Resend webhook endpoints, and Svix signature verification."""

import base64
import io
import json
import secrets
import time
from pathlib import Path
from unittest import mock

import pytest

from apps.enquiries import providers
from apps.enquiries.models import Enquiry, EnquiryNote, Message

SECRET = "test-inbound-secret-0123456789"
FORM_URL = "/api/inbound/web-form"
RESEND_URL = "/api/webhooks/resend"
FIXTURES = Path(__file__).parent / "fixtures" / "eml"


def svix_secret() -> str:
    return "whsec_" + base64.b64encode(secrets.token_bytes(24)).decode()


# --- Svix ---------------------------------------------------------------------------------------


def test_svix_verification_with_a_generated_secret():
    secret = svix_secret()
    body = b'{"type":"email.delivered"}'
    ts = str(int(time.time()))
    signature = providers.svix_signature(secret, "msg_1", ts, body)
    assert providers.verify_svix(secret, "msg_1", ts, f"v1,{signature}", body)
    assert providers.verify_svix(secret, "msg_1", ts, f"v1,bm90LXRoaXM= v1,{signature}", body)
    assert not providers.verify_svix(secret, "msg_1", ts, f"v1,{signature}", body + b" ")
    assert not providers.verify_svix(secret, "msg_2", ts, f"v1,{signature}", body)
    assert not providers.verify_svix(secret, "msg_1", ts, f"v2,{signature}", body)
    assert not providers.verify_svix(svix_secret(), "msg_1", ts, f"v1,{signature}", body)
    old = str(int(time.time()) - 301)
    stale = providers.svix_signature(secret, "msg_1", old, body)
    assert not providers.verify_svix(secret, "msg_1", old, f"v1,{stale}", body)
    assert not providers.verify_svix("", "msg_1", ts, f"v1,{signature}", body)
    assert not providers.verify_svix("whsec_!!!notbase64", "msg_1", ts, f"v1,{signature}", body)


# --- Web form -----------------------------------------------------------------------------------


@pytest.fixture
def form(client, settings, db):
    settings.INBOUND_WEBHOOK_SECRET = SECRET
    settings.TURNSTILE_SECRET_KEY = ""

    def _post(payload: dict, *, secret=SECRET, ts=None):
        body = json.dumps(payload).encode()
        ts = str(int(time.time()) if ts is None else ts)
        return client.post(
            FORM_URL,
            data=body,
            content_type="application/json",
            HTTP_X_VITALOS_TIMESTAMP=ts,
            HTTP_X_VITALOS_SIGNATURE=providers.sign(secret, ts, body),
        )

    return _post


VALID = {"name": "Sam Lee", "email": "sam@example.com", "company": "Acme", "message": "We need help."}


def test_web_form_creates_an_enquiry(form):
    response = form(VALID)
    assert response.status_code == 201
    assert response.json() == {"ref": "VIT-0001"}
    enquiry = Enquiry.objects.get()
    assert enquiry.source == Enquiry.Source.WEB_FORM
    assert enquiry.subject == "Website enquiry from Sam Lee (Acme)"
    message = enquiry.messages.get()
    assert message.provider == Message.Provider.WEB_FORM
    assert message.text_body == "We need help."
    assert message.message_id_header.startswith("<webform-")


def test_web_form_honeypot_stores_nothing(form):
    response = form({**VALID, "website": "http://spam.example"})
    assert response.status_code == 200
    assert not Enquiry.objects.exists()


def test_web_form_rate_limit(form):
    statuses = [form(VALID).status_code for _ in range(6)]
    assert statuses == [201, 201, 201, 201, 201, 200]
    assert Enquiry.objects.count() == 5


def test_web_form_signature_is_required(form):
    assert form(VALID, secret="wrong").status_code == 401
    assert form(VALID, ts=int(time.time()) - 1000).status_code == 401
    assert not Enquiry.objects.exists()


def test_web_form_fails_closed_without_a_secret(form, settings):
    settings.INBOUND_WEBHOOK_SECRET = ""
    assert form(VALID, secret="x").status_code == 503


def test_web_form_validation(form):
    assert form({**VALID, "message": "x" * 5001}).status_code == 400
    assert form({**VALID, "email": "not-an-email"}).status_code == 400
    assert form({**VALID, "message": ""}).status_code == 400
    assert not Enquiry.objects.exists()


def test_web_form_turnstile_when_configured(form, settings):
    settings.TURNSTILE_SECRET_KEY = "turnstile-test-secret"
    failing = io.BytesIO(b'{"success": false}')
    with mock.patch("apps.enquiries.api.urllib.request.urlopen") as urlopen:
        urlopen.return_value.__enter__.return_value = failing
        assert form({**VALID, "turnstile_token": "bad"}).status_code == 400
        urlopen.return_value.__enter__.return_value = io.BytesIO(b'{"success": true}')
        assert form({**VALID, "turnstile_token": "good"}).status_code == 201
    assert form({**VALID, "turnstile_token": ""}).status_code == 400


# --- Resend webhook -----------------------------------------------------------------------------


@pytest.fixture
def resend(client, settings, db):
    secret = svix_secret()
    settings.RESEND_WEBHOOK_SECRET = secret
    settings.INBOUND_PROVIDER = "cloudflare"

    def _post(payload: dict, *, sign=True):
        body = json.dumps(payload).encode()
        ts = str(int(time.time()))
        signature = providers.svix_signature(secret, "msg_abc", ts, body) if sign else "AAAA"
        return client.post(
            RESEND_URL,
            data=body,
            content_type="application/json",
            HTTP_SVIX_ID="msg_abc",
            HTTP_SVIX_TIMESTAMP=ts,
            HTTP_SVIX_SIGNATURE=f"v1,{signature}",
        )

    return _post


def _outbound(provider_id="re_123") -> Message:
    from apps.enquiries import services

    enquiry = services.create_enquiry(
        subject="Hi",
        from_name="",
        from_email="jane@customer.example",
        to_email="",
        source="email",
        snippet="",
    )
    return Message.objects.create(
        enquiry=enquiry,
        direction=Message.Direction.OUTBOUND,
        message_id_header="<out-1@vitalos.co.uk>",
        from_email="support@vitalos.co.uk",
        provider=Message.Provider.RESEND,
        provider_message_id=provider_id,
        delivery_status="sent",
    )


def test_resend_delivery_events_update_the_message(resend):
    message = _outbound()
    assert resend({"type": "email.delivered", "data": {"email_id": "re_123"}}).status_code == 200
    message.refresh_from_db()
    assert message.delivery_status == "delivered"
    resend({"type": "email.bounced", "data": {"email_id": "re_123"}})
    resend({"type": "email.bounced", "data": {"email_id": "re_123"}})
    message.refresh_from_db()
    assert message.delivery_status == "bounced"
    assert EnquiryNote.objects.filter(enquiry=message.enquiry, is_system=True).count() == 1


def test_resend_webhook_requires_a_valid_signature(resend, settings, client):
    message = _outbound()
    assert resend({"type": "email.delivered", "data": {"email_id": "re_123"}}, sign=False).status_code == 401
    message.refresh_from_db()
    assert message.delivery_status == "sent"
    settings.RESEND_WEBHOOK_SECRET = ""
    assert resend({"type": "email.delivered", "data": {"email_id": "re_123"}}).status_code == 503


def test_resend_received_is_ignored_unless_resend_is_the_inbound_provider(resend, settings):
    raw = (FIXTURES / "plain.eml").read_bytes()
    with mock.patch.object(providers.ResendInbound, "fetch_raw", return_value=raw) as fetch:
        response = resend({"type": "email.received", "data": {"email_id": "abc-123"}})
        assert response.json() == {"status": "ignored"}
        assert not fetch.called
        settings.INBOUND_PROVIDER = "resend"
        response = resend({"type": "email.received", "data": {"email_id": "abc-123"}})
    assert response.json() == {"status": "stored", "ref": "VIT-0001"}
    fetch.assert_called_once_with("abc-123")
    assert Message.objects.get().provider == "resend"


def test_resend_fetch_raw_uses_the_receiving_api(settings):
    settings.RESEND_API_KEY = "re_test_key"
    calls = []

    def fake_urlopen(request, timeout):
        calls.append(request)
        payload = (
            json.dumps({"raw": {"download_url": "https://files.resend.example/raw/abc"}}).encode()
            if len(calls) == 1
            else b"raw mime"
        )
        response = mock.MagicMock()
        response.__enter__.return_value = io.BytesIO(payload)
        return response

    with mock.patch("apps.enquiries.providers.urllib.request.urlopen", side_effect=fake_urlopen):
        assert providers.ResendInbound().fetch_raw("abc-123") == b"raw mime"
    assert calls[0].full_url == "https://api.resend.com/emails/receiving/abc-123"
    assert calls[0].get_header("Authorization") == "Bearer re_test_key"
    assert calls[0].get_header("User-agent")
    assert calls[1].full_url == "https://files.resend.example/raw/abc"
    assert calls[1].get_header("Authorization") is None
    with pytest.raises(ValueError):
        providers.ResendInbound().fetch_raw("../../etc")


def test_microsoft_graph_is_a_stub():
    with pytest.raises(NotImplementedError):
        providers.MicrosoftGraphProvider().send(None)
