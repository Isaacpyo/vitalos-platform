"""Product Pipeline (ADR-044): navigation, permissions, the Askbridge status card, caching and the audited Open."""

import io
import json
import re
import threading
from datetime import timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from django.contrib.auth.models import Permission
from django.core.cache import cache
from django.core.management import call_command
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.products import client, status
from apps.products.registry import get_product

TOKEN = "askbridge-status-token-DO-NOT-RENDER-0123456789"
STATUS_URL = "https://askbridge.example.test/api/platform/v1/status"
SUPERADMIN_URL = "https://askbridge.example.test/superadmin"


def payload(**overrides):
    now = timezone.now()
    body = {
        "product": "askbridge",
        "environment": "production",
        "status": "operational",
        "checkedAt": now.isoformat(),
        "tenants": {"total": 42, "active": 30, "trial": 9, "suspended": 3},
        "subscriptions": {"active": 28, "trialing": 9, "pastDue": 2},
        "alerts": [],
        "superadminUrl": SUPERADMIN_URL,
    }
    body.update(overrides)
    return body


def alert(severity="critical", title="Stripe webhooks failing", url=SUPERADMIN_URL + "/alerts/1", minutes=12):
    return {
        "severity": severity,
        "title": title,
        "since": (timezone.now() - timedelta(minutes=minutes)).isoformat(),
        "url": url,
    }


class Stub:
    """Replaces the HTTP adapter: returns ``answer`` (or raises it) and counts calls."""

    def __init__(self):
        self.calls = []
        self.answer = payload()

    def __call__(self, url, token, timeout=client.TIMEOUT_SECONDS):
        self.calls.append({"url": url, "token": token, "timeout": timeout})
        if isinstance(self.answer, Exception):
            raise self.answer
        return self.answer


@pytest.fixture
def askbridge(settings, monkeypatch):
    settings.ASKBRIDGE_STATUS_URL = STATUS_URL
    settings.ASKBRIDGE_STATUS_TOKEN = TOKEN
    settings.ASKBRIDGE_SUPERADMIN_URL = SUPERADMIN_URL
    stub = Stub()
    monkeypatch.setattr(client, "fetch_status_json", stub)
    cache.clear()
    yield stub
    cache.clear()


def grant(user, *codenames):
    for codename in codenames:
        user.user_permissions.add(
            Permission.objects.get(content_type__app_label="products", codename=codename)
        )


@pytest.fixture
def pipeline_viewer(viewer):
    """A Viewer who may see the Product Pipeline but not open Askbridge."""
    grant(viewer, "view_product_pipeline")
    return viewer


@pytest.fixture
def askbridge_operator(make_user):
    """A Viewer with both permissions (not a SuperAdmin)."""
    from apps.accounts.roles import VIEWER

    user = make_user(VIEWER, email="operator@example.test")
    grant(user, "view_product_pipeline", "open_askbridge_superadmin")
    return user


def page(client_for, user, path="/products/"):
    response = client_for(user).get(path)
    assert response.status_code == 200
    return response.content.decode()


# --- Navigation and access ------------------------------------------------------------------------


def test_nav_entry_shows_for_superadmin_and_permitted_users_only(
    client_for, superadmin, viewer, lead, askbridge_operator, seeded
):
    assert 'data-nav="products"' in page(client_for, superadmin, "/")
    assert 'data-nav="products"' in page(client_for, askbridge_operator, "/")
    assert 'data-nav="products"' not in page(client_for, viewer, "/")
    assert 'data-nav="products"' not in page(client_for, lead, "/")
    grant(viewer, "view_product_pipeline")
    assert 'data-nav="products"' in page(client_for, viewer, "/")


def test_pipeline_pages_are_refused_without_the_permission(client, client_for, viewer, lead, norole, seeded):
    for path in ("/products/", "/products/askbridge/"):
        assert client.get(path).status_code == 302  # anonymous: to sign-in
        assert client_for(norole).get(path).status_code == 403
        assert client_for(viewer).get(path).status_code == 403
        assert client_for(lead).get(path).status_code == 403


def test_pipeline_page_renders_with_the_askbridge_card(client_for, superadmin, askbridge, seeded):
    body = page(client_for, superadmin)
    assert re.findall(r'aria-current="page" data-nav="([a-z_]+)"', body) == ["products"]
    assert "<h1" in body and "Product Pipeline" in body
    assert 'data-product="askbridge"' in body and "Askbridge" in body and "by Vitalos" in body
    assert "products/askbridge-app-icon" in body
    assert "/products/askbridge/" in body


def test_unknown_product_is_404(client_for, superadmin, askbridge, seeded):
    assert client_for(superadmin).get("/products/nothing/").status_code == 404


# --- Status card ---------------------------------------------------------------------------------------


def test_healthy_status(client_for, superadmin, askbridge, seeded):
    body = page(client_for, superadmin)
    assert 'data-state="ok:operational"' in body and "Operational" in body
    assert re.search(r'data-testid="product-environment">.*Production', body)
    assert re.search(r'data-testid="tenants-total">42<', body)
    assert "30 active · 9 on trial · 3 suspended" in body
    assert re.search(r'data-testid="subscriptions-active">28<', body)
    assert "9 trialing · 2 past due" in body
    assert "No critical alerts." in body
    assert 'data-testid="open-superadmin"' in body
    assert askbridge.calls == [{"url": STATUS_URL, "token": TOKEN, "timeout": 3.0}]


def test_degraded_status_with_alerts(client_for, superadmin, askbridge, seeded):
    askbridge.answer = payload(
        status="degraded",
        environment="staging",
        alerts=[
            alert(title="Knowledge imports failing"),
            alert(severity="warning", title="Queue age above 5 minutes", url=None),
        ],
    )
    body = page(client_for, superadmin)
    assert 'data-state="ok:degraded"' in body and "Degraded" in body
    assert "Staging" in body
    assert "Critical alerts (1)" in body and "Knowledge imports failing" in body
    assert f'href="{SUPERADMIN_URL}/alerts/1"' in body
    assert "Queue age above 5 minutes" not in body  # the card lists critical alerts only
    detail = page(client_for, superadmin, "/products/askbridge/")
    assert "Knowledge imports failing" in detail and "Queue age above 5 minutes" in detail
    assert detail.count('data-testid="product-alert"') == 2


def test_down_status(client_for, superadmin, askbridge, seeded):
    askbridge.answer = payload(status="down")
    assert 'data-state="ok:down"' in page(client_for, superadmin)


@pytest.mark.parametrize("code", ["timeout", "unreachable", "http_500", "http_401", "http_302", "bad_json"])
def test_failure_shows_status_unavailable_and_no_numbers(client_for, superadmin, askbridge, seeded, code):
    askbridge.answer = client.StatusFetchError(code)
    body = page(client_for, superadmin)
    assert 'data-state="unavailable"' in body and "Status unavailable" in body
    assert "There has been no good check since this server started." in body
    assert 'data-testid="tenants-total"' not in body and 'data-testid="product-counts"' not in body
    assert f"({code})" in body


def test_failure_after_a_good_check_shows_its_time_but_not_its_numbers(
    client_for, superadmin, askbridge, seeded
):
    page(client_for, superadmin)
    last_good = cache.get("products:last-good:askbridge")
    assert last_good is not None
    cache.delete("products:status:askbridge")
    askbridge.answer = client.StatusFetchError("timeout")
    body = page(client_for, superadmin)
    when = timezone.localtime(last_good.received_at)
    assert f"The last good check was at {when:%H:%M} on {when.day} {when:%b %Y}." in body
    assert 'data-testid="product-counts"' not in body and ">42<" not in body


def test_unset_token_shows_status_not_configured_and_makes_no_request(
    client_for, superadmin, askbridge, settings, seeded
):
    settings.ASKBRIDGE_STATUS_TOKEN = ""
    body = page(client_for, superadmin)
    assert 'data-state="not_configured"' in body and "Status not configured" in body
    assert "ASKBRIDGE_STATUS_TOKEN" in body  # the variable name for permitted staff, never a value
    assert askbridge.calls == []
    assert 'data-testid="product-counts"' not in body


INVALID = {
    "not an object": ["askbridge"],
    "wrong product": payload(product="other"),
    "unknown status": payload(status="fine"),
    "bad environment": payload(environment="Prod <b>"),
    "count is a string": payload(tenants={"total": "42", "active": 1, "trial": 0, "suspended": 0}),
    "count is a boolean": payload(tenants={"total": 1, "active": True, "trial": 0, "suspended": 0}),
    "negative count": payload(subscriptions={"active": -1, "trialing": 0, "pastDue": 0}),
    "missing count": payload(subscriptions={"active": 1, "trialing": 0}),
    "breakdown above total": payload(tenants={"total": 1, "active": 2, "trial": 0, "suspended": 0}),
    "alerts not a list": payload(alerts={}),
    "alert without url key": payload(alerts=[{k: v for k, v in alert().items() if k != "url"}]),
    "alert to another host": payload(alerts=[alert(url="https://evil.example/x")]),
    "alert over http": payload(alerts=[alert(url="http://askbridge.example.test/x")]),
    "unknown severity": payload(alerts=[alert(severity="high")]),
    "empty title": payload(alerts=[alert(title="  ")]),
    "naive time": payload(checkedAt="2026-10-22T10:00:00"),
    "time in the future": payload(checkedAt=(timezone.now() + timedelta(hours=2)).isoformat()),
    "superadmin url not https": payload(superadminUrl="javascript:alert(1)"),
    "missing tenants": {k: v for k, v in payload().items() if k != "tenants"},
}


@pytest.mark.parametrize("answer", INVALID.values(), ids=INVALID.keys())
def test_invalid_payload_is_status_unavailable(client_for, superadmin, askbridge, seeded, answer):
    askbridge.answer = answer
    body = page(client_for, superadmin)
    assert 'data-state="unavailable"' in body and "Status unavailable" in body
    assert "(invalid:" in body
    assert 'data-testid="product-counts"' not in body
    assert "evil.example" not in body and "javascript:" not in body


def test_unknown_keys_are_ignored():
    snapshot = status.parse_status(payload(extra={"x": 1}), get_product("askbridge"))
    assert snapshot.tenants["total"] == 42 and snapshot.alerts == ()


def test_status_is_cached(client_for, superadmin, askbridge, seeded):
    page(client_for, superadmin)
    page(client_for, superadmin)
    page(client_for, superadmin, "/products/askbridge/")
    assert len(askbridge.calls) == 1
    cache.delete("products:status:askbridge")
    page(client_for, superadmin)
    assert len(askbridge.calls) == 2


def test_failures_are_cached_briefly(client_for, superadmin, askbridge, seeded, monkeypatch):
    askbridge.answer = client.StatusFetchError("timeout")
    timeouts = []
    real_set = cache.set
    monkeypatch.setattr(
        cache,
        "set",
        lambda key, value, timeout=None: timeouts.append((key, timeout)) or real_set(key, value, timeout),
    )
    page(client_for, superadmin)
    page(client_for, superadmin)
    assert len(askbridge.calls) == 1
    assert ("products:status:askbridge", status.FAILURE_CACHE_SECONDS) in timeouts


def test_an_unexpected_error_never_breaks_the_page(client_for, superadmin, askbridge, seeded):
    askbridge.answer = RuntimeError("boom")
    body = page(client_for, superadmin)
    assert "Status unavailable" in body and "(error)" in body


@pytest.mark.parametrize(
    "answer",
    [payload(alerts=[alert()]), client.StatusFetchError("timeout"), ["bad"]],
    ids=["ok", "down", "bad"],
)
def test_no_token_or_status_url_in_rendered_html(client_for, superadmin, askbridge, seeded, answer):
    askbridge.answer = answer
    for path in ("/products/", "/products/askbridge/", "/"):
        body = page(client_for, superadmin, path)
        assert TOKEN not in body and "Bearer" not in body
        assert STATUS_URL not in body


# --- Permission-gated details and the audited Open --------------------------------------------------------


def test_view_only_users_see_status_but_no_details_or_open_button(
    client_for, pipeline_viewer, askbridge, seeded
):
    askbridge.answer = payload(alerts=[alert(title="Knowledge imports failing")])
    for path in ("/products/", "/products/askbridge/"):
        body = page(client_for, pipeline_viewer, path)
        assert "Operational" in body
        assert 'data-testid="open-superadmin"' not in body and "/products/askbridge/open/" not in body
        assert 'data-testid="product-counts"' not in body and ">42<" not in body
        assert "Knowledge imports failing" not in body
        assert SUPERADMIN_URL not in body
    assert 'data-testid="no-open-permission"' in page(client_for, pipeline_viewer, "/products/askbridge/")


def test_permitted_users_see_details_and_the_open_button(client_for, askbridge_operator, askbridge, seeded):
    detail = page(client_for, askbridge_operator, "/products/askbridge/")
    assert 'data-testid="open-superadmin"' in detail and 'action="/products/askbridge/open/"' in detail
    assert 'data-testid="product-counts"' in detail and SUPERADMIN_URL in detail


def test_csp_lets_the_open_form_reach_the_superadmin_only_where_it_is_shown(
    client_for, askbridge_operator, pipeline_viewer, askbridge, seeded
):
    def form_action(user, path):
        policy = client_for(user).get(path)["Content-Security-Policy"]
        return re.search(r"form-action ([^;]*)", policy).group(1).split()

    for path in ("/products/", "/products/askbridge/"):
        assert form_action(askbridge_operator, path) == ["'self'", "https://askbridge.example.test"]
        assert form_action(pipeline_viewer, path) == ["'self'"]
    assert form_action(askbridge_operator, "/") == ["'self'"]


def test_open_redirects_and_writes_an_audit_event(client_for, askbridge_operator, askbridge, seeded):
    response = client_for(askbridge_operator).post("/products/askbridge/open/")
    assert response.status_code == 302 and response["Location"] == SUPERADMIN_URL
    event = AuditEvent.objects.get(action="products.superadmin_opened")
    assert event.actor == askbridge_operator and event.actor_email == "operator@example.test"
    assert event.entity_type == "product" and event.entity_id == "askbridge"
    assert event.summary == "Opened the Askbridge Superadmin"
    assert event.metadata == {"product": "askbridge", "destination": SUPERADMIN_URL}
    assert TOKEN not in json.dumps(event.metadata)


def test_superadmin_may_open(client_for, superadmin, askbridge, seeded):
    response = client_for(superadmin).post("/products/askbridge/open/")
    assert response.status_code == 302 and response["Location"] == SUPERADMIN_URL


def test_open_is_refused_without_the_product_permission(
    client, client_for, pipeline_viewer, lead, norole, askbridge, seeded
):
    assert client_for(pipeline_viewer).post("/products/askbridge/open/").status_code == 403
    assert client_for(lead).post("/products/askbridge/open/").status_code == 403
    assert client_for(norole).post("/products/askbridge/open/").status_code == 403
    assert client.post("/products/askbridge/open/").status_code == 302  # anonymous: to sign-in
    assert not AuditEvent.objects.filter(action="products.superadmin_opened").exists()


def test_open_needs_post_and_a_known_product(client_for, askbridge_operator, askbridge, seeded):
    client = client_for(askbridge_operator)
    assert client.get("/products/askbridge/open/").status_code == 405
    assert client.post("/products/nothing/open/").status_code == 404
    assert not AuditEvent.objects.filter(action="products.superadmin_opened").exists()


def test_open_requires_csrf(askbridge_operator, askbridge, seeded):
    from django.test import Client

    from .conftest import login

    csrf_client = login(Client(enforce_csrf_checks=True), askbridge_operator)
    assert csrf_client.post("/products/askbridge/open/").status_code == 403
    assert not AuditEvent.objects.filter(action="products.superadmin_opened").exists()


def test_audit_trail_reads_the_open_event(client_for, superadmin, askbridge, seeded):
    client = client_for(superadmin)
    client.post("/products/askbridge/open/")
    body = client.get("/audit/?action=products.superadmin_opened").content.decode()
    assert (
        "Opened a product superadmin from Product Pipeline" in body
        and "Opened the Askbridge Superadmin" in body
    )


# --- Answerd, Vitalos Workforce and TipSignal ------------------------------------------------------

OTHER_PRODUCTS = ("answerd", "workforce", "tipsignal")


@pytest.fixture
def no_other_superadmins(settings):
    """The three newer products with no superadmin address (as Workforce and TipSignal ship)."""
    settings.ANSWERD_SUPERADMIN_URL = ""
    settings.WORKFORCE_SUPERADMIN_URL = ""
    settings.TIPSIGNAL_SUPERADMIN_URL = ""


def test_pipeline_lists_every_product(client_for, superadmin, askbridge, seeded):
    body = page(client_for, superadmin)
    for key in ("askbridge", *OTHER_PRODUCTS):
        assert f'data-product="{key}"' in body and f"products/{key}-app-icon" in body
        assert f"/products/{key}/" in body
    assert "Answerd" in body and "Vitalos Workforce" in body and "TipSignal" in body


def test_products_without_a_status_endpoint_make_no_request(client_for, superadmin, askbridge, seeded):
    page(client_for, superadmin)
    for key in OTHER_PRODUCTS:
        detail = page(client_for, superadmin, f"/products/{key}/")
        assert "Status not configured" in detail and 'data-testid="product-counts"' not in detail
    # Only Askbridge has a status endpoint and token, so it is the only product ever asked.
    assert askbridge.calls and {call["url"] for call in askbridge.calls} == {STATUS_URL}


def test_no_open_button_without_a_superadmin_address(
    client_for, superadmin, askbridge, no_other_superadmins, seeded
):
    for key in OTHER_PRODUCTS:
        detail = page(client_for, superadmin, f"/products/{key}/")
        assert 'data-testid="open-superadmin"' not in detail and f"/products/{key}/open/" not in detail
        assert 'data-testid="no-superadmin-url"' in detail
        assert client_for(superadmin).post(f"/products/{key}/open/").status_code == 404
    index = page(client_for, superadmin)
    for key in OTHER_PRODUCTS:
        assert f"/products/{key}/open/" not in index
    assert not AuditEvent.objects.filter(action="products.superadmin_opened").exists()


def test_answerd_open_redirects_to_its_superadmin_with_audit(
    client_for, superadmin, askbridge, settings, seeded
):
    settings.ANSWERD_SUPERADMIN_URL = "https://answerd.example.test/admin"
    detail = page(client_for, superadmin, "/products/answerd/")
    assert 'action="/products/answerd/open/"' in detail
    response = client_for(superadmin).post("/products/answerd/open/")
    assert response.status_code == 302 and response["Location"] == "https://answerd.example.test/admin"
    event = AuditEvent.objects.get(action="products.superadmin_opened")
    assert event.entity_id == "answerd" and event.summary == "Opened the Answerd Superadmin"


def test_each_product_has_its_own_open_permission(
    client_for, askbridge_operator, askbridge, settings, seeded
):
    settings.ANSWERD_SUPERADMIN_URL = "https://answerd.example.test/admin"
    assert client_for(askbridge_operator).post("/products/answerd/open/").status_code == 403
    detail = page(client_for, askbridge_operator, "/products/answerd/")
    assert 'data-testid="no-open-permission"' in detail
    grant(askbridge_operator, "open_answerd_superadmin")
    operator = type(askbridge_operator).objects.get(pk=askbridge_operator.pk)
    assert client_for(operator).post("/products/answerd/open/").status_code == 302


def test_product_access_command_knows_the_new_products(viewer, seeded):
    out = io.StringIO()
    for codename in ("open_answerd_superadmin", "open_workforce_superadmin", "open_tipsignal_superadmin"):
        call_command("product_access", "--email", viewer.email, "--grant", codename, stdout=out)
    viewer = type(viewer).objects.get(pk=viewer.pk)
    assert viewer.has_perm("products.open_tipsignal_superadmin") and viewer.has_perm(
        "products.open_workforce_superadmin"
    )


# --- product_access command ---------------------------------------------------------------------------


def test_product_access_command_grants_and_revokes_with_audit(viewer, askbridge, seeded):
    out = io.StringIO()
    call_command(
        "product_access", "--email", "VIEWER@example.test", "--grant", "open_askbridge_superadmin", stdout=out
    )
    assert "holds: open_askbridge_superadmin, view_product_pipeline" in out.getvalue()
    viewer.refresh_from_db()
    viewer = type(viewer).objects.get(pk=viewer.pk)
    assert viewer.has_perm("products.open_askbridge_superadmin") and viewer.has_perm(
        "products.view_product_pipeline"
    )
    assert AuditEvent.objects.filter(action="products.access_granted").count() == 2
    call_command(
        "product_access", "--email", viewer.email, "--revoke", "open_askbridge_superadmin", stdout=out
    )
    viewer = type(viewer).objects.get(pk=viewer.pk)
    assert not viewer.has_perm("products.open_askbridge_superadmin")
    assert viewer.has_perm("products.view_product_pipeline")
    assert AuditEvent.objects.filter(action="products.access_revoked").count() == 1


def test_product_access_command_refuses_unknown_users_and_permissions(viewer, seeded):
    from django.core.management.base import CommandError

    with pytest.raises(CommandError):
        call_command("product_access", "--email", "nobody@example.test")
    with pytest.raises(CommandError):
        call_command("product_access", "--email", viewer.email, "--grant", "delete_everything")


# --- HTTP adapter against a local server ------------------------------------------------------------------


class _Handler(BaseHTTPRequestHandler):
    routes: dict = {}
    seen: list = []

    def do_GET(self):  # noqa: N802 - http.server API
        self.seen.append({"path": self.path, "authorization": self.headers.get("Authorization")})
        status_code, headers, body = self.routes[self.path]
        if callable(body):
            body = body()
        self.send_response(status_code)
        for name, value in headers.items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class _Server(ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        pass  # the client hangs up early on purpose (oversize and timeout tests)


@pytest.fixture
def server(monkeypatch):
    for name in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"):
        monkeypatch.delenv(name, raising=False)
    _Handler.routes, _Handler.seen = {}, []
    httpd = _Server(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}", _Handler
    httpd.shutdown()
    httpd.server_close()


JSON = {"Content-Type": "application/json; charset=utf-8"}


def test_adapter_sends_the_bearer_token_and_decodes_json(server):
    base, handler = server
    handler.routes["/status"] = (200, JSON, b'{"product": "askbridge"}')
    assert client.fetch_status_json(base + "/status", TOKEN) == {"product": "askbridge"}
    assert handler.seen == [{"path": "/status", "authorization": f"Bearer {TOKEN}"}]


def test_adapter_never_follows_redirects(server):
    base, handler = server
    handler.routes["/status"] = (302, {"Location": base + "/elsewhere"}, b"")
    handler.routes["/elsewhere"] = (200, JSON, b"{}")
    with pytest.raises(client.StatusFetchError) as error:
        client.fetch_status_json(base + "/status", TOKEN)
    assert error.value.code == "http_302"
    assert [seen["path"] for seen in handler.seen] == ["/status"]


@pytest.mark.parametrize(
    ("route", "code"),
    [
        ((401, JSON, b'{"error": "unauthorised"}'), "http_401"),
        ((200, {"Content-Type": "text/html"}, b"<html>"), "not_json"),
        ((200, JSON, b"{not json"), "bad_json"),
        ((200, JSON, b'{"x": "' + b"a" * (client.MAX_RESPONSE_BYTES + 10) + b'"}'), "too_large"),
    ],
)
def test_adapter_failures(server, route, code):
    base, handler = server
    handler.routes["/status"] = route
    with pytest.raises(client.StatusFetchError) as error:
        client.fetch_status_json(base + "/status", TOKEN)
    assert error.value.code == code


def test_adapter_times_out(server):
    base, handler = server
    release = threading.Event()

    def slow():
        release.wait(5)
        return b"{}"

    handler.routes["/status"] = (200, JSON, slow)
    try:
        with pytest.raises(client.StatusFetchError) as error:
            client.fetch_status_json(base + "/status", TOKEN, timeout=0.3)
    finally:
        release.set()
    assert error.value.code == "timeout"


def test_adapter_refuses_other_schemes():
    with pytest.raises(client.StatusFetchError) as error:
        client.fetch_status_json("file:///etc/passwd", TOKEN)
    assert error.value.code == "bad_url"
