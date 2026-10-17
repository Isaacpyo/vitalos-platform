"""Bring the architecture tree in line with the website (findings E4 and F6, ADR-049).

Source: ``apps/architecture/data/web-architecture.json``, exported from the website's repo content by
``tooling/content/export-architecture.ts`` (the same copy the public pages render). The website's
taxonomy is a web (a solution spans several practices); the admin's is a tree, so:

- each website practice becomes the Practice of the service line with the same slug (six, Labs last);
- each solution goes under the first practice it lists (the content's own lead practice);
- each offer goes under the first solution that lists it.

Records are matched by slug under their parent. New records are created Active (they describe pages
that are live); existing records get the website's name, summary, order and public URL. Nothing is
archived or deleted, and records the website does not have are only reported. A dry run unless
``apply=True``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from django.conf import settings
from django.db import transaction

from .models import Offer, OfferingStatus, Practice, ServiceLine, Solution
from .services import save_record

DATA_PATH = Path(__file__).resolve().parent / "data" / "web-architecture.json"
FIELDS = ("name", "summary", "order", "public_url")


@dataclass
class SyncReport:
    created: list[str] = field(default_factory=list)
    updated: list[str] = field(default_factory=list)
    unchanged: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    not_on_website: list[str] = field(default_factory=list)

    def lines(self) -> list[str]:
        out = [f"create     {item}" for item in self.created]
        out += [f"update     {item}" for item in self.updated]
        out += [f"skip       {item}" for item in self.skipped]
        out += [f"admin only {item}" for item in self.not_on_website]
        return out


def load(path: Path = DATA_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def website_base() -> str:
    targets = getattr(settings, "CONTENT_WEB_TARGETS", None) or []
    return (targets[0] if targets else "https://vitalos.co.uk").rstrip("/")


def _upsert(model, parent_field: str, parent, item: dict, report: SyncReport, label: str):
    values = {
        "name": item["title"][:150],
        "summary": item.get("summary", ""),
        "order": int(item.get("order", 0)),
        "public_url": f"{website_base()}{item['path']}",
    }
    existing = model.objects.filter(**{parent_field: parent, "slug": item["slug"]}).first()
    if existing is None:
        report.created.append(f"{label} {item['slug']} ({values['name']})")
        obj = model(**{parent_field: parent}, slug=item["slug"], status=OfferingStatus.ACTIVE, **values)
        return save_record(obj, None, reason="Synced from the website")
    changes = [name for name in FIELDS if getattr(existing, name) != values[name]]
    if not changes:
        report.unchanged.append(f"{label} {item['slug']}")
        return existing
    report.updated.append(f"{label} {item['slug']}: {', '.join(changes)}")
    for name in changes:
        setattr(existing, name, values[name])
    return save_record(existing, None, reason="Synced from the website")


def sync(data: dict | None = None, *, apply: bool = False) -> SyncReport:
    """Make (or, in a dry run, rehearse and roll back) the changes. Returns what changed."""
    data = data or load()
    report = SyncReport()
    lines = {line.slug: line for line in ServiceLine.objects.all()}
    practices: dict[str, Practice] = {}
    solutions: dict[str, Solution] = {}
    with transaction.atomic():
        for item in data["practices"]:
            line = lines.get(item["slug"])
            if line is None:
                report.skipped.append(f"practice {item['slug']}: no service line with that slug")
                continue
            practices[item["slug"]] = _upsert(Practice, "service_line", line, item, report, "practice")
        for item in data["solutions"]:
            lead = next((practices[slug] for slug in item.get("practices", []) if slug in practices), None)
            if lead is None:
                report.skipped.append(f"solution {item['slug']}: none of its practices is in the tree")
                continue
            solutions[item["slug"]] = _upsert(Solution, "practice", lead, item, report, "solution")
        for item in data["offers"]:
            parent = next((solutions[slug] for slug in item.get("solutions", []) if slug in solutions), None)
            if parent is None:
                report.skipped.append(f"offer {item['slug']}: none of its solutions is in the tree")
                continue
            _upsert(Offer, "solution", parent, item, report, "offer")
        known = {
            "practice": {p["slug"] for p in data["practices"]},
            "solution": {s["slug"] for s in data["solutions"]},
            "offer": {o["slug"] for o in data["offers"]},
        }
        for label, model in (("practice", Practice), ("solution", Solution), ("offer", Offer)):
            for obj in model.objects.filter(is_archived=False).exclude(slug__in=known[label]):
                report.not_on_website.append(f"{label} {obj.slug} ({obj.name})")
        if not apply:
            transaction.set_rollback(True)  # a dry run rehearses every write, then undoes it
    return report
