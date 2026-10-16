"""Import Insights and roles exported from the repo content source (ADR-028) as DRAFTS (amendment A7).

    manage.py import_repo_content export.json            # dry run: prints what would happen
    manage.py import_repo_content export.json --apply    # writes drafts

The file is ``{"posts": [...], "roles": [...]}``, written by the website's export script. Items are
matched by ``sourcePath``, so running it again changes nothing. Only drafts are created: nothing is
published or opened. Items marked as placeholders are refused. Authors are matched by name; an unknown
name creates an UNCONFIRMED author (confirming a real person stays a human step).
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.audit.services import record
from apps.careers import services as careers_services
from apps.careers.models import (
    ApplyMode,
    EmploymentType,
    Level,
    Role,
    SalaryPeriod,
    Sponsorship,
    WorkModel,
)
from apps.content_sync import formatting
from apps.content_sync.choices import Practice
from apps.insights import services as insights_services
from apps.insights.models import Author, Post, PostAuthor, PostFormat, PostTopic, Topic

MAX_BYTES = 20 * 1024 * 1024
ROLE_TEXT = {
    "about": "about_md",
    "responsibilities": "responsibilities_md",
    "requirements": "requirements_md",
    "niceToHave": "nice_to_have_md",
    "process": "process_md",
}


def _placeholder(item: dict) -> bool:
    return bool(item.get("placeholder") or item.get("isPlaceholder") or item.get("status") == "placeholder")


def _str(item: dict, *names: str, limit: int | None = None) -> str:
    for name in names:
        value = item.get(name)
        if isinstance(value, str):
            return value.strip()[:limit] if limit else value.strip()
    return ""


def _choice(value, choices) -> str:
    value = (value or "").replace("-", "_") if isinstance(value, str) else ""
    return value if value in choices.values else ""


class Command(BaseCommand):
    help = "Import repo-file Insights and roles as drafts (dry run unless --apply)."

    def add_arguments(self, parser):
        parser.add_argument("path", help="JSON export: {posts: [...], roles: [...]}")
        parser.add_argument("--apply", action="store_true", help="Write the drafts (default: dry run).")

    def handle(self, *args, path, apply=False, **options):
        file = Path(path)
        if not file.is_file() or file.stat().st_size > MAX_BYTES:
            raise CommandError("The export file is missing or larger than 20 MB.")
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
        except ValueError as exc:
            raise CommandError(f"The export is not valid JSON ({exc.__class__.__name__}).") from None
        if not isinstance(data, dict):
            raise CommandError("The export must be an object with posts and roles.")
        plan = {"created": 0, "skipped": 0, "refused": 0}
        with transaction.atomic():
            for item in data.get("posts") or []:
                self._post(item, plan, apply)
            for item in data.get("roles") or []:
                self._role(item, plan, apply)
            if apply and plan["created"]:
                record("content.imported", summary=f"Imported {plan['created']} drafts", **plan)
        mode = "Imported" if apply else "Dry run (use --apply to write)"
        self.stdout.write(
            f"{mode}: created={plan['created']} skipped={plan['skipped']} refused={plan['refused']}"
        )

    def _skip_reason(self, item, model) -> str:
        if not isinstance(item, dict):
            return "not an object"
        source = _str(item, "sourcePath", limit=300)
        if not source:
            return "no sourcePath"
        if _placeholder(item):
            return "marked as a placeholder"
        if not _str(item, "title"):
            return "no title"
        if model.objects.filter(source_path=source).exists():
            return "already imported"
        return ""

    def _post(self, item, plan, apply):
        reason = self._skip_reason(item, Post)
        source = _str(item, "sourcePath", limit=300) if isinstance(item, dict) else ""
        if reason:
            plan["skipped" if reason == "already imported" else "refused"] += 1
            self.stdout.write(f"post {source or '?'}: {reason}")
            return
        title = _str(item, "title", limit=200)
        fmt = _choice(item.get("format"), PostFormat) or PostFormat.INSIGHT_ARTICLE
        self.stdout.write(f"post {source}: create draft {title!r}")
        plan["created"] += 1
        if not apply:
            return
        post = Post.objects.create(
            title=title,
            slug=insights_services.unique_slug(_str(item, "slug") or title),
            format=fmt,
            excerpt=_str(item, "excerpt", limit=220),
            body_md=_str(item, "bodyMarkdown", "body"),
            practice=_choice(item.get("practice"), Practice),
            source_path=source,
        )
        post.reading_minutes = formatting.reading_minutes(post.body_md)
        post.save(update_fields=["reading_minutes"])
        names = [name for name in item.get("authors") or [] if isinstance(name, str) and name.strip()]
        for position, name in enumerate(names[:4]):
            author = Author.objects.filter(name=name.strip()).first()
            if author is None:  # unconfirmed: a person must confirm it before anything publishes
                base = formatting.slugify(name) or "author"
                slug = base if not Author.objects.filter(slug=base).exists() else f"{base}-{post.pk.hex[:6]}"
                author = Author.objects.create(name=name.strip()[:120], slug=slug)
            PostAuthor.objects.get_or_create(post=post, author=author, defaults={"position": position})
        for slug in item.get("topics") or []:
            topic = Topic.objects.filter(slug=slug).first() if isinstance(slug, str) else None
            if topic is not None:
                PostTopic.objects.get_or_create(post=post, topic=topic)

    def _role(self, item, plan, apply):
        reason = self._skip_reason(item, Role)
        source = _str(item, "sourcePath", limit=300) if isinstance(item, dict) else ""
        if reason:
            plan["skipped" if reason == "already imported" else "refused"] += 1
            self.stdout.write(f"role {source or '?'}: {reason}")
            return
        title = _str(item, "title", limit=200)
        self.stdout.write(f"role {source}: create draft {title!r}")
        plan["created"] += 1
        if not apply:
            return
        fields = {
            "practice": _choice(item.get("practice"), Practice),
            "level": _choice(item.get("level"), Level),
            "location_text": _str(item, "location", "locationText", limit=120),
            "work_model": _choice(item.get("workModel"), WorkModel),
            "employment_type": _choice(item.get("employmentType"), EmploymentType),
            "summary": _str(item, "summary", limit=220),
            "sponsorship": _choice(item.get("sponsorship"), Sponsorship) or Sponsorship.NOT_STATED,
            "apply_mode": _choice(item.get("applyMode"), ApplyMode) or ApplyMode.FORM,
            "salary_period": _choice(item.get("salaryPeriod"), SalaryPeriod) or SalaryPeriod.YEAR,
            "show_salary": False,  # a person decides whether the salary is shown
        }
        for key, field in ROLE_TEXT.items():
            fields[field] = _str(item, key, f"{key}Markdown")
        for key, field in (("salaryMin", "salary_min"), ("salaryMax", "salary_max")):
            value = item.get(key)
            fields[field] = value if isinstance(value, int) and value >= 0 else None
        Role.objects.create(
            title=title,
            slug=careers_services.unique_slug(_str(item, "slug") or title),
            source_path=source,
            **fields,
        )
