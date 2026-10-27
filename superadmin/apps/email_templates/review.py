"""Review rules for library templates (email audit, October 2026; docs/email/REVIEW.md).

``seed_problems`` stops a seed from loading; these are review findings: warnings a person or an agent
fixes in the seed files. They check the rendered email (with each variable's fallback), so a subject
that is short as written but long once merged is caught.
"""

from __future__ import annotations

import re
from collections import defaultdict

from apps.mailer import layout

from .models import OPT_OUT_KINDS
from .rendering import render_content
from .variables import VARIABLES

SUBJECT_MAX = 60
PREHEADER_MIN, PREHEADER_MAX = 40, 100
LABEL_MAX_WORDS = 2
#: docs/relay/reference/brand/messaging.md, "Rules".
BANNED_WORDS = ("revolutionary", "cutting-edge", "unleash", "supercharge", "magic")
#: Names that are not sentence-case mistakes when capitalised mid-subject.
PROPER_NOUNS = {
    "Vitalos", "Askbridge", "Relay", "Answerd", "Autofix", "Workforce", "Super", "Admin", "AI", "UK", "GDPR",
    "VAT", "Q1", "Q2", "Q3", "Q4", "I", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
    "Sunday", "January", "February", "March", "April", "May", "June", "July", "August", "September",
    "October", "November", "December", "Microsoft", "Google", "Zoom", "Teams",
}  # fmt: skip
#: Templates only the founder sends, which may sign with a fixed name (a text sign-off, not the
#: signature block, which signs as whoever is signed in).
FOUNDER_ONLY: set[str] = {"outreach-small-business-free-plan"}
HARD_CODED_PEOPLE = re.compile(r"\b(Temitope|Agbola)\b")
EMOJI = re.compile("[\U0001f300-\U0001faff☀-➿]")
VARIABLE = re.compile(r"\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}")


def _texts(item: dict) -> list[str]:
    out = [item.get("subject") or "", item.get("preheader") or ""]
    for block in item.get("blocks") or []:
        for key in ("text", "label", "title", "expiry"):
            if block.get(key):
                out.append(block[key])
        for entry in block.get("items") or []:
            out += list(entry.values()) if isinstance(entry, dict) else [entry]
        for row in block.get("rows") or []:
            out += list(row.values()) if isinstance(row, dict) else list(row)
    return [str(text) for text in out]


#: Proper names of more than one word (practices and products), allowed capitalised mid-subject.
PROPER_PHRASES = ("Managed Services", "AI & Data", "Super Admin")


def _not_sentence_case(subject: str) -> bool:
    for phrase in PROPER_PHRASES:
        subject = subject.replace(phrase, "x")
    words = VARIABLE.sub("x", subject).split()[1:]
    capitalised = [
        word
        for word in words
        if word[:1].isupper() and not word.isupper() and word.strip(".,:;?()") not in PROPER_NOUNS
    ]
    return len(capitalised) > 1


def review_problems(item: dict) -> list[str]:
    """Review findings for one template (a seed item or ``EmailTemplate.content()`` plus ``key``)."""
    problems: list[str] = []
    rendered = render_content(item, {}, key=item.get("key", "review"))
    subject = rendered.subject
    preheader = layout.clean_line(rendered.preheader)
    if len(subject) > SUBJECT_MAX:
        problems.append(f"subject is {len(subject)} characters rendered (max {SUBJECT_MAX}): {subject!r}")
    if _not_sentence_case(item.get("subject") or ""):
        problems.append(f"subject is not sentence case: {item.get('subject')!r}")
    if not PREHEADER_MIN <= len(preheader) <= PREHEADER_MAX:
        problems.append(
            f"preheader is {len(preheader)} characters rendered ({PREHEADER_MIN}–{PREHEADER_MAX})"
        )
    if preheader and preheader.lower() == subject.lower():
        problems.append("preheader repeats the subject")
    label = [word for word in (item.get("header_label") or "").split() if word != "&"]
    if len(label) > LABEL_MAX_WORDS:
        problems.append(f"header label has {len(label)} words (max {LABEL_MAX_WORDS})")
    buttons = [b for b in item.get("blocks") or [] if b.get("type") == "button"]
    if len(buttons) > 1:
        problems.append(f"{len(buttons)} buttons (one primary at most)")
    for block in rendered.document["blocks"]:
        if block["type"] == "button" and not layout.is_safe_url(layout.clean_line(block["url"])):
            problems.append(f"button {block['label']!r} has no https: or mailto: link once merged")
    if item.get("kind") in OPT_OUT_KINDS and not (item.get("reason") or "").strip():
        problems.append("outreach or marketing without a reason line")
    texts = _texts(item)
    joined = "\n".join(texts)
    if "!" in joined:
        problems.append("exclamation mark")
    if EMOJI.search(joined):
        problems.append("emoji")
    banned = sorted({word for word in BANNED_WORDS if re.search(rf"\b{word}\b", joined, re.IGNORECASE)})
    if banned:
        problems.append(f"banned words {banned}")
    if item.get("key") not in FOUNDER_ONLY and HARD_CODED_PEOPLE.search(joined):
        problems.append("hard-coded person (use {{sender_name}})")
    unknown = sorted({m.strip("{} ") for m in VARIABLE.findall(joined)} - set(VARIABLES))
    if unknown:
        problems.append(f"unknown variables {unknown}")
    return problems


def label_consistency(items: list[dict]) -> list[str]:
    """Categories whose templates use more than one header label (a finding to look at, not a rule)."""
    labels: dict[str, set[str]] = defaultdict(set)
    for item in items:
        labels[item.get("category", "?")].add(item.get("header_label") or "")
    return [f"{category}: {sorted(found)}" for category, found in sorted(labels.items()) if len(found) > 1]
