"""Portal assistant: six read-only activities, each answerable without AI.

Boundaries (ADR-056):

* Context is built ONLY from records the member may see, through ``selectors`` (the same scoping the pages use).
  Internal notes, scores, margins, private discussions, unpublished drafts and unapproved AI text are never read.
* Every answer cites records (links) and says what is missing or possibly out of date.
* The assistant never changes anything: no milestone, approval, scope or date. It may DRAFT text (a clarification,
  a comment, a change request) which the customer reviews in the composer before submitting.
* Model calls go only through the ``apps.aicore`` gateway (kill switch, caps, metering, schema validation).
  When the model is unavailable (today's production state) the answer is compiled deterministically from the
  records and labelled "Compiled from your project records: no AI used".
* A demonstration path replays hand-written fixtures through the gateway's simulated provider. It is available
  only where ``PORTAL_AI_REPLAY`` is on (development and tests) and is labelled as simulated.
"""

from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from django.conf import settings
from django.utils import timezone
from django.utils.formats import date_format

from apps.aicore import services as aicore
from apps.aicore.core.limits import RunContext
from apps.aicore.core.prompts import load_prompt
from apps.aicore.core.providers import SimulatedProvider
from apps.aicore.models import AiSettings

from . import selectors

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "ai_replay"
LABEL_COMPILED = "Compiled from your project records: no AI used"
LABEL_AI = "Written by AI from your project records. Check the linked records."
LABEL_SIMULATED = "Simulated answer for demonstration (replayed fixture, not a live model)"

ACTIVITIES = {
    "summarise_project": "Summarise my project",
    "what_changed": "What changed since my last visit?",
    "what_needed": "What do you need from me?",
    "explain_deliverable": "Explain this deliverable",
    "unanswered": "Which questions are still unanswered?",
    "clarify_challenge": "Help me clarify this challenge",
}
PROMPT_VERSION = 1


@dataclass
class Source:
    id: str
    key: str
    label: str
    text: str
    url_name: str
    url_kwargs: dict
    updated: dt.datetime | None = None


@dataclass
class Point:
    text: str
    sources: list[str] = field(default_factory=list)


@dataclass
class Answer:
    activity: str
    mode: str  # compiled | ai | simulated
    label: str
    summary: str
    points: list[Point]
    gaps: list[str]
    sources: list[Source]
    draft: str = ""
    note: str = ""

    def cited(self) -> list[Source]:
        wanted = {sid for p in self.points for sid in p.sources}
        return [s for s in self.sources if s.id in wanted]


def _d(value) -> str:
    if value is None:
        return ""
    if isinstance(value, dt.datetime):
        value = timezone.localtime(value).date()
    return date_format(value, "j M Y")


class _Collector:
    def __init__(self):
        self.sources: list[Source] = []
        self._by_key: dict[str, Source] = {}

    def add(self, key, label, text, url_name, url_kwargs, updated=None) -> Source:
        if key in self._by_key:
            return self._by_key[key]
        source = Source(
            f"S{len(self.sources) + 1}", key, label, text.strip()[:1500], url_name, url_kwargs, updated
        )
        self.sources.append(source)
        self._by_key[key] = source
        return source


# --- Context builders (visible records only) --------------------------------------------------------------------------


def _challenge_sources(c: _Collector, member, challenge):
    s = c.add(
        f"challenge:{challenge.pk}",
        f"Challenge: {challenge.title}",
        f"Stage: {challenge.get_journey_stage_display()}. {challenge.status_note}\n"
        f"What you told us: {challenge.submitted_problem}\nOutcome you want: {challenge.submitted_outcome}",
        "challenge",
        {"pk": challenge.pk},
        challenge.updated_at,
    )
    agreed = selectors.agreed_brief(member, challenge)
    proposed = selectors.pending_brief(member, challenge)
    for brief in (agreed, proposed):
        if brief:
            lines = [f"- [{seg['provenance']}] {seg['text']}" for seg in brief.segments]
            c.add(
                f"brief:{brief.pk}",
                f"Brief version {brief.number} ({brief.get_status_display()})",
                "\n".join(lines),
                "challenge",
                {"pk": challenge.pk},
                brief.agreed_at or brief.proposed_at,
            )
    return s


def _project_sources(c: _Collector, member, project):
    c.add(
        f"project:{project.pk}",
        f"Project: {project.name}",
        f"Status: {project.get_status_display()}. Target date: {_d(project.target_date) or 'not set'}.\n"
        f"Summary: {project.summary}\nAgreed scope: {project.agreed_scope}",
        "project",
        {"pk": project.pk},
        project.updated_at,
    )
    for m in selectors.milestones(member, project):
        c.add(
            f"milestone:{m.pk}",
            f"Milestone: {m.title}",
            f"Status: {m.get_status_display()}. Target date: {_d(m.target_date) or 'not set'}. {m.description}",
            "milestone",
            {"pk": m.pk},
        )
    for item in selectors.items(member, project):
        c.add(
            f"item:{item.pk}",
            f"{item.get_kind_display()} ({item.get_party_display()}): {item.text[:60]}",
            f"{item.get_kind_display()} owned by {item.get_party_display()}: {item.text}. "
            f"Due: {_d(item.due_date) or 'no date'}. {'Done.' if item.is_done else 'Open.'}",
            "project",
            {"pk": project.pk},
        )
    for u in selectors.updates(member, project=project)[:3]:
        c.add(
            f"update:{u.pk}",
            f"Update: {u.title}",
            f"{_d(u.published_at)}: {u.body}",
            "update",
            {"pk": u.pk},
            u.published_at,
        )
    for d in selectors.deliverables(member, project):
        v = selectors.latest_version(member, d)
        if v:
            c.add(
                f"deliverable:{d.pk}",
                f"Deliverable: {d.title}",
                f"Latest version {v.number}: {v.summary}. Decision state: {selectors.version_state(v)}.",
                "deliverable",
                {"pk": d.pk},
                v.shared_at,
            )


def _question_sources(c: _Collector, member, challenge=None, open_only=True):
    qs = selectors.information_requests(member, challenge)
    if open_only:
        qs = qs.filter(status="open")
    for q in qs:
        c.add(
            f"question:{q.pk}",
            f"Question: {q.question[:70]}",
            f"Asked on {_d(q.published_at)}. Due: {_d(q.due_date) or 'no date'}. {q.question}. {q.detail}",
            "question",
            {"pk": q.pk},
            q.published_at,
        )


def build_context(activity: str, member, *, challenge=None, project=None, deliverable=None, text: str = ""):
    """Return (sources, scope_note). Every read is a scoped selector; nothing else is consulted."""
    c = _Collector()
    if activity == "summarise_project":
        _challenge_sources(c, member, project.challenge)
        _project_sources(c, member, project)
        _question_sources(c, member, project.challenge)
    elif activity == "what_changed":
        since = member.previous_visit_at
        qs = selectors.events(member, since=since)[:25] if since else selectors.events(member)[:10]
        for e in qs:
            c.add(
                f"event:{e.pk}",
                f"Activity: {e.summary[:60]}",
                f"{_d(e.occurred_at)}: {e.summary}",
                e.url_name or "home",
                e.url_kwargs,
                e.occurred_at,
            )
    elif activity == "what_needed":
        for row in selectors.actions_required(member):
            c.add(
                f"action:{row['kind']}:{row['url_name']}:{sorted(row['url_kwargs'].items())}:{row['title'][:30]}",
                f"{row['kind'].title()}: {row['title'][:70]}",
                f"{row['title']} ({row['context']}). Due: {_d(row['due']) or 'no date'}.",
                row["url_name"],
                row["url_kwargs"],
            )
    elif activity == "explain_deliverable":
        v = selectors.latest_version(member, deliverable)
        c.add(
            f"deliverable:{deliverable.pk}",
            f"Deliverable: {deliverable.title}",
            f"{deliverable.description} Project: {deliverable.project.name}.",
            "deliverable",
            {"pk": deliverable.pk},
        )
        if v:
            c.add(
                f"version:{v.pk}",
                f"Version {v.number}",
                f"{v.summary}\n{v.body}\nDecision state: {selectors.version_state(v)}.",
                "deliverable",
                {"pk": deliverable.pk},
                v.shared_at,
            )
            for a in selectors.decisions(v):
                c.add(
                    f"decision:{a.pk}",
                    f"Decision on version {v.number}",
                    f"{a.get_decision_display()} by {a.user_name or a.user_email} on {_d(a.created_at)}. {a.comment}",
                    "deliverable",
                    {"pk": deliverable.pk},
                    a.created_at,
                )
        if (
            deliverable.milestone_id
            and selectors.milestones(member).filter(pk=deliverable.milestone_id).exists()
        ):
            m = deliverable.milestone
            c.add(
                f"milestone:{m.pk}",
                f"Milestone: {m.title}",
                f"Status: {m.get_status_display()}. Target date: {_d(m.target_date) or 'not set'}.",
                "milestone",
                {"pk": m.pk},
            )
    elif activity == "unanswered":
        _question_sources(c, member, challenge)
    elif activity == "clarify_challenge":
        _challenge_sources(c, member, challenge)
        _question_sources(c, member, challenge)
        if text.strip():
            c.add("draft", "Your draft", text.strip()[:1500], "challenge", {"pk": challenge.pk})
    return c.sources


def render_context(sources: list[Source]) -> str:
    return "\n\n".join(
        f"[{s.id}] {s.label} (updated {_d(s.updated) or 'unknown'})\n{s.text}" for s in sources
    )


# --- Deterministic answers -----------------------------------------------------------------------------------------------


def _ids(sources, *keys_prefix) -> list[str]:
    return [s.id for s in sources if any(s.key.startswith(p) for p in keys_prefix)]


def compile_answer(
    activity: str, member, sources: list[Source], *, challenge=None, project=None, deliverable=None
) -> Answer:
    points: list[Point] = []
    gaps: list[str] = []
    summary = ""
    draft = ""
    by_key = {s.key: s for s in sources}
    today = timezone.localdate()

    if activity == "summarise_project":
        s = by_key.get(f"project:{project.pk}")
        summary = f"{project.name} is {project.get_status_display().lower()}" + (
            f", with a target date of {_d(project.target_date)} (a target, not a promise)."
            if project.target_date
            else "."
        )
        points.append(Point(summary, [s.id] if s else []))
        ms = [x for x in sources if x.key.startswith("milestone:")]
        for m in ms:
            points.append(
                Point(
                    f"{m.label.replace('Milestone: ', '')}: {m.text.split('. ')[0].replace('Status: ', '').lower()}",
                    [m.id],
                )
            )
        for q in [x for x in sources if x.key.startswith("question:")]:
            points.append(Point(f"Waiting for your answer: {q.label.replace('Question: ', '')}", [q.id]))
        for dsrc in [x for x in sources if x.key.startswith("deliverable:")]:
            points.append(Point(f"{dsrc.label}. {dsrc.text}", [dsrc.id]))
        upd = [x for x in sources if x.key.startswith("update:")]
        if upd:
            points.append(Point(f"Latest update: {upd[0].label.replace('Update: ', '')}", [upd[0].id]))
            if upd[0].updated and (timezone.now() - upd[0].updated).days > 30:
                gaps.append(f"The latest update is from {_d(upd[0].updated)}, so it may be out of date.")
        else:
            gaps.append("There is no published update yet.")
        if not ms:
            gaps.append("No milestones have been published for this project.")
        if not project.target_date:
            gaps.append("No target date has been set.")
    elif activity == "what_changed":
        since = member.previous_visit_at
        if not sources:
            summary = (
                f"Nothing new since your last visit on {_d(since)}." if since else "There is no activity yet."
            )
        else:
            summary = (
                f"{len(sources)} change{'s' if len(sources) != 1 else ''} since your last visit on {_d(since)}."
                if since
                else "This is your first visit, so these are the most recent changes."
            )
        for src in sources:
            points.append(Point(src.text, [src.id]))
        if since is None:
            gaps.append("We have no earlier visit to compare with.")
    elif activity == "what_needed":
        rows = selectors.actions_required(member)
        summary = (
            f"{len(rows)} thing{'s' if len(rows) != 1 else ''} need{'s' if len(rows) == 1 else ''} your attention."
            if rows
            else "Nothing is waiting on you right now."
        )
        for src, row in zip(sources, rows, strict=False):
            due = f" Due {_d(row['due'])}{' (overdue)' if row['overdue'] else ''}." if row["due"] else ""
            who = {"approver": " Needs an approver.", "contributor": " Needs a contributor."}.get(
                row["needs"], ""
            )
            points.append(Point(f"{row['title']} ({row['context']}).{due}{who}", [src.id]))
        if not rows:
            gaps.append(
                "This list covers questions, briefs to review, deliverables awaiting a decision and customer-owned dependencies."
            )
    elif activity == "explain_deliverable":
        d = by_key.get(f"deliverable:{deliverable.pk}")
        versions = [x for x in sources if x.key.startswith("version:")]
        summary = f"{deliverable.title}: {deliverable.description or 'no description has been published'}"
        if d:
            points.append(
                Point(f"What it is: {deliverable.description or 'No description published.'}", [d.id])
            )
        if versions:
            v = versions[0]
            first = v.text.split("\n")[0]
            points.append(Point(f"This version ({v.label}): {first or 'no summary written'}", [v.id]))
            if "Decision state: approved" in v.text:
                points.append(Point("This version has been approved.", [v.id]))
            elif "Decision state: changes_requested" in v.text:
                points.append(
                    Point("Changes were requested on this version; a new version will follow.", [v.id])
                )
            else:
                points.append(Point("This version is waiting for a review decision.", [v.id]))
            if not v.text.split("\n")[1:2] or not v.text.split("\n")[1].strip():
                gaps.append(
                    "No preview text was written for this version. Download the attached file, or ask in the discussion."
                )
        else:
            gaps.append("No version has been shared yet.")
    elif activity == "unanswered":
        qs = [x for x in sources if x.key.startswith("question:")]
        summary = (
            f"{len(qs)} question{'s are' if len(qs) != 1 else ' is'} still waiting for an answer."
            if qs
            else "No questions are waiting for an answer."
        )
        for src in qs:
            q_id = int(src.key.split(":")[1])
            overdue = selectors.information_requests(member).filter(pk=q_id, due_date__lt=today).exists()
            points.append(
                Point(f"{src.label.replace('Question: ', '')}{' (overdue)' if overdue else ''}", [src.id])
            )
    elif activity == "clarify_challenge":
        ch = by_key.get(f"challenge:{challenge.pk}")
        brief = next((x for x in sources if x.key.startswith("brief:")), None)
        summary = f"Here is what we hold for '{challenge.title}' and what would help us most."
        if ch:
            points.append(
                Point("What you told us is shown on the challenge page, in your own words.", [ch.id])
            )
        if brief:
            points.append(Point(f"The current brief is {brief.label.lower()}.", [brief.id]))
        else:
            gaps.append("There is no brief for you to review yet.")
        for q in [x for x in sources if x.key.startswith("question:")]:
            points.append(Point(f"Still open: {q.label.replace('Question: ', '')}", [q.id]))
        if not challenge.submitted_outcome.strip():
            gaps.append("The outcome you want is not written down yet.")
        draft = (
            "Some more detail that may help:\n"
            "- Who does this work today, and how often?\n"
            "- Which systems or documents are involved?\n"
            "- What would a good result look like for you?\n"
            "- Anything we should avoid or be careful about?"
        )
    return Answer(activity, "compiled", LABEL_COMPILED, summary, points, gaps, sources, draft=draft)


# --- Model path ----------------------------------------------------------------------------------------------------------


_DATE_RE = re.compile(
    r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{4})?\b"
    r"|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b",
    re.IGNORECASE,
)


def _unsupported_date(text: str, context: str) -> bool:
    ctx = context.lower()
    return any(m.group(0).lower() not in ctx for m in _DATE_RE.finditer(text or ""))


def validate_output(
    output: dict, sources: list[Source], context: str
) -> tuple[str, list[Point], list[str], str]:
    valid = {s.id for s in sources}
    points = []
    for raw in output.get("points", []):
        cites = [sid for sid in raw.get("sources", []) if sid in valid]
        text = str(raw.get("text", "")).strip()
        if cites and text and not _unsupported_date(text, context):
            points.append(Point(text, cites))
    summary = str(output.get("summary", "")).strip()
    if _unsupported_date(summary, context):
        summary = ""
    gaps = [
        str(g).strip()
        for g in output.get("gaps", [])
        if str(g).strip() and not _unsupported_date(str(g), context)
    ]
    draft = str(output.get("draft", "") or "").strip()[:1500]
    return summary, points, gaps, draft


def model_path() -> tuple[bool, str]:
    """Whether the live model can be used right now, and why not if it cannot."""
    ai = AiSettings.load()
    if not aicore.is_enabled(ai):
        return False, "AI is switched off."
    if not ai.model_path_enabled:
        return False, "The live model path is switched off."
    provider, reason = aicore.live_provider_status()
    return provider is not None, reason


def replay_available() -> bool:
    return bool(getattr(settings, "PORTAL_AI_REPLAY", False))


def _fixture(activity: str) -> dict | None:
    path = FIXTURE_DIR / f"{activity}.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _replay_provider(activity: str, sources: list[Source]):
    fixture = _fixture(activity)
    if fixture is None:
        return None
    by_key = {s.key: s.id for s in sources}

    def responder(_request):
        points = []
        for p in fixture.get("points", []):
            ids = [by_key[k] for k in p.get("cite", []) if k in by_key]
            if ids:
                points.append({"text": p["text"], "sources": ids})
        return {
            "respond": {
                "summary": fixture.get("summary", ""),
                "points": points,
                "gaps": fixture.get("gaps", []),
                "draft": fixture.get("draft", ""),
            }
        }

    return SimulatedProvider(responder=responder)


def answer(
    activity: str,
    member,
    *,
    challenge=None,
    project=None,
    deliverable=None,
    text: str = "",
    use_replay: bool = False,
    provider=None,
) -> Answer:
    """Run one activity. ``provider`` is for tests; production uses the configured live provider."""
    if activity not in ACTIVITIES:
        raise ValueError("Unknown activity")
    sources = build_context(
        activity, member, challenge=challenge, project=project, deliverable=deliverable, text=text
    )
    base = compile_answer(
        activity, member, sources, challenge=challenge, project=project, deliverable=deliverable
    )
    if not sources:
        base.note = "There is nothing to send to the assistant, so this answer is compiled directly."
        return base
    mode, label = "ai", LABEL_AI
    if provider is None:
        if use_replay and replay_available():
            provider = _replay_provider(activity, sources)
            mode, label = "simulated", LABEL_SIMULATED
            if provider is None:
                base.note = "No demonstration fixture exists for this activity."
                return base
        else:
            ok, reason = model_path()
            if not ok:
                base.note = f"The AI assistant is unavailable ({reason.rstrip('.')}). Showing a compiled answer instead."
                return base
            provider, _ = aicore.live_provider_status()
    context = render_context(sources)
    prompt = load_prompt(f"portal_{activity}", PROMPT_VERSION)
    gateway = aicore.build_gateway(provider)
    result = gateway.run_structured(
        prompt,
        data=context,
        ctx=RunContext(workflow=f"portal.{activity}", run_ref=f"portal-m{member.pk}"),
    )
    if not result.ok:
        base.note = f"The AI assistant could not answer ({result.outcome.replace('_', ' ')}). Showing a compiled answer instead."
        return base
    summary, points, gaps, draft = validate_output(result.output, sources, context)
    if not points:
        base.note = (
            "The AI answer could not be matched to your records, so a compiled answer is shown instead."
        )
        return base
    return Answer(
        activity,
        mode,
        label,
        summary or base.summary,
        points,
        gaps or base.gaps,
        sources,
        draft=draft if activity == "clarify_challenge" else "",
    )
