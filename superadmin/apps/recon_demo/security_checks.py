"""AC-13 checks the evaluation command can run without a database (RequestFactory, unsaved users).

Checked here: anonymous users are sent to sign-in on every demonstrator URL; users with no role or the
Viewer role get 403; state-changing endpoints refuse GET (405) and refuse a POST without a CSRF token
(403); statement text is HTML-escaped when rendered; every write service records an audit event.
The audit rows themselves are asserted against the database by tests/test_recon_views.py, which runs
before this gate in CI.
"""

from __future__ import annotations

import inspect

from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied
from django.middleware.csrf import CsrfViewMiddleware
from django.template.loader import render_to_string
from django.test import RequestFactory
from django.urls import resolve, reverse

from apps.accounts.models import User
from apps.accounts.roles import SUPERADMIN, VIEWER
from apps.aicore.core.evaluation import FAIL, PASS, CriterionResult

from . import services

READ_URLS = (
    ("recon_demo:index", ()),
    ("recon_demo:new", ()),
    ("recon_demo:detail", ("RUN-0001",)),
    ("recon_demo:evaluation", ()),
    ("recon_demo:settings", ()),
)
WRITE_URLS = (
    ("recon_demo:retry", ("RUN-0001",)),
    ("recon_demo:continue", ("RUN-0001",)),
    ("recon_demo:run_again", ("RUN-0001",)),
    ("recon_demo:decide", ("RUN-0001", 1)),
)
WRITE_SERVICES = (services.start_run, services.retry_run, services.continue_without_model, services.decide)
PAYLOAD = "<script>alert('x')</script> INV-1 & <b>bold</b>"


def _user(roles: frozenset[str]) -> User:
    user = User(email="check@example.test", is_active=True)
    user._vsa_roles = roles  # role cache: no database lookup
    return user


def _call(path: str, method: str, user):
    factory = RequestFactory()
    request = factory.get(path) if method == "GET" else factory.post(path)
    request.user = user
    match = resolve(path)
    try:
        return match.func(request, *match.args, **match.kwargs).status_code
    except PermissionDenied:
        return 403


def run_security_checks() -> CriterionResult:
    failures: list[str] = []
    checked = 0
    all_urls = [(reverse(name, args=args), "GET") for name, args in READ_URLS] + [
        (reverse(name, args=args), "POST") for name, args in WRITE_URLS
    ]
    for path, method in all_urls:
        checked += 1
        if _call(path, method, AnonymousUser()) != 302:
            failures.append(f"anonymous {method} {path} not sent to sign-in")
        for roles in (frozenset(), frozenset({VIEWER})):
            checked += 1
            if _call(path, method, _user(roles)) != 403:
                failures.append(f"{method} {path} allowed for roles {sorted(roles) or 'none'}")
    for name, args in WRITE_URLS:
        path = reverse(name, args=args)
        checked += 2
        if _call(path, "GET", _user(frozenset({SUPERADMIN}))) != 405:
            failures.append(f"GET {path} not refused (POST only)")
        func = resolve(path).func
        request = RequestFactory().post(path)
        request.user = _user(frozenset({SUPERADMIN}))
        response = CsrfViewMiddleware(lambda r: None).process_view(request, func, (), {})
        if getattr(func, "csrf_exempt", False) or response is None or response.status_code != 403:
            failures.append(f"POST {path} accepted without a CSRF token")
    checked += 1
    html = render_to_string(
        "recon_demo/_source.html", {"source": [{"number": 1, "text": PAYLOAD, "role": "", "role_label": ""}]}
    )
    if "<script>" in html or "&lt;script&gt;" not in html:
        failures.append("statement text is not HTML-escaped")
    for service in WRITE_SERVICES:
        checked += 1
        if "record(" not in inspect.getsource(service):
            failures.append(f"{service.__name__} writes no audit event")
    if failures:
        return CriterionResult(
            FAIL, f"{len(failures)} of {checked} checks failed: " + "; ".join(failures[:5])
        )
    return CriterionResult(
        PASS,
        f"{checked} checks passed (sign-in redirect, 403 for no role and Viewer, POST-only, CSRF, escaping, "
        "audit calls); audit rows asserted by tests/test_recon_views.py",
    )
