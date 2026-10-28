"""Contract test: OpenAICompatibleProvider against a local fake HTTP server.

This proves the HTTP, error-mapping and parsing code, and that the key never leaks. It does not prove
that any real provider accepts these requests: that needs the live evaluation (AC-14).
"""

import json
import logging
import random
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from apps.aicore.core import prompts
from apps.aicore.core.gateway import ModelGateway
from apps.aicore.core.limits import ExecutionLimits, InMemoryUsage, LimitGuard, RunContext
from apps.aicore.core.providers import (
    ModelRequest,
    OpenAICompatibleProvider,
    ProviderRejected,
    ProviderResponseInvalid,
    ProviderTimeout,
    ProviderUnavailable,
)

KEY = "sk-test-DO-NOT-LEAK-0123456789abcdef"
CONTENT = {
    "lines": [
        {
            "source_line": 4,
            "date": "2026-09-03",
            "reference": "INV-8001",
            "type": "invoice",
            "amount": "1250.00",
        }
    ]
}


class Fake:
    mode = "ok"
    requests: list = []


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # keep test output quiet
        pass

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        Fake.requests.append({"path": self.path, "auth": self.headers.get("Authorization"), "body": body})
        mode = Fake.mode
        if mode == "slow":
            time.sleep(1.0)
            mode = "ok"
        if mode == "ok":
            payload = {
                "model": "fake-model-001",
                "choices": [
                    {
                        "message": {"role": "assistant", "content": json.dumps(CONTENT)},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 321, "completion_tokens": 45},
            }
            data = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if mode == "malformed":
            data = b"<html>gateway error</html>"
            self.send_response(200)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if mode == "redirect":
            self.send_response(302)
            self.send_header("Location", "http://evil.example/steal")
            self.end_headers()
            return
        status = {"429": 429, "500": 500, "401": 401, "400": 400}[mode]
        data = json.dumps({"error": {"message": f"echo {self.headers.get('Authorization')}"}}).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


@pytest.fixture
def server():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    Fake.mode = "ok"
    Fake.requests = []
    yield f"http://127.0.0.1:{httpd.server_address[1]}/v1"
    httpd.shutdown()
    httpd.server_close()


def request(timeout=2.0):
    messages = prompts.load_prompt("statement_extraction", 2).render(
        data="L4: Invoice INV-8001 dated 03 Sep 2026 for £1,250.00"
    )
    return ModelRequest(
        messages=messages, max_output_tokens=300, timeout_s=timeout, prompt_ref="statement_extraction@2"
    )


def provider(base):
    return OpenAICompatibleProvider(base_url=base, model="fake-model", api_key=KEY)


def test_success_parses_text_usage_and_sends_the_contract(server):
    response = provider(server).complete(request())
    assert json.loads(response.text) == CONTENT
    assert (response.input_tokens, response.output_tokens) == (321, 45)
    assert response.model == "fake-model-001" and response.finish_reason == "stop" and not response.simulated
    sent = Fake.requests[0]
    assert sent["path"] == "/v1/chat/completions"
    assert sent["auth"] == f"Bearer {KEY}"
    assert sent["body"]["model"] == "fake-model" and sent["body"]["max_tokens"] == 300
    assert sent["body"]["response_format"] == {"type": "json_object"}
    assert sent["body"]["temperature"] == 0.0
    assert [m["role"] for m in sent["body"]["messages"]] == ["system", "user"]


@pytest.mark.parametrize(
    ("mode", "error"),
    [
        ("429", ProviderUnavailable),
        ("500", ProviderUnavailable),
        ("401", ProviderRejected),
        ("400", ProviderRejected),
        ("malformed", ProviderResponseInvalid),
        ("redirect", ProviderRejected),
    ],
)
def test_errors_are_typed_and_never_contain_the_key(server, mode, error, caplog):
    Fake.mode = mode
    caplog.set_level(logging.DEBUG)
    with pytest.raises(error) as excinfo:
        provider(server).complete(request())
    assert KEY not in str(excinfo.value) and KEY not in repr(excinfo.value)
    assert KEY not in caplog.text
    if mode == "redirect":
        assert len(Fake.requests) == 1  # the redirect was not followed


def test_timeout(server):
    Fake.mode = "slow"
    with pytest.raises(ProviderTimeout) as excinfo:
        provider(server).complete(request(timeout=0.2))
    assert excinfo.value.retryable and KEY not in str(excinfo.value)


def test_unreachable_host_is_unavailable():
    with pytest.raises(ProviderUnavailable):
        provider("http://127.0.0.1:9/v1").complete(request(timeout=0.5))


def test_key_is_not_in_repr_and_https_is_required():
    assert KEY not in repr(provider("https://api.example.test/v1"))
    with pytest.raises(ValueError):
        OpenAICompatibleProvider(base_url="http://api.example.test/v1", model="m", api_key=KEY)
    with pytest.raises(ValueError):
        OpenAICompatibleProvider(base_url="https://api.example.test/v1", model="m", api_key="")


def test_gateway_over_http_retries_429_then_succeeds_and_logs_no_content(server, caplog):
    caplog.set_level(logging.DEBUG)
    modes = iter(["429", "ok"])

    class Switch(OpenAICompatibleProvider):
        def complete(self, req):
            Fake.mode = next(modes)
            return super().complete(req)

    live = Switch(base_url=server, model="gpt-4o-mini", api_key=KEY)
    gw = ModelGateway(
        live,
        LimitGuard(ExecutionLimits(), InMemoryUsage()),
        sleep=lambda s: None,
        rng=random.Random(0),  # noqa: S311
    )
    result = gw.run_structured(
        prompts.load_prompt("statement_extraction", 2),
        data="L4: Invoice INV-8001 £1,250.00",
        ctx=RunContext("wf", "RUN-1"),
    )
    assert result.outcome == "success" and result.attempts == 2 and not result.simulated
    assert result.cost_gbp > 0 and result.input_tokens == 321
    assert KEY not in caplog.text and "INV-8001" not in caplog.text
