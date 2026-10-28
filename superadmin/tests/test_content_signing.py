"""Signing scheme v1 and preview tokens (openapi.yaml description; ADR-040)."""

import time
import uuid

import pytest
from django.test import Client

from apps.content_sync import signing

from .content_helpers import configure, signed_get

pytestmark = pytest.mark.django_db

PATH = "/api/content/v1/health"


@pytest.fixture(autouse=True)
def _keys(settings):
    configure(settings)


def _verify(
    scope="read",
    *,
    path="/api/content/v1/insights/posts?page=2",
    body=b"",
    method="GET",
    headers=None,
    now=None,
):
    headers = headers or signing.sign_headers(scope, method, path, body)
    return signing.verify(
        scope,
        key_id=headers["X-Vitalos-Key-Id"],
        timestamp=headers["X-Vitalos-Timestamp"],
        signature_header=headers["X-Vitalos-Signature"],
        method=method,
        path=path,
        body=body,
        now=now,
    )


def test_canonical_string_matches_the_contract():
    text = signing.canonical("read", "1760000000", "get", "/api/content/v1/home", b"")
    assert text == (
        "v1\nread\n1760000000\nGET\n/api/content/v1/home\n"
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
    headers = signing.sign_headers("read", "GET", "/api/content/v1/home")
    assert headers["X-Vitalos-Key-Id"] == "read-1"
    assert headers["X-Vitalos-Signature"].startswith("v1=") and len(headers["X-Vitalos-Signature"]) == 67


def test_valid_signature_is_accepted():
    assert _verify().key_id == "read-1"


def test_tampered_body_is_refused():
    headers = signing.sign_headers("tick", "POST", "/api/content/v1/tick", b"{}")
    with pytest.raises(signing.InvalidSignature):
        _verify("tick", path="/api/content/v1/tick", method="POST", body=b'{"x":1}', headers=headers)


def test_tampered_path_or_query_is_refused():
    headers = signing.sign_headers("read", "GET", "/api/content/v1/insights/posts?page=2")
    with pytest.raises(signing.InvalidSignature):
        _verify(path="/api/content/v1/insights/posts?page=3", headers=headers)
    with pytest.raises(signing.InvalidSignature):
        _verify(path="/api/content/v1/insights/feed?page=2", headers=headers)
    with pytest.raises(signing.InvalidSignature):
        _verify(path="/api/content/v1/insights/posts?page=2", method="POST", headers=headers)


def test_stale_and_future_timestamps_are_refused():
    old = signing.sign_headers("read", "GET", PATH, now=time.time() - 301)
    with pytest.raises(signing.InvalidSignature, match="stale"):
        _verify(path=PATH, headers=old)
    future = signing.sign_headers("read", "GET", PATH, now=time.time() + 301)
    with pytest.raises(signing.InvalidSignature, match="stale"):
        _verify(path=PATH, headers=future)
    edge = signing.sign_headers("read", "GET", PATH, now=time.time() - 290)
    assert _verify(path=PATH, headers=edge)


def test_wrong_scope_is_refused(settings):
    # The same secret configured for two scopes still cannot cross scopes: the scope is signed.
    settings.CONTENT_RENDER_SECRET = settings.CONTENT_READ_CLIENT_KEYS
    headers = signing.sign_headers("render", "GET", PATH)
    with pytest.raises(signing.InvalidSignature):
        _verify("read", path=PATH, headers=headers)


def test_unknown_key_id_is_refused():
    key = signing.Key("someone-else", "read-secret-for-tests")
    headers = signing.sign_headers("read", "GET", PATH, key=key)
    with pytest.raises(signing.InvalidSignature, match="key"):
        _verify(path=PATH, headers=headers)


def test_rotation_accepts_every_listed_key_and_signs_with_the_first(settings):
    old = signing.Key("read-0", "older-read-secret")
    assert _verify(path=PATH, headers=signing.sign_headers("read", "GET", PATH, key=old)).key_id == "read-0"
    settings.CONTENT_READ_CLIENT_KEYS = "read-2:newest-secret,read-1:read-secret-for-tests"
    assert signing.sign_headers("read", "GET", PATH)["X-Vitalos-Key-Id"] == "read-2"
    legacy = signing.Key("read-1", "read-secret-for-tests")
    assert _verify(path=PATH, headers=signing.sign_headers("read", "GET", PATH, key=legacy))
    with pytest.raises(signing.InvalidSignature):
        _verify(path=PATH, headers=signing.sign_headers("read", "GET", PATH, key=old))


def test_malformed_key_entries_are_ignored():
    keys = signing.parse_keys("good-1:secret, :nokey ,Bad_Id:x,noseparator,empty-2:, ok-2:s2")
    assert [key.key_id for key in keys] == ["good-1", "ok-2"]


def test_missing_configuration_fails_closed_with_503(settings, client: Client):
    settings.CONTENT_READ_CLIENT_KEYS = ""
    with pytest.raises(signing.NotConfigured):
        signing.sign_headers("read", "GET", PATH)
    response = client.get(
        PATH,
        HTTP_X_VITALOS_KEY_ID="read-1",
        HTTP_X_VITALOS_TIMESTAMP=str(int(time.time())),
        HTTP_X_VITALOS_SIGNATURE="v1=00",
    )
    assert response.status_code == 503
    assert response["Cache-Control"] == "no-store"


def test_endpoint_answers_401_for_every_invalid_signature(client: Client):
    assert signed_get(client, PATH).status_code == 200
    assert client.get(PATH).status_code == 401
    headers = signing.sign_headers("read", "GET", PATH)
    bad = {**headers, "X-Vitalos-Signature": "v1=" + "0" * 64}
    extra = {f"HTTP_{k.upper().replace('-', '_')}": v for k, v in bad.items()}
    assert client.get(PATH, **extra).status_code == 401
    stale = signed_get(client, PATH, now=time.time() - 400)
    assert stale.status_code == 401
    wrong_scope = signed_get(client, PATH, scope="tick")
    assert wrong_scope.status_code == 401
    wrong_query = signing.sign_headers("read", "GET", PATH + "?x=1")
    extra = {f"HTTP_{k.upper().replace('-', '_')}": v for k, v in wrong_query.items()}
    assert client.get(PATH, **extra).status_code == 401
    assert client.get(PATH, **extra)["Cache-Control"] == "no-store"


# --- Preview tokens ------------------------------------------------------------------------------


def test_preview_token_round_trip():
    item = uuid.uuid4()
    token = signing.preview_token("post", item, "abc123")
    payload = signing.verify_preview_token(token, "post", item)
    assert payload["v"] == 1 and payload["kid"] == "prev-1" and payload["rev"] == "abc123"
    assert payload["exp"] - time.time() <= 15 * 60


def test_expired_preview_token_is_refused():
    item = uuid.uuid4()
    token = signing.preview_token("post", item, "abc", now=time.time() - 16 * 60)
    with pytest.raises(signing.InvalidSignature, match="expired"):
        signing.verify_preview_token(token, "post", item)


def test_preview_token_for_another_entity_or_id_is_refused():
    item = uuid.uuid4()
    token = signing.preview_token("post", item, "abc")
    with pytest.raises(signing.InvalidSignature, match="subject"):
        signing.verify_preview_token(token, "role", item)
    with pytest.raises(signing.InvalidSignature, match="subject"):
        signing.verify_preview_token(token, "post", uuid.uuid4())


def test_tampered_preview_token_is_refused():
    item = uuid.uuid4()
    token = signing.preview_token("post", item, "abc")
    payload, mac = token.split(".")
    other = signing.preview_token("post", uuid.uuid4(), "abc")
    with pytest.raises(signing.InvalidSignature):
        signing.verify_preview_token(other.split(".")[0] + "." + mac, "post", item)
    with pytest.raises(signing.InvalidSignature):
        signing.verify_preview_token(payload + "." + mac[:-2] + "AA", "post", item)
    with pytest.raises(signing.InvalidSignature):
        signing.verify_preview_token("not-a-token", "post", item)
    with pytest.raises(signing.InvalidSignature):
        signing.verify_preview_token("", "post", item)


def test_preview_token_signed_with_an_unknown_key_is_refused(settings):
    item = uuid.uuid4()
    token = signing.preview_token("post", item, "abc")
    settings.CONTENT_PREVIEW_SECRET = "prev-2:another-secret"
    with pytest.raises(signing.InvalidSignature):
        signing.verify_preview_token(token, "post", item)
    settings.CONTENT_PREVIEW_SECRET = ""
    with pytest.raises(signing.NotConfigured):
        signing.verify_preview_token(token, "post", item)


def test_assist_scope_uses_the_read_keys_and_cannot_cross_scopes():
    """ADR-055: website brief assist is signed under its own scope with the existing read keys."""
    assert signing.keys_for("assist") == signing.keys_for("read")
    path = "/api/ai-data/brief-assist/"
    headers = signing.sign_headers("assist", "POST", path, b"{}")
    assert _verify("assist", path=path, body=b"{}", method="POST", headers=headers).key_id == "read-1"
    with pytest.raises(signing.InvalidSignature):
        _verify("read", path=path, body=b"{}", method="POST", headers=headers)
    with pytest.raises(signing.InvalidSignature):
        _verify("tick", path=path, body=b"{}", method="POST", headers=headers)
