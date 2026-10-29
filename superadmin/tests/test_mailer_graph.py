"""The outreach mailbox over Microsoft Graph (ADR-051, DECISIONS 127): sign-in, send, retry and errors."""

import base64
import email
import io
import json
import re
import urllib.error
import urllib.parse
from datetime import datetime
from email import policy
from zoneinfo import ZoneInfo

import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command

from apps.accounts.roles import SUPERADMIN
from apps.email_templates import services as template_services
from apps.mailer import backends
from apps.mailer.layout import render_email
from apps.mailer.messages import build_message
from apps.outreach import services as outreach_services
from apps.outreach.models import Contact

SECRET = "graph-secret-not-real"
TENANT = "11111111-2222-3333-4444-555555555555"
MAILBOX = "temitope.agbola@vitalos.co.uk"


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()


@pytest.fixture
def graph(settings):
    settings.OUTREACH_MAILBOX = MAILBOX
    settings.OUTREACH_GRAPH_TENANT_ID = TENANT
    settings.OUTREACH_GRAPH_CLIENT_ID = "app-client-id"
    settings.OUTREACH_GRAPH_CLIENT_SECRET = SECRET
    settings.OUTREACH_SMTP_HOST = ""
    return settings


class FakeMicrosoft:
    """Stands in for login.microsoftonline.com and graph.microsoft.com; records every request."""

    def __init__(self, send_statuses=(202,), token_status=200):
        self.requests = []
        self.send_statuses = list(send_statuses)
        self.token_status = token_status
        self.tokens = 0

    def __call__(self, request, timeout=None):
        self.requests.append(request)
        if "login.microsoftonline.com" in request.full_url:
            self.tokens += 1
            if self.token_status != 200:
                return self._error(request, self.token_status, {"error": "invalid_client"})
            return self._ok(200, {"access_token": f"token-{self.tokens}", "expires_in": 3599})
        status = self.send_statuses.pop(0) if self.send_statuses else 202
        if status != 202:
            return self._error(request, status, {"error": {"code": "ErrorAccessDenied"}})
        return self._ok(202, b"")

    @staticmethod
    def _ok(status, body):
        class Response(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        response = Response(body if isinstance(body, bytes) else json.dumps(body).encode())
        response.status = status
        return response

    @staticmethod
    def _error(request, status, body):
        raise urllib.error.HTTPError(
            request.full_url, status, "error", {}, io.BytesIO(json.dumps(body).encode())
        )

    @property
    def sends(self):
        return [r for r in self.requests if "graph.microsoft.com" in r.full_url]


@pytest.fixture
def microsoft(monkeypatch):
    fake = FakeMicrosoft()
    monkeypatch.setattr(backends.urllib.request, "urlopen", fake)
    return fake


def _message(to="ada@example.test"):
    rendered = render_email({"title": "Hello", "blocks": [{"type": "text", "text": "Hi Ada,"}], "footer": {}})
    return build_message(
        rendered,
        subject="A free one-page plan for your business",
        to=[to],
        from_email=f"Temitope Agbola <{MAILBOX}>",
        reply_to=[MAILBOX],
        headers={"List-Unsubscribe": "<https://admin.vitalos.co.uk/mail/unsubscribe/x/>"},
    )


# --- Choosing the transport --------------------------------------------------------------------------


def test_graph_is_preferred_then_smtp_then_nothing(settings, graph):
    assert isinstance(backends.outreach_connection(), backends.GraphEmailBackend)
    assert backends.outreach_mailbox() == MAILBOX
    settings.OUTREACH_GRAPH_CLIENT_SECRET = ""
    settings.OUTREACH_SMTP_HOST, settings.OUTREACH_SMTP_USER = "smtp.example.test", "smtp@vitalos.co.uk"
    assert type(backends.outreach_connection()).__name__ == "EmailBackend"
    settings.OUTREACH_SMTP_HOST = ""
    assert backends.outreach_connection() is None


def test_graph_needs_the_mailbox_too(settings, graph):
    settings.OUTREACH_MAILBOX = ""
    assert backends.outreach_connection() is None


# --- Sending -----------------------------------------------------------------------------------------


def test_signs_in_with_client_credentials_and_sends_mime(graph, microsoft):
    assert backends.outreach_connection().send_messages([_message()]) == 1
    sign_in, send = microsoft.requests
    assert sign_in.full_url == f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
    form = urllib.parse.parse_qs(sign_in.data.decode())
    assert form["grant_type"] == ["client_credentials"] and form["client_id"] == ["app-client-id"]
    assert form["scope"] == ["https://graph.microsoft.com/.default"] and form["client_secret"] == [SECRET]
    assert send.full_url == f"https://graph.microsoft.com/v1.0/users/{MAILBOX}/sendMail"
    assert send.get_header("Authorization") == "Bearer token-1"
    assert send.get_header("Content-type") == "text/plain"
    mime = email.message_from_bytes(base64.b64decode(send.data), policy=policy.default)
    assert mime["From"] == f"Temitope Agbola <{MAILBOX}>" and mime["To"] == "ada@example.test"
    assert mime["Subject"] == "A free one-page plan for your business"
    assert mime["List-Unsubscribe"] == "<https://admin.vitalos.co.uk/mail/unsubscribe/x/>"
    assert "Hi Ada," in mime.get_body(("plain",)).get_content()


def test_the_mime_uses_crlf_so_graph_decodes_the_body_exactly(graph, microsoft):
    # Long lines force quoted-printable soft line breaks. With bare LF ("=\n") Graph dropped a character at
    # every wrap and mangled entities such as &#847; in the first live send (29 Oct 2026).
    line = "I am getting in touch about technology, and an easy way to start with it. "
    rendered = render_email(
        {
            "title": "Hello",
            "preheader": "A free one-page plan for your business",
            "blocks": [{"type": "text", "text": "Hi Ada, " + line * 8}],
            "footer": {},
        }
    )
    assert "&#847;" in rendered.html and rendered.inline_images
    message = build_message(
        rendered,
        subject="A free one-page plan for your business",
        to=["ada@example.test"],
        from_email=f"Temitope Agbola <{MAILBOX}>",
        headers={"List-Unsubscribe": "<https://admin.vitalos.co.uk/mail/unsubscribe/x/>"},
    )
    backends.outreach_connection().send_messages([message])
    raw = base64.b64decode(microsoft.sends[0].data)
    assert re.search(rb"(?<!\r)\n", raw) is None and re.search(rb"\r(?!\n)", raw) is None
    assert b"=\r\n" in raw  # the soft line breaks Graph misread, now in canonical form
    mime = email.message_from_bytes(raw, policy=policy.default)
    # CRLF is the canonical form of a line break in a text part, so it decodes back to the original text
    # (a MIME text part always ends with a line break, added when the message is built).
    assert mime.get_body(("html",)).get_content().replace("\r\n", "\n") == rendered.html
    assert mime.get_body(("plain",)).get_content().replace("\r\n", "\n") == rendered.text.rstrip("\n") + "\n"
    [image] = [part for part in mime.walk() if part.get_content_maintype() == "image"]
    expected = rendered.inline_images[0]
    assert image["Content-ID"] == f"<{expected['contentId']}>"
    assert image.get_content() == base64.b64decode(expected["base64"])
    assert mime["List-Unsubscribe"] == "<https://admin.vitalos.co.uk/mail/unsubscribe/x/>"
    assert mime["Message-ID"]


def test_the_token_is_reused_until_it_expires(graph, microsoft):
    connection = backends.outreach_connection()
    connection.send_messages([_message()])
    backends.outreach_connection().send_messages([_message("grace@example.test")])
    assert microsoft.tokens == 1 and len(microsoft.sends) == 2


def test_an_expired_token_is_renewed_once(graph, monkeypatch):
    fake = FakeMicrosoft(send_statuses=(401, 202))
    monkeypatch.setattr(backends.urllib.request, "urlopen", fake)
    assert backends.outreach_connection().send_messages([_message()]) == 1
    assert fake.tokens == 2 and [s.get_header("Authorization") for s in fake.sends] == [
        "Bearer token-1",
        "Bearer token-2",
    ]


def test_a_refused_send_raises_without_the_secret(graph, monkeypatch):
    monkeypatch.setattr(backends.urllib.request, "urlopen", FakeMicrosoft(send_statuses=(403,)))
    with pytest.raises(backends.GraphError, match="403 ErrorAccessDenied") as exc:
        backends.outreach_connection().send_messages([_message()])
    assert SECRET not in str(exc.value)


def test_a_refused_sign_in_raises_and_sends_nothing(graph, monkeypatch):
    fake = FakeMicrosoft(token_status=401)
    monkeypatch.setattr(backends.urllib.request, "urlopen", fake)
    with pytest.raises(backends.GraphError, match="sign-in refused") as exc:
        backends.outreach_connection().send_messages([_message()])
    assert SECRET not in str(exc.value) and fake.sends == []


# --- Through the admin -------------------------------------------------------------------------------


@pytest.fixture
def owner(make_user):
    return make_user(SUPERADMIN, email="owner@vitalos.co.uk", full_name="Temitope Agbola")


@pytest.fixture
def library(db, seeded):
    call_command("seed_email_templates", stdout=io.StringIO())


def test_the_outreach_queue_sends_through_microsoft(graph, microsoft, owner, library, settings):
    settings.EMAIL_TRANSPORT = "resend"
    csv = "Business,Contact name,Email,Entity type,Status\nAllen Ltd,Helen Allen (director),helen@allen.test,LLP,New\n"
    outreach_services.import_contacts(SimpleUploadedFile("leads.csv", csv.encode()), user=owner)
    assert outreach_services.start_problems(outreach_services.load_settings()) == []
    outreach_services.start(user=owner)
    assert outreach_services.send_due(datetime(2026, 10, 28, 10, 0, tzinfo=ZoneInfo("Europe/London"))) == 1
    [send] = microsoft.sends
    mime = email.message_from_bytes(base64.b64decode(send.data), policy=policy.default)
    assert mime["From"] == f"Temitope Agbola <{MAILBOX}>" and mime["Reply-To"] == MAILBOX
    assert (
        "Hi Helen," in mime.get_body(("plain",)).get_content()
        and "/mail/unsubscribe/" in mime["List-Unsubscribe"]
    )
    assert Contact.objects.get().status == "sent"


def test_use_template_send_goes_from_the_microsoft_mailbox(graph, microsoft, owner, library, settings):
    settings.EMAIL_TRANSPORT = "resend"
    template = template_services.EmailTemplate.objects.get(key="outreach-small-business-free-plan")
    assert template_services.send_unavailable(template) == ""
    assert template_services.send_from(template, owner) == MAILBOX
    assert template_services.send_use(template, user=owner, values={}, recipient="ada@example.test") is True
    mime = email.message_from_bytes(base64.b64decode(microsoft.sends[0].data), policy=policy.default)
    assert (
        mime["From"] == f"Temitope Agbola <{MAILBOX}>"
        and "Hi there," in mime.get_body(("plain",)).get_content()
    )
