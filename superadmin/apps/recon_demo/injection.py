"""Flag instruction-like text in a statement (prompt-injection screening, blueprint §13.4).

A flag never changes the deterministic results: it adds a review item and keeps the run out of
COMPLETED. Flagged lines are also never sent to the model. The patterns are deliberately broad;
a false positive costs a reviewer a glance, a false negative is covered by grounding.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

SCANNER_VERSION = "injection_rules@1"
PATTERNS: tuple[tuple[str, re.Pattern], ...] = tuple(
    (name, re.compile(pattern, re.IGNORECASE))
    for name, pattern in (
        (
            "ignore instructions",
            r"\b(ignore|disregard|forget|override)\b.{0,40}\b(instructions?|rules|prompt|above|previous)\b",
        ),
        (
            "mark as matched",
            r"\b(mark|treat|record|report|flag)\b.{0,30}\b(all|every|everything|each)\b.{0,30}\b(matched|reconciled|paid|cleared|correct|approved)\b",
        ),
        ("suppress findings", r"\bdo not\b.{0,20}\b(flag|report|mention|review|check)\b"),
        (
            "role change",
            r"\b(you are now|act as|pretend to be|new instructions|system prompt|developer mode)\b",
        ),
        ("chat transcript", r"^\s*(system|assistant|user)\s*:"),
        ("approval request", r"\b(approve|authori[sz]e)\b.{0,20}\b(all|this|payment|immediately)\b"),
    )
)


@dataclass(frozen=True)
class InjectionFlag:
    source_line: int
    pattern: str

    def to_dict(self) -> dict:
        return {"source_line": self.source_line, "pattern": self.pattern}


def scan(text: str) -> list[InjectionFlag]:
    flags = []
    for number, line in enumerate(text.splitlines(), start=1):
        for name, pattern in PATTERNS:
            if pattern.search(line):
                flags.append(InjectionFlag(number, name))
                break
    return flags
