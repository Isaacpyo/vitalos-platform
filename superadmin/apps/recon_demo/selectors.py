"""Reads and presentation helpers for the demonstrator pages (no writes)."""

from __future__ import annotations

import json
from pathlib import Path

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, has_role

from .models import ReconRun
from .reconcile import CLASS_LABELS

REPORT_DIR = Path(__file__).resolve().parent / "reports" / "v1"
ROLES = (SUPERADMIN, SERVICE_LEAD)
STATE_TONES = {
    "COMPLETED": "green",
    "REVIEW_REQUIRED": "amber",
    "FAILED": "red",
    "UNSUPPORTED": "slate",
    "CANCELLED": "slate",
    "RUNNING": "blue",
    "CREATED": "blue",
    "NOTE": "sky",
}
LINE_ROLES = {
    "rules": "Read by the parser",
    "model": "Extracted by the model path and grounded",
    "review": "Needs review",
    "flagged": "Instruction-like text",
    "balance": "Balance line",
}


def can_access(user) -> bool:
    return has_role(user, *ROLES)


def runs(limit: int = 100):
    return ReconRun.objects.select_related("created_by").order_by("-number")[:limit]


def get_run(ref: str) -> ReconRun | None:
    if not ref.startswith("RUN-") or not ref[4:].isdigit():
        return None
    return ReconRun.objects.filter(number=int(ref[4:])).first()


def source_lines(run: ReconRun) -> list[dict]:
    """The statement with line numbers and what happened to each line (for highlighting)."""
    results = run.results or {}
    roles: dict[int, str] = {}
    for line in results.get("lines", []):
        roles[line["source_line"]] = "model" if line.get("origin") == "model" else "rules"
    balance = results.get("balance") or {}
    for key in ("opening_line", "closing_line"):
        if balance.get(key):
            roles.setdefault(balance[key], "balance")
    for item in results.get("review_items", []):
        for number in item.get("source_lines", []):
            if item["kind"] == "instruction_like_text":
                roles[number] = "flagged"
            elif item["kind"] == "manual_extraction":
                roles[number] = "review"
            elif item["kind"] == "ungrounded_line":
                # A rejected model line may cite a line that another, grounded line was read from.
                roles.setdefault(number, "review")
    for row in results.get("unparsed", []):
        roles.setdefault(row["source_line"], "review")
    return [
        {
            "number": number,
            "text": text,
            "role": roles.get(number, ""),
            "role_label": LINE_ROLES.get(roles.get(number, ""), ""),
        }
        for number, text in enumerate(run.statement_text.splitlines(), start=1)
    ]


def reconciliation_rows(run: ReconRun) -> list[dict]:
    return [
        {**item, "label": CLASS_LABELS.get(item["class"], item["class"])}
        for item in (run.results or {}).get("reconciliation", [])
    ]


def summary_counts() -> dict:
    counts = {state: 0 for state in ReconRun.State.values}
    for state in ReconRun.objects.values_list("state", flat=True):
        counts[state] = counts.get(state, 0) + 1
    return counts


METRIC_ROWS = (
    ("cases", "Cases", "count"),
    ("stateAccuracy", "Final state accuracy", "pct"),
    ("fieldAccuracy", "Field accuracy (parser layouts)", "pct"),
    ("lineRecall", "Line recall", "pct"),
    ("linePrecision", "Line precision", "pct"),
    ("exceptionRecall", "Exception recall", "pct"),
    ("exceptionPrecision", "Exception precision", "pct"),
    ("unsafeAccepts", "Unsafe accepts", "count"),
    ("modelFieldAccuracy", "Model-path field accuracy (simulated: not model quality)", "pct"),
    ("modelCalls", "Model calls", "count"),
    ("costPerCaseGbp", "Estimated cost per case (GBP)", "gbp"),
)


def _fmt(value, kind: str) -> str:
    if value is None:
        return "n/a"
    if kind == "pct":
        return f"{value * 100:.1f}%"
    if kind == "gbp":
        return f"£{value:.6f}".rstrip("0").rstrip(".") if value else "£0"
    return str(value)


def latest_report() -> dict | None:
    """The committed evaluation report, shaped for the page (criteria and metrics per configuration)."""
    path = REPORT_DIR / "report.json"
    if not path.is_file():
        return None
    report = json.loads(path.read_text(encoding="utf-8"))
    configs = report.get("configs", [])
    timings = report.get("timings", {})
    report["criteria_rows"] = [
        {
            **criterion,
            "cells": [criterion.get("configs", {}).get(config["id"]) for config in configs],
        }
        for criterion in report.get("criteria", [])
    ]
    report["metric_rows"] = [
        {"label": label, "values": [_fmt(config["metrics"].get(key), kind) for config in configs]}
        for key, label, kind in METRIC_ROWS
    ]
    report["metric_rows"].append(
        {
            "label": "p95 duration per case (this machine)",
            "values": [f"{timings.get(c['id'], {}).get('p95_ms', 0)} ms" for c in configs],
        }
    )
    report["case_rows"] = [
        {
            "id": case["id"],
            "split": case["split"],
            "states": [
                next((c["output"].get("state") for c in config["cases"] if c["id"] == case["id"]), None)
                for config in configs
            ],
        }
        for case in (configs[0]["cases"] if configs else [])
    ]
    return report
