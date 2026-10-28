"""Read an AI & Data enquiry's fields from the website's notification text (best effort, pure functions).

The AI & Data form composes its fields into the enquiry goal (docs/ai-data/PLAN.md, "Composed enquiry
text"). The website notification quotes the goal line by line with "> " and lists contact details as
"Label: value" rows. Anything that cannot be read is left blank; nothing here can fail the intake.
"""

import re
from dataclasses import dataclass

from .models import BudgetBand, Sector

PIPELINE_HEADER = "X-Vitalos-Pipeline"
OFFER_HEADER = "X-Vitalos-Offer"
PIPELINE_VALUE = "ai-data"
MARKER = "Vitalos AI & Data enquiry"
NOT_GIVEN = ("not given", "not provided", "")
MAX_TEXT = 4000
MAX_LINE = 200

SECTIONS = {
    "business problem or workflow:": "problem",
    "current tools and process:": "tools",
    "desired outcome:": "outcome",
}
_BAND_BY_LABEL = {label.lower(): key for key, label in BudgetBand.choices}


@dataclass
class IntakeFields:
    sector: str = ""
    problem: str = ""
    tools: str = ""
    outcome: str = ""
    budget_band: str = ""
    organisation: str = ""
    role: str = ""
    timeframe: str = ""


def truncate(text: str, limit: int = MAX_TEXT) -> str:
    """Trim to ``limit`` characters on a word boundary where possible, marking the cut with an ellipsis."""
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    space = cut.rfind(" ")
    if space > limit // 2:
        cut = cut[:space]
    return cut.rstrip() + "…"


def _clean(value: str, limit: int = MAX_LINE) -> str:
    value = " ".join((value or "").split())
    return "" if value.lower() in NOT_GIVEN else value[:limit]


def _composed_lines(text: str) -> list[str] | None:
    """The composed goal's lines (quote marks removed), or None when the marker is absent."""
    lines = (text or "").replace("\r\n", "\n").split("\n")
    for index, line in enumerate(lines):
        if line.lstrip("> ").strip() == MARKER:
            quoted = line.lstrip().startswith(">")
            body = []
            for following in lines[index + 1 :]:
                if quoted and not following.lstrip().startswith(">"):
                    break
                body.append(re.sub(r"^\s*> ?", "", following) if quoted else following)
            return body
    return None


def _words(value: str) -> list[str]:
    return re.sub(r"[^a-z0-9]+", " ", value.lower().replace("&", " and ")).split()


def sector_key(value: str) -> str:
    """The sector key for a form label or key ("Accounting & bookkeeping", "property"…), else blank."""
    value = _clean(value).lower()
    if value in Sector.values:
        return value
    words = _words(value)
    if not words:
        return ""
    for key, label in Sector.choices:
        if words == _words(label) or words[0] == _words(key)[0]:
            return key
    return ""


def _row(text: str, label: str) -> str:
    match = re.search(rf"^{re.escape(label)}: (.+)$", text or "", flags=re.MULTILINE)
    return _clean(match.group(1)) if match else ""


def parse(text: str) -> IntakeFields:
    fields = IntakeFields(
        organisation=_row(text, "Organisation"),
        role=_row(text, "Role")[:120],
        timeframe=re.sub(r"\s*\(.*\)$", "", _row(text, "Timeframe"))[:120],
    )
    lines = _composed_lines(text)
    if lines is None:
        fields.problem = truncate(text)
        return fields
    current = None
    buffers: dict[str, list[str]] = {name: [] for name in SECTIONS.values()}
    for line in lines:
        lowered = line.strip().lower()
        if lowered.startswith("sector:"):
            fields.sector = sector_key(line.split(":", 1)[1])
            current = None
        elif lowered.startswith("indicative budget:"):
            value = re.sub(r"\s*\(enquirer's estimate\)\s*$", "", line.split(":", 1)[1].strip())
            value = _clean(value).lower()
            fields.budget_band = _BAND_BY_LABEL.get(value) or (value if value in BudgetBand.values else "")
            current = None
        elif lowered in SECTIONS:
            current = SECTIONS[lowered]
        elif current:
            buffers[current].append(line)
    fields.problem = truncate("\n".join(buffers["problem"]))
    fields.tools = truncate(_clean_block(buffers["tools"]))
    fields.outcome = truncate(_clean_block(buffers["outcome"]))
    if not fields.problem:
        fields.problem = truncate("\n".join(lines))
    return fields


def _clean_block(lines: list[str]) -> str:
    text = "\n".join(lines).strip()
    return "" if text.lower() in NOT_GIVEN else text
