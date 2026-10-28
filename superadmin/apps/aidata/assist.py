"""The opportunity assistant (ADR-055): fixed, useful actions first; a free-text question answered only
from this opportunity's own records, with citations. It is not a general chatbot.

* Fixed actions (summary, what is missing, suggested next step) are computed by rules from the records:
  no model, no cost, and they work when AI is unavailable.
* A free-text question goes to the model through the gateway with the numbered records as the only
  material. The answer is accepted only if the model says it is answerable AND cites record ids that
  exist; otherwise the assistant says the records do not answer it. With AI unavailable the question is
  matched against the records by keyword and the matching excerpts are shown, labelled as search.
* The question text is never stored or logged: the audit event keeps its length only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from django.core.exceptions import PermissionDenied, ValidationError

from apps.audit.services import record

from . import ai, extraction, selectors, workspace
from .models import Draft, DraftKind, DraftState, Opportunity

MAX_QUESTION = 400
MAX_RECORDS = 60
MAX_CHARS = 12_000
STOP = set(
    "the a an and or of to in on for with is are was were be do does did what who how when where which why "
    "this that it its their there about from we they you our can could should would any have has had not no".split()
)


@dataclass(frozen=True)
class Record:
    id: str
    label: str
    text: str
    anchor: str = ""


@dataclass
class Answer:
    kind: str
    title: str
    mode: str  # "rules", "ai" or "search"
    lines: list[dict] = field(default_factory=list)  # {"text": str, "cites": [ids]}
    records: dict[str, Record] = field(default_factory=dict)
    note: str = ""

    @property
    def cited(self) -> list[Record]:
        seen: list[str] = []
        for line in self.lines:
            for cite in line["cites"]:
                if cite not in seen and cite in self.records:
                    seen.append(cite)
        return [self.records[cite] for cite in seen]


def collect_records(opportunity: Opportunity) -> list[Record]:
    """The numbered records the assistant may use: brief fields, notes, discovery items, answers, source."""
    out: list[Record] = []

    def add(label: str, text: str, anchor: str = ""):
        text = " ".join((text or "").split())
        if text and len(out) < MAX_RECORDS:
            out.append(Record(f"R{len(out) + 1}", label, text[:600], anchor))

    for name, label in extraction.FIELDS:
        value = getattr(opportunity, name, "")
        if value:
            add(
                f"Brief: {label}",
                opportunity.get_sector_display() if name == "sector" else str(value),
                "brief",
            )
    if opportunity.offer:
        add("Brief: Offer", opportunity.get_offer_display(), "brief")
    if opportunity.next_action:
        add("Next action", opportunity.next_action, "brief")
    for note in opportunity.notes.all()[:10]:
        add("Internal note", note.body, "notes")
    discovery = (
        workspace.approved_discovery(opportunity)
        or Draft.objects.filter(opportunity=opportunity, kind=DraftKind.DISCOVERY)
        .exclude(state__in=(DraftState.REJECTED, DraftState.SUPERSEDED))
        .order_by("-version")
        .first()
    )
    if discovery is not None:
        pack = discovery.payload
        tag = f"Discovery v{discovery.version} ({discovery.get_state_display().lower()})"
        add(f"{tag}: summary", pack.get("summary", ""), "discovery")
        for step in pack.get("workflow_steps", []):
            add(
                f"{tag}: workflow step",
                " | ".join(filter(None, (step.get("actor"), step.get("action"), step.get("system")))),
                "discovery",
            )
        for key, label in (
            ("requirements", "requirement"),
            ("assumptions", "assumption"),
            ("unknowns", "unknown"),
            ("acceptance_criteria", "acceptance criterion"),
        ):
            for item in pack.get(key, []):
                add(f"{tag}: {label}", item.get("text", ""), "discovery")
    questions = (
        Draft.objects.filter(opportunity=opportunity, kind=DraftKind.QUESTIONS)
        .exclude(state=DraftState.REJECTED)
        .order_by("-version")
        .first()
    )
    if questions is not None:
        for item in questions.payload.get("questions", []):
            if item.get("answer"):
                add(f"Answer to: {item['question'][:80]}", item["answer"], "discovery")
    source = (
        Draft.objects.filter(opportunity=opportunity, kind=DraftKind.BRIEF)
        .exclude(state=DraftState.REJECTED)
        .order_by("version")
        .first()
    )
    if source is not None and source.source_text:
        for paragraph in [p for p in re.split(r"\n\s*\n", source.source_text) if p.strip()][:8]:
            add(f"Source ({source.source_label or 'pasted text'})", paragraph, "source")
    return out


def _block(records: list[Record]) -> str:
    text = "\n".join(f"[{r.id}] ({r.label}) {r.text}" for r in records)
    return text[:MAX_CHARS]


# --- Fixed actions (rules, no model) ---------------------------------------------------------------------------


def summary(opportunity: Opportunity, records: list[Record]) -> Answer:
    by_label = {r.label: r for r in records}
    answer = Answer("summary", "Summary from the records", "rules", records={r.id: r for r in records})
    for label in (
        "Brief: Organisation",
        "Brief: Sector",
        "Brief: Problem",
        "Brief: Current process and tools",
        "Brief: Desired outcome",
        "Brief: Timeframe",
        "Brief: Offer",
        "Next action",
    ):
        item = by_label.get(label)
        if item:
            answer.lines.append({"text": f"{label.split(': ')[-1]}: {item.text}", "cites": [item.id]})
    if not answer.lines:
        answer.note = "The brief is empty, so there is nothing to summarise yet."
    return answer


def missing(opportunity: Opportunity, records: list[Record]) -> Answer:
    answer = Answer("missing", "What is missing", "rules", records={r.id: r for r in records})
    gaps = []
    for name, label in extraction.FIELDS:
        if name in ("contact_role", "budget_band", "timeframe"):
            continue
        if not getattr(opportunity, name, ""):
            gaps.append(f"{label} is blank.")
    if not opportunity.offer:
        gaps.append("No offer is chosen.")
    if opportunity.scorecard.score is None:
        gaps.append("The scorecard has not been scored.")
    discovery = workspace.approved_discovery(opportunity)
    if discovery is None:
        gaps.append("There is no approved discovery pack.")
    else:
        for unknown in discovery.payload.get("unknowns", []):
            answer.lines.append(
                {
                    "text": f"Open unknown: {unknown['text']}",
                    "cites": [r.id for r in records if unknown["text"][:40] in r.text][:1],
                }
            )
    questions = (
        Draft.objects.filter(opportunity=opportunity, kind=DraftKind.QUESTIONS)
        .exclude(state=DraftState.REJECTED)
        .order_by("-version")
        .first()
    )
    if questions is not None:
        open_count = len([q for q in questions.payload.get("questions", []) if not q.get("answer")])
        if open_count:
            gaps.append(f"{open_count} discovery question(s) are still unanswered.")
    answer.lines = [{"text": gap, "cites": []} for gap in gaps] + answer.lines
    if not answer.lines:
        answer.note = "Nothing obvious is missing from the records."
    else:
        answer.note = "Blank means the records do not say; nothing here is guessed."
    return answer


def next_step(opportunity: Opportunity, records: list[Record]) -> Answer:
    answer = Answer("next", "Suggested next step", "rules", records={r.id: r for r in records})
    brief = workspace.brief_of(opportunity)
    discovery = (
        Draft.objects.filter(opportunity=opportunity, kind=DraftKind.DISCOVERY)
        .exclude(state__in=(DraftState.REJECTED, DraftState.SUPERSEDED))
        .order_by("-version")
        .first()
    )
    proposal = (
        Draft.objects.filter(opportunity=opportunity, kind=DraftKind.PROPOSAL)
        .exclude(state__in=(DraftState.REJECTED, DraftState.SUPERSEDED))
        .order_by("-version")
        .first()
    )
    steps: list[tuple[str, str]] = []
    if not (opportunity.contact_email or opportunity.contact_phone):
        steps.append(("Find a contact route.", "There is no email address or phone number on the record."))
    if brief is None and opportunity.enquiry_id:
        steps.append(
            (
                "Prepare a brief from the original enquiry.",
                "The enquiry is linked but has no reviewed brief yet.",
            )
        )
    if not opportunity.offer:
        steps.append(("Choose an offer.", "A proposal is drafted from the offer definition."))
    if discovery is None:
        steps.append(
            ("Run discovery: prepare questions, then add the meeting notes.", "There is no discovery pack.")
        )
    elif discovery.state != DraftState.APPROVED:
        steps.append(
            (
                f"Review and approve discovery v{discovery.version}.",
                f"It is {discovery.get_state_display().lower()}; a proposal needs approved discovery.",
            )
        )
    elif proposal is None:
        steps.append(("Draft the proposal.", "Discovery is approved and no proposal exists."))
    elif proposal.state != DraftState.APPROVED:
        steps.append(
            (
                f"Review and approve proposal v{proposal.version}.",
                f"It is {proposal.get_state_display().lower()}.",
            )
        )
    else:
        steps.append(
            (
                "Send the approved proposal yourself.",
                "It is approved. Nothing is sent automatically: export it and send it manually.",
            )
        )
    for text, why in steps[:3]:
        answer.lines.append({"text": f"{text} {why}", "cites": []})
    return answer


# --- Free-text question -------------------------------------------------------------------------------------------


def _tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]{3,}", text.lower()) if w not in STOP}


def search(question: str, records: list[Record]) -> Answer:
    wanted = _tokens(question)
    scored = sorted(
        ((len(wanted & _tokens(r.text + " " + r.label)), r) for r in records), key=lambda x: -x[0]
    )
    hits = [r for score, r in scored if score > 0][:3]
    answer = Answer("ask", "Matching records", "search", records={r.id: r for r in records})
    for hit in hits:
        answer.lines.append({"text": f"{hit.label}: {hit.text}", "cites": [hit.id]})
    answer.note = (
        "AI is unavailable, so this is a keyword search of the records, not an answer."
        if hits
        else "AI is unavailable and no record matches those words."
    )
    return answer


def ask(opportunity: Opportunity, question: str, actor, request=None) -> Answer:
    if not selectors.can_edit_pipeline(actor):
        raise PermissionDenied
    question = " ".join((question or "").split())
    if len(question) < 5:
        raise ValidationError("Ask a question of at least a few words.")
    question = question[:MAX_QUESTION]
    records = collect_records(opportunity)
    known = {r.id: r for r in records}
    record(
        "aidata.assistant_asked",
        request=request,
        actor=actor,
        entity=opportunity,
        entity_id=opportunity.ref,
        summary=f"Asked the assistant about {opportunity.ref}",
        question_length=len(question),
    )
    if not records:
        return Answer("ask", "No records yet", "rules", note="There are no records to answer from yet.")
    data = f"{_block(records)}\n\nQuestion: {question}"
    try:
        run = ai.run_prompt(
            "opportunity_qa", 1, data=data, run_ref=f"qa-{opportunity.pk}", workflow="aidata.opportunity_qa"
        )
    except ai.AiUnavailable:
        return search(question, records)
    except ai.AiFailed as exc:
        result = search(question, records)
        result.note = f"The model failed ({exc.category}); showing a keyword search of the records instead."
        return result
    out = run.output
    cites = [c for c in out["citations"] if c in known]
    answer = Answer("ask", "Answer from the records", "ai", records=known)
    if out["answerable"] and out["answer"].strip() and cites:
        answer.lines.append({"text": out["answer"].strip(), "cites": cites})
        answer.note = "Suggested by AI from this opportunity's records. Check the cited records." + (
            " Simulated response (test double)." if run.simulated else ""
        )
    else:
        answer.title = "Not answered"
        answer.note = "The records do not answer that, or the answer could not be tied to a record."
    return answer


def run_action(opportunity: Opportunity, action: str, actor) -> Answer:
    if not selectors.can_edit_pipeline(actor):
        raise PermissionDenied
    records = collect_records(opportunity)
    functions = {"summary": summary, "missing": missing, "next": next_step}
    if action not in functions:
        raise ValidationError("Unknown assistant action.")
    return functions[action](opportunity, records)
