"""Website brief assist: ``POST /api/ai-data/brief-assist/`` (ADR-055, ADR-040 signing).

The website's guided brief asks this endpoint for follow-up questions and a draft brief. The request is
signed with the repo's v1 scheme under the ``assist`` scope (same keys as website content reads); nothing
is reachable without a valid signature, which is the only reason the view is exempt from CSRF.

Everything the model returns is a suggestion. This module stores metadata and hashes only
(``BriefAssistEvent`` and ``ModelExecution``), never the visitor's words, and never calls a provider
except through ``apps.aidata.ai`` (kill switch, caps, schema validation).

Order of checks: method, keys configured (503), signature (401), feature switch and AI availability
(503), body validation (400), rate limits (429), model call (200, or 503 when it fails).
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.aicore.models import AiSettings
from apps.content_sync import signing
from apps.enquiries import providers

from . import ai
from .models import BriefAssistEvent

SCOPE = "assist"
MAX_BODY = 24_000
STAGES = ("questions", "brief")
VISITOR_RE = re.compile(r"[0-9a-f]{16,64}", re.ASCII)
TOPIC_RE = re.compile(r"[a-z0-9-]{1,40}", re.ASCII)
# The website accepts any short id for an answer (it only echoes it back as a label); the ids it sends
# are used as text in the data block, never as keys, so the same pattern is accepted here.
ANSWER_ID_RE = re.compile(r"[A-Za-z0-9_-]{1,20}", re.ASCII)
URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)

#: Per visitor (an HMAC of their IP made by the website) and for everyone together.
VISITOR_LIMIT = 10
VISITOR_WINDOW = timedelta(minutes=15)
GLOBAL_LIMIT = 40
GLOBAL_WINDOW = timedelta(minutes=1)


class Invalid(ValueError):
    """The body does not match the contract (answered 400)."""


def parse_request(raw: bytes) -> dict:
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise Invalid("json") from exc
    if not isinstance(data, dict) or data.get("version") != 1:
        raise Invalid("version")
    stage = data.get("stage")
    description = data.get("description")
    topic = data.get("topic")
    answers = data.get("answers", [])
    visitor = data.get("visitor_ref")
    if stage not in STAGES:
        raise Invalid("stage")
    if not isinstance(description, str) or not 20 <= len(description.strip()) <= 4000:
        raise Invalid("description")
    if topic is not None and not (isinstance(topic, str) and TOPIC_RE.fullmatch(topic)):
        raise Invalid("topic")
    if not isinstance(answers, list) or len(answers) > 6:
        raise Invalid("answers")
    clean = []
    for item in answers:
        if not isinstance(item, dict):
            raise Invalid("answers")
        ident, question, answer = item.get("id"), item.get("question"), item.get("answer")
        if not (isinstance(ident, str) and ANSWER_ID_RE.fullmatch(ident)):
            raise Invalid("answers")
        if not (
            isinstance(question, str)
            and len(question) <= 300
            and isinstance(answer, str)
            and len(answer) <= 1500
        ):
            raise Invalid("answers")
        clean.append({"id": ident, "question": question.strip(), "answer": answer.strip()})
    if not isinstance(visitor, str) or not VISITOR_RE.fullmatch(visitor):
        raise Invalid("visitor_ref")
    return {
        "stage": stage,
        "description": description.strip(),
        "topic": topic or "",
        "answers": clean,
        "visitor_ref": visitor,
    }


def _digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def compose(body: dict) -> str:
    """The data block text: the visitor's own words, labelled. Untrusted; the prompt frames it as data."""
    lines = [f"Description: {body['description']}"]
    for item in body["answers"]:
        lines.append(f"Question {item['id']}: {item['question']}")
        lines.append(f"Answer {item['id']}: {item['answer'] or '(no answer)'}")
    return "\n".join(lines)


def _json(payload: dict, status: int = 200) -> JsonResponse:
    response = JsonResponse(payload, status=status)
    response["Cache-Control"] = "no-store"
    return response


def _unavailable():
    return _json({"error": "unavailable"}, 503)


def _event(stage: str, outcome: str, **fields) -> BriefAssistEvent:
    return BriefAssistEvent.objects.create(stage=stage[:12], outcome=outcome[:20], **fields)


def _finish(event: BriefAssistEvent, outcome: str, **fields) -> None:
    """Move the pending row to its outcome. A row that is never finished (the worker died mid-call) stays
    ``pending`` and keeps counting against the limits until its window ends, so a crash cannot be used to
    get free calls."""
    event.outcome = outcome[:20]
    for name, value in fields.items():
        setattr(event, name, value)
    event.save()


def _rate_limited(visitor_hash: str, now) -> bool:
    """Over a limit, counting the caller's own pending row (written first) and every in-flight call, so a
    burst of simultaneous requests is counted before any of them reaches the model."""
    counted = BriefAssistEvent.objects.exclude(outcome__in=("rate_limited", "invalid"))
    if counted.filter(visitor_hash=visitor_hash, created_at__gt=now - VISITOR_WINDOW).count() > VISITOR_LIMIT:
        return True
    return counted.filter(created_at__gt=now - GLOBAL_WINDOW).count() > GLOBAL_LIMIT


def clean_questions(output: dict) -> list[dict]:
    """Valid questions, de-duplicated by their text and renumbered q1..q4 in order, whatever ids the model
    chose, so the website's answers always come back with ids the brief stage accepts."""
    questions, seen = [], set()
    for item in output["questions"]:
        text = item["question"].strip()
        if text.lower() in seen or not text or URL_RE.search(text):
            continue
        seen.add(text.lower())
        questions.append(
            {
                "id": f"q{len(questions) + 1}",
                "question": item["question"].strip()[:300],
                "why": item["why"].strip()[:300],
                "suggestions": [
                    s.strip()[:120] for s in item["suggestions"] if s.strip() and not URL_RE.search(s)
                ][:4],
            }
        )
    return questions[:4]


def clean_brief(output: dict) -> dict:
    def text(value: str) -> str:
        return "" if URL_RE.search(value) else value.strip()

    return {
        "current_workflow": text(output["current_workflow"]),
        "desired_outcome": text(output["desired_outcome"]),
        "possible_automation": [text(v) for v in output["possible_automation"] if text(v)][:5],
        "unknowns": [text(v) for v in output["unknowns"] if text(v)][:6],
        "suggested_next_step": text(output["suggested_next_step"]),
    }


@csrf_exempt
@require_http_methods(["POST"])
def endpoint(request):
    started = time.monotonic()
    if not signing.keys_for(SCOPE):
        return _unavailable()  # no keys: fail closed
    try:
        raw = providers.read_body(request, MAX_BODY)
    except providers.BodyTooLarge:
        return _json({"error": "invalid"}, 400)
    try:
        signing.verify_request(request, SCOPE, raw)
    except signing.NotConfigured:
        return _unavailable()
    except signing.InvalidSignature:
        return _json({"error": "unauthorised"}, 401)
    # From here on the caller is the website server. Nothing below stores the visitor's words.
    if not AiSettings.load().brief_assist_enabled or not ai.availability().available:
        return _unavailable()
    try:
        body = parse_request(raw)
    except Invalid:
        return _json({"error": "invalid"}, 400)
    visitor_hash = _digest(body["visitor_ref"])
    input_hash = _digest(compose(body))
    now = timezone.now()
    common = {"topic": body["topic"], "visitor_hash": visitor_hash, "input_hash": input_hash}
    # Record the call BEFORE the model is asked, then count: concurrent bursts see each other's pending rows.
    pending = _event(body["stage"], "pending", **common)
    if _rate_limited(visitor_hash, now):
        _finish(pending, "rate_limited")
        return _json({"error": "rate-limited"}, 429)
    prompt = "brief_questions" if body["stage"] == "questions" else "brief_draft"
    try:
        run = ai.run_prompt(
            prompt,
            1,
            data=compose(body),
            run_ref=f"ba-{visitor_hash[:12]}",
            workflow=f"aidata.{prompt}",
            variables={"topic": body["topic"] or "not given"},
        )
    except ai.AiUnavailable:
        _finish(pending, "unavailable")
        return _unavailable()
    except ai.AiFailed as exc:
        _finish(
            pending,
            exc.result.outcome,
            execution_id=exc.result.execution_id,
            latency_ms=int((time.monotonic() - started) * 1000),
        )
        return _unavailable()
    latency = int((time.monotonic() - started) * 1000)
    if body["stage"] == "questions":
        questions = clean_questions(run.output)
        if len(questions) < 2:
            _finish(pending, "invalid_output", execution_id=run.execution_id, latency_ms=latency)
            return _unavailable()
        _finish(pending, "success", execution_id=run.execution_id, latency_ms=latency)
        return _json({"mode": "ai", "questions": questions})
    _finish(pending, "success", execution_id=run.execution_id, latency_ms=latency)
    return _json({"mode": "ai", "brief": clean_brief(run.output)})


__all__ = ["endpoint", "parse_request"]
