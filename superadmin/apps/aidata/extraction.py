"""Deterministic enquiry extraction (ADR-055): pure functions, no database, no model.

Reads a pasted enquiry, call note or website guided brief and proposes opportunity fields. Every
proposed value carries the exact quoted span of the source it came from (``Evidence``), so a reviewer
can check it beside the source; a field the rules cannot find stays blank and is listed as missing.
The text is untrusted: it is only ever matched against patterns here, never interpreted as an
instruction. The AI path (drafts.py) adds to this result; it never replaces the rules for contact
details, which are matched exactly.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from . import intake
from .models import Offer, Sector

MAX_SOURCE = 20_000
MAX_VALUE = 1_500

#: Fields the brief proposes, in review order, with the label shown to the reviewer.
FIELDS = (
    ("organisation", "Organisation"),
    ("contact_name", "Contact name"),
    ("contact_email", "Contact email"),
    ("contact_phone", "Contact phone"),
    ("contact_role", "Contact role"),
    ("sector", "Sector"),
    ("problem_summary", "Problem"),
    ("desired_outcome", "Desired outcome"),
    ("current_tools", "Current process and tools"),
    ("timeframe", "Timeframe"),
    ("budget_band", "Budget band (enquirer's estimate)"),
)
FIELD_LABELS = dict(FIELDS)
#: Fields a brief needs before discovery makes sense; blank ones are flagged as missing.
REQUIRED = ("problem_summary", "desired_outcome", "current_tools")
CONTACT_ROUTE = ("contact_email", "contact_phone")

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?<![\w/])(?:\+44\s?\(?0?\)?\s?|0)(?:\d[\s-]?){9,10}(?!\w)")
ORG_SUFFIX_RE = re.compile(
    r"\b((?:[A-Z][\w&'\-]*\s){0,4}[A-Z][\w&'\-]*\s(?:Ltd|Limited|LLP|LLC|Inc|PLC|plc|Partners|Group|& Co|and Co)\b\.?)"
)
LABEL_RE = re.compile(r"^\s*(?P<label>[A-Za-z][A-Za-z &/'\-]{1,48}?)\s*[:\-]\s*(?P<value>.*\S)?\s*$")
HEADING_RE = re.compile(r"^\s{0,3}(?:#{1,4}\s*|\*\*)(?P<label>[^*#\n]{2,60}?)(?:\*\*)?\s*:?\s*$")

# Heading aliases (the website guided brief, the AI & Data form and free-hand notes) -> brief field.
SECTION_ALIASES = {
    "problem_summary": (
        "business problem or workflow",
        "business problem",
        "problem",
        "the problem",
        "what you said",
        "what is the problem",
        "workflow",
        "what you do today and what hurts",
    ),
    "current_tools": (
        "current tools and process",
        "current process",
        "current workflow",
        "how it works today",
        "how it works now",
        "current tools",
        "tools",
        "today",
        "what you do today",
    ),
    "desired_outcome": (
        "desired outcome",
        "outcome",
        "what good looks like",
        "goal",
        "what you want",
        "what would good look like",
    ),
    "timeframe": ("timeframe", "timescale", "timeline", "when"),
}
_ALIAS_TO_FIELD = {alias: name for name, aliases in SECTION_ALIASES.items() for alias in aliases}
_NOT_GIVEN = {"not given", "not provided", "n/a", "none", "unknown", "-", ""}

SECTOR_KEYWORDS = (
    (
        Sector.ACCOUNTING,
        ("accountan", "bookkeep", "payroll", "tax return", "vat return", "xero", "quickbooks"),
    ),
    (Sector.PROPERTY, ("letting", "estate agen", "landlord", "tenancy", "property manage", "conveyanc")),
    (Sector.AUTOMOTIVE, ("garage", "dealership", "mot ", "vehicle", "car sales", "workshop", "automotive")),
    (
        Sector.TRADES,
        ("plumb", "electrician", "heating engineer", "roofing", "field service", "builder", "trades"),
    ),
    (Sector.RETAIL, ("e-commerce", "ecommerce", "online shop", "retail", "shopify", "webshop", "stockist")),
    (
        Sector.PROFESSIONAL,
        ("solicitor", "law firm", "consultan", "architect", "agency", "surveyor", "recruitment"),
    ),
)

OFFER_RULES = (
    (
        Offer.MANAGED,
        ("ongoing support", "maintain", "monitor", "keep it running", "managed", "monthly support"),
        "They talk about keeping something running over time.",
    ),
    (
        Offer.PRODUCTION,
        ("production", "integrat", "go live", "roll out", "deploy", "build it", "into our system", "api"),
        "They describe building something into their live systems.",
    ),
    (
        Offer.PROOF_OF_VALUE,
        ("prototype", "proof of", "pilot", "trial", "test it", "try it", "see if it works", "demo"),
        "They want to test whether an approach works before committing.",
    ),
    (
        Offer.ASSESSMENT,
        (
            "not sure",
            "whether",
            "explore",
            "options",
            "where to start",
            "idea",
            "could ai",
            "assess",
            "advice",
        ),
        "They are asking whether and where automation could help.",
    ),
)


@dataclass(frozen=True)
class Evidence:
    """A quoted span of the source text: ``source[start:end] == quote`` always holds."""

    field: str
    quote: str
    start: int
    end: int

    def as_dict(self) -> dict:
        return {"field": self.field, "quote": self.quote, "start": self.start, "end": self.end}


@dataclass
class Suggestion:
    value: str
    reasons: list[str] = field(default_factory=list)


@dataclass
class Extraction:
    fields: dict[str, str] = field(default_factory=dict)
    evidence: list[Evidence] = field(default_factory=list)
    offer: Suggestion | None = None
    next_action: Suggestion | None = None
    missing: list[str] = field(default_factory=list)
    topic: str = ""
    guided: bool = False
    truncated: bool = False

    def evidence_for(self, name: str) -> list[Evidence]:
        return [item for item in self.evidence if item.field == name]


def clean_source(text: str) -> tuple[str, bool]:
    """Normalise newlines, drop NUL, cap the length. Returns (text, truncated)."""
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    text = text.strip()
    if len(text) > MAX_SOURCE:
        return text[:MAX_SOURCE], True
    return text, False


def _span(source: str, quote: str, start_hint: int = 0) -> tuple[int, int] | None:
    index = source.find(quote, start_hint)
    if index < 0:
        index = source.find(quote)
    return (index, index + len(quote)) if index >= 0 else None


def find_quote(source: str, quote: str) -> tuple[int, int] | None:
    """Locate ``quote`` in ``source`` ignoring case and runs of whitespace; returns exact source offsets."""
    quote = (quote or "").strip()
    if len(quote) < 3:
        return None
    exact = _span(source, quote)
    if exact:
        return exact
    parts = [re.escape(part) for part in quote.split()]
    if not parts:
        return None
    match = re.search(r"\s+".join(parts), source, flags=re.IGNORECASE)
    return (match.start(), match.end()) if match else None


def _compact(value: str, limit: int = MAX_VALUE) -> str:
    value = "\n".join(line.rstrip() for line in (value or "").strip().splitlines())
    value = re.sub(r"\n{3,}", "\n\n", value)
    return intake.truncate(value, limit)


def _sections(source: str) -> dict[str, tuple[str, int, int]]:
    """Headed sections ("Desired outcome:" then text, or "## Desired outcome"): field -> (text, start, end)."""
    lines = source.split("\n")
    offsets, position = [], 0
    for line in lines:
        offsets.append(position)
        position += len(line) + 1
    found: dict[str, tuple[str, int, int]] = {}
    current, buffer, begin = None, [], 0

    def flush(end_line: int):
        nonlocal current, buffer
        if current and current not in found:
            body = "\n".join(buffer).strip()
            if body.lower() not in _NOT_GIVEN and body:
                start = source.find(body, begin)
                if start >= 0:
                    found[current] = (body, start, start + len(body))
        current, buffer = None, []

    for index, line in enumerate(lines):
        label = inline = None
        heading = HEADING_RE.match(line)
        labelled = LABEL_RE.match(line)
        if heading:
            label = heading.group("label")
        elif labelled and labelled.group("label").strip().lower() in _ALIAS_TO_FIELD:
            label, inline = labelled.group("label"), (labelled.group("value") or "")
        if label and label.strip().lower() in _ALIAS_TO_FIELD:
            flush(index)
            current = _ALIAS_TO_FIELD[label.strip().lower()]
            buffer = [inline] if inline else []
            begin = offsets[index]
            continue
        if current is not None:
            if (
                labelled
                and labelled.group("value") is not None
                and labelled.group("label").strip().lower()
                in (
                    "name",
                    "email",
                    "phone",
                    "organisation",
                    "company",
                    "role",
                    "sector",
                    "indicative budget",
                )
            ):
                flush(index)
                continue
            buffer.append(line)
    flush(len(lines))
    return found


def _label_value(source: str, labels: tuple[str, ...]) -> tuple[str, int, int] | None:
    for match in re.finditer(
        r"^[ \t>]*([A-Za-z][A-Za-z ]{1,30}?)[ \t]*:[ \t]*(.+\S)[ \t]*$", source, flags=re.MULTILINE
    ):
        if match.group(1).strip().lower() in labels:
            value = match.group(2).strip()
            if value.lower() in _NOT_GIVEN:
                continue
            return value, match.start(2), match.start(2) + len(match.group(2).rstrip())
    return None


def _sentences(source: str) -> list[tuple[str, int, int]]:
    out = []
    for match in re.finditer(r"[^.!?\n]+(?:[.!?]+|\n|$)", source):
        text = match.group(0).strip()
        if len(text) >= 12:
            start = match.start() + (len(match.group(0)) - len(match.group(0).lstrip()))
            out.append((text, start, start + len(text)))
    return out


def _pick(sentences, pattern: str, limit: int = 2):
    chosen = [item for item in sentences if re.search(pattern, item[0], flags=re.IGNORECASE)]
    return chosen[:limit]


def _set(result: Extraction, source: str, name: str, value: str, start: int, end: int, *, keep_value=False):
    if name in result.fields and result.fields[name]:
        return
    value = value.strip() if keep_value else _compact(value)
    if not value:
        return
    result.fields[name] = value
    result.evidence.append(Evidence(name, source[start:end], start, end))


def _first_email(source: str) -> re.Match | None:
    for match in EMAIL_RE.finditer(source):
        if not match.group(0).lower().endswith("@vitalos.co.uk"):
            return match
    return None


def suggest_offer(text: str) -> Suggestion:
    lowered = text.lower()
    for key, words, why in OFFER_RULES:
        hits = [word for word in words if re.search(r"\b" + re.escape(word), lowered)]
        if hits:
            return Suggestion(str(key), [why, f"Matched: {', '.join(repr(hit) for hit in hits[:3])}."])
    return Suggestion(
        str(Offer.ASSESSMENT),
        ["Nothing in the text says what stage they are at, so the assessment is the usual first step."],
    )


def suggest_next_action(fields: dict[str, str], missing: list[str]) -> Suggestion:
    no_route = not any(fields.get(name) for name in CONTACT_ROUTE)
    if no_route:
        return Suggestion(
            "Find a contact route (no email or phone in the source)",
            ["There is no email address or phone number to reply to."],
        )
    if "problem_summary" in missing:
        return Suggestion(
            "Reply and ask what the workflow is and what goes wrong",
            ["The problem is not stated clearly enough to qualify."],
        )
    if missing:
        names = ", ".join(FIELD_LABELS[name].lower() for name in missing[:3])
        return Suggestion(f"Reply with questions about {names}", [f"Still blank: {names}."])
    return Suggestion(
        "Book a discovery call",
        ["Problem, outcome and current process are all stated; the next step is to hear it in person."],
    )


def extract(text: str) -> Extraction:
    """Propose brief fields from ``text``. Anything not found stays blank and is listed in ``missing``."""
    source, truncated = clean_source(text)
    result = Extraction(truncated=truncated)
    if not source:
        result.missing = list(REQUIRED)
        return result

    # The AI & Data form composes labelled sections; the guided brief uses headed ones.
    parsed = intake.parse(source) if intake._composed_lines(source) is not None else None
    sections = _sections(source)
    result.guided = bool(sections) or parsed is not None

    email = _first_email(source)
    if email:
        _set(result, source, "contact_email", email.group(0), email.start(), email.end(), keep_value=True)
    phone = PHONE_RE.search(source)
    if phone:
        _set(
            result,
            source,
            "contact_phone",
            phone.group(0).strip(),
            phone.start(),
            phone.end(),
            keep_value=True,
        )

    labelled = {
        "organisation": ("organisation", "organization", "company", "business", "business name"),
        "contact_name": ("name", "contact", "contact name", "your name", "from"),
        "contact_role": ("role", "job title", "position"),
        "timeframe": ("timeframe", "timescale", "timeline"),
    }
    for name, labels in labelled.items():
        item = _label_value(source, labels)
        if item and not (name == "contact_name" and "@" in item[0]):
            _set(result, source, name, item[0][:200], item[1], item[2], keep_value=True)
    if "organisation" not in result.fields:
        org = ORG_SUFFIX_RE.search(source)
        if org:
            _set(
                result,
                source,
                "organisation",
                org.group(1).rstrip("."),
                org.start(1),
                org.start(1) + len(org.group(1).rstrip(".")),
                keep_value=True,
            )
    if "contact_name" not in result.fields:
        sig = re.search(
            r"(?i:my name is|i am|i['’]m|this is)\s+([A-Z][a-z]+(?:\s[A-Z][a-z'\-]+){0,2})(?=[\s,.]|$)",
            source,
        )
        if sig is None:
            sig = re.search(
                r"(?:regards|thanks|thank you|cheers|best)[,!]?\s*\n+\s*([A-Z][a-z]+(?:\s[A-Z][a-z'\-]+){1,2})\s*$",
                source,
                flags=re.MULTILINE | re.IGNORECASE,
            )
        if sig:
            _set(result, source, "contact_name", sig.group(1), sig.start(1), sig.end(1), keep_value=True)

    sector_item = _label_value(source, ("sector", "industry"))
    sector = intake.sector_key(sector_item[0]) if sector_item else ""
    if sector and sector_item:
        _set(result, source, "sector", sector, sector_item[1], sector_item[2], keep_value=True)
    if "sector" not in result.fields:
        lowered = source.lower()
        for key, words in SECTOR_KEYWORDS:
            hit = next((word for word in words if word in lowered), None)
            if hit:
                index = lowered.find(hit)
                _set(result, source, "sector", str(key), index, index + len(hit), keep_value=True)
                break

    budget = re.search(r"budget[^.\n£]{0,40}£\s?([\d,]+)", source, flags=re.IGNORECASE)
    if budget:
        amount = int(budget.group(1).replace(",", "") or 0)
        band = (
            "under-1k"
            if amount < 1000
            else "1k-5k"
            if amount < 5000
            else "5k-15k"
            if amount < 15000
            else "over-15k"
        )
        _set(result, source, "budget_band", band, budget.start(), budget.end(), keep_value=True)
    elif parsed is not None and parsed.budget_band:
        line = re.search(r"Indicative budget:.*", source)
        if line:
            _set(result, source, "budget_band", parsed.budget_band, line.start(), line.end(), keep_value=True)

    for name, (body, start, end) in sections.items():
        _set(result, source, name, body, start, end)

    sentences = _sentences(source)
    if "desired_outcome" not in result.fields:
        picks = _pick(
            sentences,
            r"\b(we want|we'd like|we would like|i want|i'd like|goal|aim|hope to|hoping to|looking to|need to be able)\b",
        )
        if picks:
            _set(result, source, "desired_outcome", picks[0][0], picks[0][1], picks[0][2])
    if "current_tools" not in result.fields:
        picks = _pick(
            sentences,
            r"\b(currently|at the moment|today|manually|by hand|spreadsheet|excel|we use|copy and paste|re-?key)\b",
        )
        if picks:
            _set(result, source, "current_tools", picks[0][0], picks[0][1], picks[0][2])
    if "timeframe" not in result.fields:
        when = re.search(
            r"\b(asap|urgent(?:ly)?|within (?:the next )?\w+ (?:days|weeks|months)|by (?:the end of )?(?:january|february|march|april|may|june|july|august|september|october|november|december|q[1-4]|the end of the (?:month|year|quarter))|next (?:month|quarter))\b",
            source,
            flags=re.IGNORECASE,
        )
        if when:
            _set(result, source, "timeframe", when.group(0), when.start(), when.end(), keep_value=True)
    if "problem_summary" not in result.fields:
        # No headings: the sentences that state the problem, not greetings, contact lines or fields
        # already taken. Left blank (and flagged) when nothing qualifies.
        taken = [(item.start, item.end) for item in result.evidence]
        free = [
            item
            for item in sentences
            if not any(item[1] < end and start < item[2] for start, end in taken)
            and not EMAIL_RE.search(item[0])
            and not PHONE_RE.search(item[0])
            and not re.match(
                r"(hi|hello|dear|thanks|thank you|regards|cheers)\b", item[0], flags=re.IGNORECASE
            )
        ]
        signal = r"\b(problem|struggl|takes? (?:us )?(?:hours|days)|waste|error|mistake|chas|manual|slow|hard|lose|lost|miss|pain|issue|stuck|backlog)\b"
        picks = _pick(free, signal, 2) or free[:1]
        if picks:
            start, end = picks[0][1], picks[-1][2]
            _set(result, source, "problem_summary", source[start:end], start, end)

    topic = _label_value(source, ("topic",))
    if topic:
        result.topic = topic[0][:60]
    context = (
        " ".join(
            result.fields.get(name, "") for name in ("problem_summary", "desired_outcome", "current_tools")
        )
        or source
    )
    result.missing = [name for name in REQUIRED if not result.fields.get(name)]
    if not any(result.fields.get(name) for name in CONTACT_ROUTE):
        result.missing.append("contact_email")
    result.offer = suggest_offer(context)
    result.next_action = suggest_next_action(result.fields, result.missing)
    return result


def highlight_segments(source: str, evidence: list[dict], active: str = "") -> list[dict]:
    """Split ``source`` into display segments; spans that carry evidence get their field name.

    Overlapping spans keep the earlier one. Used by the source panel to mark quoted text.
    """
    spans = sorted(
        (int(item["start"]), int(item["end"]), item["field"])
        for item in evidence
        if 0 <= int(item["start"]) < int(item["end"]) <= len(source)
    )
    segments, cursor = [], 0
    for start, end, name in spans:
        if start < cursor:
            continue
        if start > cursor:
            segments.append({"text": source[cursor:start], "field": ""})
        segments.append(
            {
                "text": source[start:end],
                "field": name,
                "label": FIELD_LABELS.get(name, name),
                "active": name == active,
            }
        )
        cursor = end
    if cursor < len(source):
        segments.append({"text": source[cursor:], "field": ""})
    return segments
