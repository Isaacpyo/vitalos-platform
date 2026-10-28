"""Discovery pack helpers (pure): the rules-based reader of meeting notes and payload hygiene.

The pack is: summary, an ordered workflow map (actor, system, input, output, action), requirements,
assumptions, unknowns, acceptance criteria and contradictions. ``from_notes`` reads notes with plain
rules (no model): numbered or arrowed lines become workflow steps; sentences with must/need/should
become requirements; "assume" lines assumptions; questions and "not sure/tbc/unknown" lines unknowns;
"done when/accept" lines acceptance criteria. Each item keeps a quote of the notes it came from, so a
reviewer can check it. Anything it cannot read stays out: nothing is invented.
"""

from __future__ import annotations

import re

from .extraction import MAX_SOURCE, clean_source, find_quote

LIST_KEYS = ("requirements", "assumptions", "unknowns", "acceptance_criteria")
SECTION_LABELS = {
    "requirements": "Requirement",
    "assumptions": "Assumption",
    "unknowns": "Unknown",
    "acceptance_criteria": "Acceptance criterion",
    "workflow_steps": "Workflow step",
}
STEP_FIELDS = ("actor", "system", "input", "output", "action")
MAX_ITEMS = 40

_STEP_LINE = re.compile(
    r"^\s*(?:\d{1,2}[.)]|step\s*\d{1,2}[:.)]?|[-*]\s*(?:then|next|first|finally)\b)\s*(.+\S)\s*$", re.I
)
_ARROW = re.compile(r"\s*(?:->|→|=>|>>)\s*")
_REQ = re.compile(
    r"\b(must|needs? to|need(?:s)? it to|should|has to|have to|required|requirement|want(?:s)? it to)\b", re.I
)
_ASSUME = re.compile(r"\b(assum(?:e|ing|ption)|presumably|we think|probably)\b", re.I)
_UNKNOWN = re.compile(
    r"(\?|\b(not sure|unsure|don'?t know|do not know|unknown|tbc|tbd|to be confirmed|no idea|need to check)\b)",
    re.I,
)
_ACCEPT = re.compile(
    r"\b(done when|accept(?:ed|ance)?|success (?:is|means|looks)|good looks like|we(?:'ll| will) know it works|target)\b",
    re.I,
)
_ACTOR = re.compile(
    r"^(?P<actor>[A-Z][\w ]{1,30}?)\s+(?:then\s+)?(?:(?:re-?)?(?:enters?|sends?|checks?|reviews?|copies|opens?|exports?|uploads?|emails?|approves?|updates?|chases?|types?|downloads?|files?|logs?|reconciles?|matches|compares|marks|prints?|calls?|keys?)\b)"
)
_SYSTEM = re.compile(
    r"\b(?:in|into|on|from|via|using|to)\s+((?:[A-Z][\w.&-]+)(?:\s[A-Z][\w.&-]+)?|excel|outlook|gmail|spreadsheet|the (?:shared )?(?:mailbox|inbox|portal|erp|crm))",
    re.I,
)


def _lines(source: str) -> list[tuple[str, int, int]]:
    out, pos = [], 0
    for raw in source.split("\n"):
        text = raw.strip()
        if text:
            start = pos + (len(raw) - len(raw.lstrip()))
            out.append((text, start, start + len(text)))
        pos += len(raw) + 1
    return out


def _sentences(text: str, start: int) -> list[tuple[str, int, int]]:
    out = []
    for match in re.finditer(r"[^.!?;]+[.!?;]?", text):
        piece = match.group(0).strip()
        if len(piece) >= 10:
            begin = start + match.start() + (len(match.group(0)) - len(match.group(0).lstrip()))
            out.append((piece, begin, begin + len(piece)))
    return out


def _empty_step() -> dict:
    return {
        "actor": "",
        "system": "",
        "input": "",
        "output": "",
        "action": "",
        "quote": "",
        "start": None,
        "end": None,
    }


def _step_from(text: str, start: int, end: int) -> dict:
    step = _empty_step()
    parts = _ARROW.split(text)
    if len(parts) >= 2:
        step["input"], step["action"], step["output"] = (
            (parts + ["", ""])[0].strip(),
            parts[1].strip() if len(parts) > 2 else "",
            parts[-1].strip(),
        )
        if len(parts) == 2:
            step["action"] = ""
    else:
        step["action"] = text
    actor = _ACTOR.match(text)
    if actor:
        step["actor"] = actor.group("actor").strip()
    system = _SYSTEM.search(text)
    if system:
        step["system"] = system.group(1).strip()
    step["quote"], step["start"], step["end"] = text, start, end
    return step


def empty_pack() -> dict:
    return {
        "summary": "",
        "workflow_steps": [],
        "requirements": [],
        "assumptions": [],
        "unknowns": [],
        "acceptance_criteria": [],
        "contradictions": [],
    }


def from_notes(notes: str) -> dict:
    """Read meeting notes with rules only. Returns a pack where each item has text, quote, start, end."""
    source, _ = clean_source(notes)
    pack = empty_pack()
    seen: set[tuple[str, str]] = set()

    def add(kind: str, text: str, start: int, end: int):
        key = (kind, text.lower())
        if key in seen or len(pack[kind]) >= MAX_ITEMS:
            return
        seen.add(key)
        pack[kind].append({"text": text[:400], "quote": source[start:end], "start": start, "end": end})

    for text, start, _end in _lines(source):
        step_line = _STEP_LINE.match(text) or (_ARROW.search(text) and re.match(r"^\W*\w", text))
        if step_line:
            body = _STEP_LINE.match(text).group(1) if _STEP_LINE.match(text) else text
            offset = text.find(body)
            if len(pack["workflow_steps"]) < MAX_ITEMS:
                pack["workflow_steps"].append(
                    _step_from(body, start + max(offset, 0), start + max(offset, 0) + len(body))
                )
            continue
        for sentence, s_start, s_end in _sentences(text, start):
            if _ACCEPT.search(sentence):
                add("acceptance_criteria", sentence, s_start, s_end)
            elif _UNKNOWN.search(sentence):
                add("unknowns", sentence, s_start, s_end)
            elif _ASSUME.search(sentence):
                add("assumptions", sentence, s_start, s_end)
            elif _REQ.search(sentence):
                add("requirements", sentence, s_start, s_end)
    return pack


def _verify_quote(source: str, item: dict, *, required: bool) -> tuple[dict | None, bool]:
    """Attach a verified span to ``item``. Returns (item or None, had_unsupported_quote)."""
    quote = (item.get("quote") or "").strip()
    span = find_quote(source, quote) if quote else None
    if span:
        item = {**item, "quote": source[span[0] : span[1]], "start": span[0], "end": span[1]}
        return item, False
    if required:
        return None, True
    return {**item, "quote": "", "start": None, "end": None}, bool(quote)


def sanitise_ai_pack(output: dict, notes: str) -> tuple[dict, list[str]]:
    """Validated model output -> pack. Workflow steps and requirements without a real quote are dropped."""
    source, _ = clean_source(notes)
    pack = empty_pack()
    warnings: list[str] = []
    pack["summary"] = (output.get("summary") or "").strip()
    dropped = 0
    for step in output.get("workflow_steps", []):
        checked, bad = _verify_quote(source, step, required=True)
        if checked is None:
            dropped += 1
            continue
        pack["workflow_steps"].append(
            {k: (checked.get(k) or "").strip() for k in STEP_FIELDS}
            | {"quote": checked["quote"], "start": checked["start"], "end": checked["end"]}
        )
    for kind in LIST_KEYS:
        for item in output.get(kind, []):
            required = kind == "requirements"
            checked, bad = _verify_quote(source, item, required=required)
            if checked is None:
                dropped += 1
                continue
            if bad and kind != "assumptions":
                warnings.append(
                    f"A {SECTION_LABELS[kind].lower()} quoted text that is not in the notes; the quote was removed."
                )
            pack[kind].append(
                {
                    "text": (checked.get("text") or "").strip(),
                    **{k: checked[k] for k in ("quote", "start", "end")},
                }
            )
    pack["contradictions"] = [c.strip() for c in output.get("contradictions", []) if c.strip()]
    if dropped:
        warnings.append(
            f"{dropped} item(s) the model proposed had no matching quote in the notes and were not kept."
        )
    return pack, warnings


def evidence_for_pack(pack: dict) -> list[dict]:
    """Source spans of every item that has one, labelled by section, for the source panel."""
    evidence = []
    for kind in ("workflow_steps", *LIST_KEYS):
        for index, item in enumerate(pack.get(kind, []), start=1):
            if item.get("start") is not None and item.get("end") is not None:
                evidence.append(
                    {
                        "field": f"{kind}.{index}",
                        "quote": item.get("quote", ""),
                        "start": item["start"],
                        "end": item["end"],
                        "label": f"{SECTION_LABELS[kind]} {index}",
                    }
                )
    return evidence


def normalise_pack(data: dict) -> dict:
    """Coerce an edited pack (from a form) into the stored shape; strips blanks and caps sizes."""
    pack = empty_pack()
    pack["summary"] = str(data.get("summary", "")).strip()[:600]
    for step in data.get("workflow_steps", [])[:MAX_ITEMS]:
        row = {k: str(step.get(k, "")).strip()[:400] for k in STEP_FIELDS}
        if any(row.values()):
            row.update({k: step.get(k) for k in ("quote", "start", "end")})
            pack["workflow_steps"].append(row)
    for kind in LIST_KEYS:
        for item in data.get(kind, [])[:MAX_ITEMS]:
            text = str(item.get("text", "")).strip()[:400]
            if text:
                pack[kind].append({"text": text, **{k: item.get(k) for k in ("quote", "start", "end")}})
    pack["contradictions"] = [str(c).strip()[:400] for c in data.get("contradictions", []) if str(c).strip()]
    return pack


def approval_blockers(pack: dict) -> list[str]:
    """What stops a discovery pack being approved. Empty means it can be."""
    blockers = []
    if not pack.get("workflow_steps"):
        blockers.append("Add at least one workflow step.")
    if not pack.get("requirements"):
        blockers.append("Add at least one requirement.")
    if not pack.get("acceptance_criteria"):
        blockers.append("Add at least one acceptance criterion.")
    return blockers


__all__ = [
    "MAX_SOURCE",
    "approval_blockers",
    "empty_pack",
    "evidence_for_pack",
    "from_notes",
    "normalise_pack",
    "sanitise_ai_pack",
]
