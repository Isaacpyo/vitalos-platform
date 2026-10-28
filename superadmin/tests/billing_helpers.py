"""Billing test helpers: a local fake of the Stripe REST API and fictional invoice builders.

The fake is a real HTTP server on 127.0.0.1, so StripeClient's encoding, headers and error mapping run
for real. It never talks to Stripe. All data is fictional (.example addresses).
"""

import json
import threading
import time
import urllib.parse
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from apps.billing import services, stripe_client
from apps.billing.models import BillingSettings

FAKE_KEY = "sk_test_FAKE_never_real_0123456789abcdef"
WEBHOOK_SECRET = "whsec_test_fake_0123456789abcdef"


class FakeStripe:
    def __init__(self):
        self.requests: list[dict] = []
        self.fail: dict[str, int] = {}  # path prefix -> HTTP status to answer with
        self.sessions: list[dict] = []
        self.checkout_url = "https://checkout.stripe.com/c/pay/cs_test_fake"
        self._lock = threading.Lock()
        self._counter = 0

    def next_id(self, prefix: str) -> str:
        with self._lock:
            self._counter += 1
            return f"{prefix}_test_{self._counter:04d}"

    def paths(self) -> list[str]:
        return [f"{r['method']} {r['path']}" for r in self.requests]


def _handler(state: FakeStripe):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _send(self, status: int, payload: dict):
            data = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _record(self, method: str):
            parsed = urllib.parse.urlsplit(self.path)
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length).decode() if length else ""
            pairs = urllib.parse.parse_qsl(raw if method == "POST" else parsed.query, keep_blank_values=True)
            entry = {
                "method": method,
                "path": parsed.path,
                "raw": raw,
                "form": dict(pairs),
                "headers": {key.lower(): value for key, value in self.headers.items()},
            }
            state.requests.append(entry)
            return entry

        def _maybe_fail(self, path: str) -> bool:
            for prefix, status in state.fail.items():
                if path.startswith(prefix):
                    if status == 302:
                        self.send_response(302)
                        self.send_header("Location", "https://evil.example/steal")
                        self.send_header("Content-Length", "0")
                        self.end_headers()
                    else:
                        self._send(
                            status, {"error": {"type": "invalid_request_error", "code": "fake_failure"}}
                        )
                    return True
            return False

        def do_POST(self):
            entry = self._record("POST")
            path = entry["path"]
            if self._maybe_fail(path):
                return
            form = entry["form"]
            if path == "/v1/prices":
                return self._send(200, {"id": state.next_id("price"), "object": "price"})
            if path == "/v1/payment_links":
                link_id = state.next_id("plink")
                return self._send(
                    200,
                    {
                        "id": link_id,
                        "object": "payment_link",
                        "url": f"https://buy.stripe.com/test_{link_id}",
                    },
                )
            if path.startswith("/v1/payment_links/"):
                return self._send(
                    200, {"id": path.rsplit("/", 1)[-1], "active": form.get("active") != "false"}
                )
            if path == "/v1/checkout/sessions":
                session_id = state.next_id("cs")
                return self._send(
                    200, {"id": session_id, "object": "checkout.session", "url": state.checkout_url}
                )
            return self._send(404, {"error": {"type": "invalid_request_error", "code": "resource_missing"}})

        def do_GET(self):
            entry = self._record("GET")
            if self._maybe_fail(entry["path"]):
                return
            if entry["path"] == "/v1/checkout/sessions":
                after = entry["form"].get("starting_after", "")
                rows = state.sessions
                if after:
                    index = next((i for i, s in enumerate(rows) if s["id"] == after), len(rows))
                    rows = rows[index + 1 :]
                limit = int(entry["form"].get("limit") or 100)
                page = rows[:limit]
                return self._send(
                    200,
                    {
                        "object": "list",
                        "data": page,
                        "has_more": len(rows) > limit,
                        "url": "/v1/checkout/sessions",
                    },
                )
            return self._send(404, {"error": {"type": "invalid_request_error"}})

    return Handler


@pytest.fixture
def fake_stripe(settings, monkeypatch):
    """Stripe configured with a fake key and pointed at a local fake server."""
    state = FakeStripe()
    server = ThreadingHTTPServer(("127.0.0.1", 0), _handler(state))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    settings.BILLING_STRIPE_SECRET_KEY = FAKE_KEY
    monkeypatch.setattr(stripe_client, "API_BASE", f"http://127.0.0.1:{server.server_address[1]}")
    yield state
    server.shutdown()
    server.server_close()


def make_draft(actor, *, lines=None, **data):
    values = {
        "bill_to_name": "Alex Example",
        "bill_to_organisation": "Example Studio Ltd",
        "bill_to_email": "accounts@example-studio.example",
        "bill_to_address": "1 Example Street\nExampletown\nEX1 2MP",
    }
    values.update(data)
    lines = lines or [
        {"description": "AI Opportunity Assessment", "quantity": Decimal("1"), "unit_price_pence": 35000},
        {"description": "Workshop (half day)", "quantity": Decimal("2"), "unit_price_pence": 12550},
    ]
    return services.create_invoice(values, lines, actor)


def make_issued(actor, **kwargs):
    invoice = make_draft(actor, **kwargs)
    invoice, _note = services.issue_invoice(invoice, actor)
    return invoice


def set_vat(registered: bool, rate=Decimal("20"), number="GB000000000"):
    conf = BillingSettings.load()
    conf.vat_registered = registered
    conf.default_vat_rate = rate
    conf.vat_number = number if registered else ""
    conf.save()


def session_payload(
    invoice_number: str, amount: int, *, session_id: str = "cs_test_paid_0001", **extra
) -> dict:
    payload = {
        "id": session_id,
        "object": "checkout.session",
        "payment_status": "paid",
        "status": "complete",
        "mode": "payment",
        "amount_total": amount,
        "currency": "gbp",
        "created": int(time.time()),
        "metadata": {"vitalos_invoice": invoice_number},
        "client_reference_id": invoice_number,
        "payment_intent": f"pi_test_{session_id[-4:]}",
        "payment_link": None,
        "customer_details": {"email": "payer@example-studio.example"},
    }
    payload.update(extra)
    return payload
