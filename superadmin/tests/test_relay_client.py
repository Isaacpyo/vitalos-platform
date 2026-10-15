"""Relay admin API client: signing (golden vectors), request shape, error mapping and the factory."""

import base64
import hashlib
import hmac
import io
import json
import urllib.error
from unittest import mock

import pytest

from apps.relay import signing
from apps.relay.client import (
    HttpRelayClient,
    RelayError,
    admin_identity,
    encode_admin,
    get_client,
    is_configured,
    user_id_from_admin_id,
)
from apps.relay.fake import ALEX, FakeRelayClient

SECRET = "relay-test-secret"
TS = 1760536800


def independent_signature(secret: str, ts: str, method: str, path: str, admin: str, body: bytes) -> str:
    """The canonical string, built here from API.md without the app's helpers."""
    canonical = f"{ts}\n{method}\n{path}\n{admin}\n{hashlib.sha256(body).hexdigest()}"
    return "v1=" + hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()


def test_golden_vector_get_without_admin_or_body():
    canonical = signing.canonical(str(TS), "GET", "/api/relay/admin/inbox?tab=needs", "", b"")
    assert canonical == (
        "1760536800\nGET\n/api/relay/admin/inbox?tab=needs\n\n"
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
    expected = "v1=48ac301ebc0c3f49750dc87b280c4add3cfda52bd184865af97023d93f035a2f"
    assert signing.sign(SECRET, canonical) == expected
    assert (
        independent_signature(SECRET, str(TS), "GET", "/api/relay/admin/inbox?tab=needs", "", b"") == expected
    )


def test_golden_vector_post_with_admin_and_body():
    path = f"/api/relay/admin/conversations/{ALEX}/note"
    admin = "eyJpZCI6InNhOjEyIn0"  # base64url('{"id":"sa:12"}'), no padding
    body = b'{"text":"Hello"}'
    expected = "v1=0465c97ec03470616067d9652dc8f8659d22cc9f8a338609a0eaf5355ecd166a"
    assert signing.sign(SECRET, signing.canonical(str(TS), "POST", path, admin, body)) == expected
    assert independent_signature(SECRET, str(TS), "POST", path, admin, body) == expected


def test_verify_accepts_good_and_rejects_bad_or_stale():
    body = b'{"id":"x"}'
    good = independent_signature(SECRET, str(TS), "POST", "/api/inbound/relay", "", body)
    common = {"method": "POST", "path_with_query": "/api/inbound/relay", "admin_header": "", "body": body}
    assert signing.verify(SECRET, timestamp=str(TS), signature=good, now=TS + 10, **common) is None
    assert signing.verify(SECRET, timestamp=str(TS), signature=good, now=TS + 301, **common) == "stale"
    assert (
        signing.verify(SECRET, timestamp=str(TS), signature=good + "0", now=TS, **common) == "bad_signature"
    )
    assert signing.verify("other", timestamp=str(TS), signature=good, now=TS, **common) == "bad_signature"
    assert signing.verify(SECRET, timestamp="soon", signature=good, now=TS, **common) == "bad_signature"
    assert signing.verify("", timestamp=str(TS), signature=good, now=TS, **common) == "bad_signature"
    # A non-ASCII header is a rejection, not a TypeError (500).
    junk = "v1=" + "é" * 64
    assert signing.verify(SECRET, timestamp=str(TS), signature=junk, now=TS, **common) == "bad_signature"


def test_admin_identity_header(superadmin, lead):
    superadmin.full_name = "Sam Taylor"
    identity = admin_identity(superadmin)
    assert identity == {
        "id": f"sa:{superadmin.pk}",
        "name": "Sam Taylor",
        "initials": "ST",
        "email": "admin@example.test",
        "role": "SuperAdmin",
    }
    assert admin_identity(lead)["role"] == "ServiceLead"
    header = encode_admin(identity)
    assert "=" not in header
    decoded = json.loads(base64.urlsafe_b64decode(header + "=" * (-len(header) % 4)))
    assert decoded == identity
    assert user_id_from_admin_id(f"sa:{superadmin.pk}") == superadmin.pk
    assert user_id_from_admin_id("sa:abc") is None and user_id_from_admin_id("12") is None


def test_request_is_signed_exactly_as_sent(superadmin):
    client = HttpRelayClient("https://www.example.com", SECRET, admin_identity(superadmin))
    request = client.build_request(
        "GET", "/inbox", {"tab": "needs", "q": "alex morgan", "cursor": ""}, now=TS
    )
    assert request.full_url == "https://www.example.com/api/relay/admin/inbox?tab=needs&q=alex+morgan"
    headers = {key.lower(): value for key, value in request.header_items()}
    assert headers["x-relay-timestamp"] == str(TS)
    expected = independent_signature(
        SECRET,
        str(TS),
        "GET",
        "/api/relay/admin/inbox?tab=needs&q=alex+morgan",
        headers["x-relay-admin"],
        b"",
    )
    assert headers["x-relay-signature"] == expected
    assert request.data is None

    post = client.build_request("POST", f"/conversations/{ALEX}/note", body={"text": "Hello"}, now=TS)
    post_headers = {key.lower(): value for key, value in post.header_items()}
    assert post.data == b'{"text":"Hello"}'
    assert post_headers["content-type"] == "application/json"
    assert post_headers["x-relay-signature"] == independent_signature(
        SECRET,
        str(TS),
        "POST",
        f"/api/relay/admin/conversations/{ALEX}/note",
        post_headers["x-relay-admin"],
        post.data,
    )


def test_webhook_style_request_has_no_admin_header():
    request = HttpRelayClient("https://www.example.com", SECRET).build_request("GET", "/settings", now=TS)
    assert "X-relay-admin" not in dict(request.header_items())


def test_not_configured_without_base_url_or_secret():
    with pytest.raises(RelayError) as error:
        HttpRelayClient("", SECRET).inbox()
    assert error.value.code == "not_configured"
    with pytest.raises(RelayError):
        HttpRelayClient("https://www.example.com", "").inbox()


class _Response(io.BytesIO):
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_success_returns_data_and_uses_an_8_second_timeout():
    client = HttpRelayClient("https://www.example.com", SECRET)
    with mock.patch(
        "urllib.request.urlopen", return_value=_Response(b'{"data":{"counts":{"needs":2}}}')
    ) as opened:
        assert client.inbox() == {"counts": {"needs": 2}}
    assert opened.call_args.kwargs["timeout"] == 8


def test_api_errors_map_to_relay_error_without_logging_bodies(caplog):
    client = HttpRelayClient("https://www.example.com", SECRET)
    body = io.BytesIO(b'{"error":{"code":"conflict","message":"secret visitor words"}}')
    error = urllib.error.HTTPError("https://www.example.com/x", 409, "Conflict", {}, body)
    with mock.patch("urllib.request.urlopen", side_effect=error), pytest.raises(RelayError) as raised:
        client.join(ALEX)
    assert raised.value.code == "conflict" and raised.value.status == 409
    assert "secret visitor words" not in caplog.text
    with (
        mock.patch("urllib.request.urlopen", side_effect=urllib.error.URLError("down")),
        pytest.raises(RelayError) as raised,
    ):
        client.inbox(q="alex@example.com")
    assert raised.value.code == "unavailable"
    assert "alex@example.com" not in caplog.text
    with (
        mock.patch("urllib.request.urlopen", side_effect=TimeoutError()),
        pytest.raises(RelayError) as raised,
    ):
        client.inbox()
    assert raised.value.code == "timeout"
    with (
        mock.patch("urllib.request.urlopen", return_value=_Response(b"<html>")),
        pytest.raises(RelayError) as raised,
    ):
        client.inbox()
    assert raised.value.code == "bad_response"


def test_paths_only_take_uuids():
    client = HttpRelayClient("https://www.example.com", SECRET)
    with pytest.raises(ValueError):
        client.join("../settings")


def test_factory_and_configuration(settings, superadmin):
    settings.RELAY_CLIENT = "http"
    settings.RELAY_API_BASE_URL = ""
    assert not is_configured()
    assert isinstance(get_client(superadmin), HttpRelayClient)
    settings.RELAY_API_BASE_URL = "https://www.example.com"
    assert is_configured()
    settings.RELAY_CLIENT = "fake"
    client = get_client(superadmin)
    assert isinstance(client, FakeRelayClient) and client.admin["id"] == f"sa:{superadmin.pk}"


def test_fake_client_sorts_needs_by_longest_wait(relay, superadmin):
    data = get_client(superadmin).inbox(tab="needs")
    assert [row["displayName"] for row in data["items"]] == ["Visitor 8C1D", "Alex Morgan"]
    assert data["counts"] == {"needs": 2, "live": 1, "ai": 2, "closed": 1}
