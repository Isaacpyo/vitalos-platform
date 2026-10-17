"""Import a folder of approved Insights through the editorial workflow (``manage.py import_insights_batch``).

The folder holds ``NN-slug.md`` files: YAML front matter, then the Markdown body. Everything is checked
before anything is written, and a single problem fails the whole run. Writes go through the same
services as the editor (working copy, editorial checks, submit, approve, publish), so every post gets
its snapshot, revision, audit rows and sync event exactly as a publish from the admin would.

Drafts are the default: ``status=draft`` saves each post's working copy (title, body, format, topics,
practice, excerpt, SEO title and description, call to action, authors) and nothing else, so no
editorial check is ticked, no revision is made and nothing reaches the website. Only an explicit
``status=published`` ticks the checks and publishes each post with its original date
(``publish_date`` at 09:00 Europe/London, through ``services.publish(published_at=...)``).

Posts are matched by slug, so running the same folder again changes nothing, and an edited file
updates (or, when publishing, publishes) its changes. Nothing is ever deleted.

The files name the organisation author "Vitalos". ``author`` (a slug, or the email of the author's
linked dashboard user) puts every post under an existing person author instead; an import never
creates a person author, because only a real person can approve their own profile.
"""

import re
from dataclasses import dataclass, field
from datetime import date, datetime, time
from pathlib import Path
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

import yaml
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record
from apps.content_sync import formatting, render
from apps.content_sync.choices import Practice
from apps.content_sync.models import SyncEvent

from . import public, services, taxonomy
from .models import Author, AuthorKind, CheckKey, Post, PostFormat, PostStatus, Topic, TopicKind

VIA = "import_insights_batch"
LONDON = ZoneInfo("Europe/London")
PUBLISH_TIME = time(9, 0)
FILE_PATTERN = re.compile(r"^(\d{2})-([a-z0-9-]+)\.md$")
MAX_FILE_BYTES = 200_000
CHECK_NOTE = (
    "Batch 2 import: content, claims, citations and SEO checked before import (Claude in Cowork, 16 Oct 2026)"
)
REQUIRED = (
    "title",
    "slug",
    "format",
    "authors",
    "publish_date",
    "topics",
    "sectors",
    "practice",
    "excerpt",
    "seo_title",
    "seo_description",
)
LIMITS = {"title": 200, "excerpt": 220, "seo_title": 60, "seo_description": 155, "cta_label": 80}
FORMATS = {label: value for value, label in PostFormat.choices}
PRACTICES = {label: value for value, label in Practice.choices}
SITE_HOSTS = ("vitalos.co.uk", "www.vitalos.co.uk")

# The organisation author every batch post is written under (owner-approved, 16 Oct 2026).
ORGANISATION_AUTHOR = {
    "slug": "vitalos",
    "name": "Vitalos",
    "kind": AuthorKind.ORGANISATION,
    "role_title": "Vitalos Insights",
    "bio_md": (
        "Vitalos is a UK technology consulting, engineering and digital transformation firm. We help "
        "ambitious organisations modernise operations, build digital products and adopt AI, from strategy "
        "to production."
    ),
}

_FENCE = re.compile(r"^(```|~~~)")
_INLINE_CODE = re.compile(r"`[^`\n]*`")
_HTML = re.compile(r"<(?:[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?/?|/[A-Za-z][A-Za-z0-9-]*\s*|!--.*?--)>", re.S)
_LINK = re.compile(r"!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
_AUTOLINK = re.compile(r"<((?:https?|mailto):[^>\s]+)>")
_DEFINITION = re.compile(r"^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+.*)?$", re.M)


class BatchError(Exception):
    """The folder cannot be imported. ``problems`` lists every reason, one line each."""

    def __init__(self, problems: list[str]):
        super().__init__(f"{len(problems)} problem(s)")
        self.problems = problems


@dataclass
class Item:
    file: str
    slug: str
    title: str
    format: str
    practice: str
    featured: bool
    excerpt: str
    seo_title: str
    seo_description: str
    cta_label: str
    cta_href: str
    body_md: str
    published_at: datetime
    topics: list[Topic]
    focus_keyword: str = ""
    secondary_keywords: list[str] = field(default_factory=list)
    # Filled by plan(): the existing post, what would happen, and why.
    post: Post | None = None
    action: str = ""
    # Filled by apply().
    status: str = ""
    revision_id: int | None = None
    sync_event_id: str = ""

    @property
    def working(self) -> dict:
        return {
            "title": self.title,
            "body_md": self.body_md,
            "format": self.format,
            "slug": self.slug,
            "practice": self.practice,
            "featured": self.featured,
            "cta_label": self.cta_label,
            "cta_href": self.cta_href,
            "seo_title": self.seo_title,
            "seo_description": self.seo_description,
        }


# --- Reading -------------------------------------------------------------------------------------


def _split(text: str, name: str) -> tuple[dict, str]:
    text = text.replace("\r\n", "\n").lstrip("\ufeff")
    if not text.startswith("---\n"):
        raise ValueError("no front matter (the file must start with ---)")
    end = text.find("\n---\n", 4)
    if end == -1:
        raise ValueError("the front matter is not closed with ---")
    meta = yaml.safe_load(text[4:end])
    if not isinstance(meta, dict):
        raise ValueError("the front matter is not a set of fields")
    return meta, text[end + 5 :].strip("\n") + "\n"


def _text(meta: dict, key: str) -> str:
    value = meta.get(key)
    if value is None:
        return ""
    if not isinstance(value, (str, int, float)) or isinstance(value, bool):
        raise ValueError(f"{key} must be text")
    return " ".join(str(value).split())


def _names(meta: dict, key: str) -> list[str]:
    value = meta.get(key) or []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ValueError(f"{key} must be a list of names")
    return [item.strip() for item in value if item.strip()]


def _publish_moment(value) -> datetime:
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, str):
        value = date.fromisoformat(value.strip())
    if not isinstance(value, date):
        raise ValueError("publish_date must be a date (YYYY-MM-DD)")
    return datetime.combine(value, PUBLISH_TIME, tzinfo=LONDON)


def _code_free(body: str) -> list[str]:
    """Body lines with fenced code blocks blanked and inline code removed (what Markdown renders as text)."""
    lines, fenced = [], False
    for line in body.split("\n"):
        if _FENCE.match(line.lstrip()):
            fenced = not fenced
            lines.append("")
            continue
        lines.append("" if fenced else _INLINE_CODE.sub("", line))
    return lines


def body_problems(body: str) -> list[str]:
    """Raw HTML and level 1 headings (ATX or setext) outside code."""
    problems = []
    lines = _code_free(body)
    prose = "\n".join(lines)
    if _HTML.search(prose):
        problems.append("the body contains raw HTML (use Markdown)")
    for index, line in enumerate(lines):
        if re.match(r"^\s{0,3}#(\s|$)", line) or (
            index > 0 and lines[index - 1].strip() and re.match(r"^\s{0,3}=+\s*$", line)
        ):
            problems.append("the body has a level 1 heading (the title is the only one)")
            break
    return problems


def links(body: str) -> list[str]:
    prose = "\n".join(_code_free(body))
    found = [match.group(1) for match in _LINK.finditer(prose)]
    found += [match.group(1) for match in _AUTOLINK.finditer(prose)]
    found += [match.group(1) for match in _DEFINITION.finditer(prose)]
    return found


def _insights_slug(url: str) -> str | None:
    """The post slug of an /insights/{slug} link (relative or on vitalos.co.uk), else None."""
    parts = urlsplit(url)
    if parts.scheme or parts.netloc:
        if parts.scheme != "https" or (parts.hostname or "").lower() not in SITE_HOSTS:
            return None
    match = re.fullmatch(r"/insights/([^/?#]+)/?", parts.path)
    return match.group(1) if match else None


def link_problems(body: str, known_slugs: set[str]) -> list[str]:
    problems = []
    for url in links(body):
        if url.startswith("#") or url.startswith("mailto:"):
            continue
        slug = _insights_slug(url)
        if slug is not None:
            if slug not in known_slugs:
                problems.append(f"{url} does not point to a post in this batch or a published post")
            continue
        if url.startswith("/") and not url.startswith("//"):
            continue
        parts = urlsplit(url)
        if parts.scheme != "https" or not parts.netloc:
            problems.append(f"{url} is not an https:// link")
    return problems


def _parse(path: Path, topics: dict, sectors: dict, problems: list[str]) -> Item | None:
    name = path.name
    match = FILE_PATTERN.match(name)
    if path.stat().st_size > MAX_FILE_BYTES:
        problems.append(f"{name}: larger than {MAX_FILE_BYTES // 1000} KB")
        return None
    try:
        meta, body = _split(path.read_text(encoding="utf-8"), name)
    except (ValueError, UnicodeDecodeError, yaml.YAMLError) as exc:
        problems.append(f"{name}: {exc.__class__.__name__ if isinstance(exc, yaml.YAMLError) else exc}")
        return None
    mine = []
    for key in REQUIRED:
        if meta.get(key) in (None, "", []):
            mine.append(f"{key} is missing")
    try:
        values = {key: _text(meta, key) for key in (*LIMITS, "slug", "format", "practice", "cta_href")}
        values["focus_keyword"] = _text(meta, "focus_keyword")
        topic_names, sector_names = _names(meta, "topics"), _names(meta, "sectors")
        author_names = _names(meta, "authors")
        keywords = _names(meta, "secondary_keywords")
        published_at = _publish_moment(meta.get("publish_date"))
    except ValueError as exc:
        problems.append(f"{name}: {exc}")
        return None
    slug = values["slug"]
    if not formatting.is_slug(slug) or slug in services.RESERVED_SLUGS:
        mine.append(f"slug {slug!r} is not a usable slug")
    if match is None or match.group(2) != slug:
        mine.append(f"the file name does not match NN-{slug}.md")
    for key, limit in LIMITS.items():
        if len(values[key]) > limit:
            mine.append(f"{key} is {len(values[key])} characters (at most {limit})")
    if values["format"] not in FORMATS:
        mine.append(f"format {values['format']!r} is not one of: {', '.join(FORMATS)}")
    if values["practice"] not in PRACTICES:
        mine.append(f"practice {values['practice']!r} is not one of: {', '.join(PRACTICES)}")
    if author_names != [ORGANISATION_AUTHOR["name"]]:
        mine.append(f"authors must be [{ORGANISATION_AUTHOR['name']}] (got {author_names})")
    matched = []
    for names, pool, kind in ((topic_names, topics, "topic"), (sector_names, sectors, "sector")):
        for item in names:
            if item in pool:
                matched.append(pool[item])
            else:
                mine.append(f"{kind} {item!r} does not exist (topics are never created by an import)")
    cta_href = values["cta_href"]
    if cta_href and (not cta_href.startswith("/") or cta_href.startswith("//")):
        mine.append(f"cta_href {cta_href!r} must be an internal path such as /contact")
    if bool(values["cta_label"]) != bool(cta_href):
        mine.append("cta_label and cta_href must be set together")
    if published_at > timezone.now():
        mine.append("publish_date is in the future (schedule the post in the admin instead)")
    if not body.strip():
        mine.append("the body is empty")
    mine += body_problems(body)
    featured = meta.get("featured", False)
    if not isinstance(featured, bool):
        mine.append("featured must be true or false")
    problems += [f"{name}: {problem}" for problem in mine]
    if mine:
        return None
    return Item(
        file=name,
        slug=slug,
        title=values["title"],
        format=FORMATS[values["format"]],
        practice=PRACTICES[values["practice"]],
        featured=featured,
        excerpt=values["excerpt"],
        seo_title=values["seo_title"],
        seo_description=values["seo_description"],
        cta_label=values["cta_label"],
        cta_href=cta_href,
        body_md=body,
        published_at=published_at,
        topics=list(dict.fromkeys(matched)),
        focus_keyword=values["focus_keyword"],
        secondary_keywords=keywords,
    )


def load(folder: Path) -> list[Item]:
    """Read and check every NN-slug.md file. Raises BatchError listing every problem."""
    folder = Path(folder)
    if not folder.is_dir():
        raise BatchError([f"{folder} is not a folder"])
    files = sorted(path for path in folder.iterdir() if path.is_file() and FILE_PATTERN.match(path.name))
    if not files:
        raise BatchError([f"{folder} has no NN-slug.md files"])
    topics = {t.name: t for t in Topic.objects.filter(kind=TopicKind.TOPIC)}
    sectors = {t.name: t for t in Topic.objects.filter(kind=TopicKind.SECTOR)}
    problems: list[str] = []
    items = [item for path in files if (item := _parse(path, topics, sectors, problems))]
    seen: dict[str, str] = {}
    for item in items:
        if item.slug in seen:
            problems.append(f"{item.file}: slug {item.slug!r} is also used by {seen[item.slug]}")
        seen.setdefault(item.slug, item.file)
    published = set(public.visible_posts().values_list("published_slug", flat=True))
    known = set(seen) | published
    for item in items:
        problems += [f"{item.file}: {problem}" for problem in link_problems(item.body_md, known)]
    if problems:
        raise BatchError(problems)
    return sorted(items, key=lambda item: (item.published_at, item.slug))


# --- Planning ------------------------------------------------------------------------------------


def _differs(post: Post, item: Item, author_ids: list[str]) -> bool:
    if any(getattr(post, key) != value for key, value in item.working.items()):
        return True
    if post.excerpt != item.excerpt or services.author_ids(post) != author_ids:
        return True
    return services.topic_ids(post) != sorted(str(topic.pk) for topic in item.topics)


def person_author(reference: str) -> Author | None:
    """An existing author by slug, or by the email of their linked dashboard user."""
    reference = (reference or "").strip()
    if not reference:
        return None
    author = Author.objects.filter(slug=reference).first()
    if author is None and "@" in reference:
        author = Author.objects.filter(admin_user__email__iexact=reference).first()
    return author


def _organisation_author() -> Author | None:
    return Author.objects.filter(slug=ORGANISATION_AUTHOR["slug"]).first()


def author_plan(status: str = PostStatus.DRAFT, reference: str = "") -> str:
    """What happens to the author, in words. Starts with "refuse" when the run must stop."""
    publishing = status == PostStatus.PUBLISHED
    if reference:
        author = person_author(reference)
        if author is None:
            return f"refuse: there is no author {reference!r} (an import never creates a person author)"
        if author.kind != AuthorKind.PERSON:
            return f"refuse: {author.name} is an organisation author, not a person"
        if not author.is_active:
            return f"refuse: {author.name} is inactive"
        if publishing and not author.is_confirmed:
            return f"refuse: {author.name} is not confirmed as a real person, so the posts cannot be published"
        note = "" if author.is_confirmed else " (not yet confirmed as a real person: confirm before publishing)"
        return f"{author.name}, person author `{author.slug}`, in place of the files' Vitalos{note}"
    author = _organisation_author()
    if author is None:
        if publishing:
            return "create the Vitalos organisation author and record the founder approval"
        return "create the Vitalos organisation author (approval not recorded: record it before publishing)"
    if author.kind != AuthorKind.ORGANISATION:
        return "refuse: the existing 'vitalos' author is a person"
    if publishing and (not author.is_confirmed or not author.is_active):
        return "record the founder approval and activate the Vitalos author"
    if not author.is_active:
        return "activate the Vitalos author"
    return "use the existing Vitalos author"


def organisation_author_plan() -> str:
    """The organisation author's plan when publishing (the first version's name)."""
    return author_plan(PostStatus.PUBLISHED)


def _author_ids(reference: str) -> list[str]:
    author = person_author(reference) if reference else _organisation_author()
    return [str(author.pk)] if author is not None else []


def plan(items: list[Item], status: str, author: str = "") -> list[str]:
    """Decide what happens to each item (``item.action``). Returns problems that stop the run.

    The file is the source of truth: an existing post whose working copy differs from it (including
    edits made in the admin since the last import) is updated to match the file."""
    problems = []
    author_ids = _author_ids(author)
    for item in items:
        post = Post.objects.filter(slug=item.slug).first()
        item.post = post
        if post is None:
            if Post.objects.filter(published_slug=item.slug).exists():
                problems.append(f"{item.file}: another post is published under /insights/{item.slug}")
            item.action = "create and publish" if status == PostStatus.PUBLISHED else "create draft"
            continue
        if post.status in (PostStatus.ARCHIVED, PostStatus.SCHEDULED):
            problems.append(f"{item.file}: the existing post is {post.get_status_display().lower()}")
            continue
        changed = _differs(post, item, author_ids)
        if status == PostStatus.PUBLISHED:
            live = post.status == PostStatus.PUBLISHED and not post.has_unpublished_changes
            if not changed and live:
                item.action = "unchanged"
            elif post.status == PostStatus.PUBLISHED:
                item.action = "publish changes"
            else:
                item.action = "update and publish" if changed else "publish"
        else:
            item.action = "update draft" if changed else "unchanged"
    return problems


def render_problems(items: list[Item], *, required: bool) -> tuple[list[str], bool]:
    """Render every body with the website's renderer. Returns (problems, reachable)."""
    problems, reachable = [], True
    for item in items:
        result = render.render(item.body_md, "post")
        if not result.available:
            reachable = False
            if required:
                problems.append(
                    f"The website's renderer is unreachable ({result.reason}), so posts cannot be published."
                )
            break
        problems += [f"{item.file}: {warning['message']}" for warning in result.blocking_warnings]
    return problems, reachable


# --- Writing -------------------------------------------------------------------------------------


def ensure_author(actor, status: str = PostStatus.PUBLISHED, reference: str = "") -> Author:
    """The author every post is written under.

    With ``reference``: that existing person author, never created or confirmed here. Otherwise the
    Vitalos organisation author, created and activated if needed; its founder approval is recorded by
    ``actor`` only when the run publishes (a draft import approves nothing)."""
    if reference:
        verdict = author_plan(status, reference)
        if verdict.startswith("refuse"):
            raise BatchError([verdict.removeprefix("refuse: ")])
        return person_author(reference)
    author = _organisation_author()
    if author is None:
        author = taxonomy.create_author(dict(ORGANISATION_AUTHOR), actor=actor)
    if author.kind != AuthorKind.ORGANISATION:
        raise BatchError(["The existing 'vitalos' author is a person, not an organisation."])
    if not author.is_active:
        author = taxonomy.set_author_active(author, True, actor=actor)
    if status == PostStatus.PUBLISHED and not author.is_confirmed:
        author = taxonomy.confirm_author(author, actor=actor)
    return author


def _publish_event(post: Post) -> SyncEvent | None:
    return (
        SyncEvent.objects.filter(
            entity="post", entity_id=str(post.pk), action__in=("post.published", "post.changes_published")
        )
        .order_by("-created_at")
        .first()
    )


def _apply_one(item: Item, author: Author, actor, status: str) -> None:
    with transaction.atomic():
        post = item.post
        if post is None:
            post = services.create_post(title=item.title, format=item.format, actor=actor, via=VIA)
            post.source_path = f"import:{item.file}"
            post.save(update_fields=["source_path"])
        if item.action != "publish":
            post = services.save_working_copy(
                post,
                item.working,
                authors=[str(author.pk)],
                topics=[str(topic.pk) for topic in item.topics],
                related=services.related_ids(post),
                actor=actor,
                excerpt=item.excerpt,
                via=VIA,
            )
        if status == PostStatus.PUBLISHED:
            current_hash = services.revision_hash(post)
            done = set(post.checks.filter(revision_hash=current_hash).values_list("check_key", flat=True))
            for key in CheckKey.values:
                if key not in done:
                    services.tick_check(post, key, actor, note=CHECK_NOTE, via=VIA)
            if post.status == PostStatus.DRAFT:
                post = services.submit_for_review(post, actor, via=VIA)
            if post.status == PostStatus.IN_REVIEW:
                post = services.approve(post, actor, via=VIA)
            post = services.publish(
                Post.objects.get(pk=post.pk), actor, published_at=item.published_at, via=VIA
            )
            event = _publish_event(post)
            item.revision_id = post.published_revision_id
            item.sync_event_id = str(event.pk) if event else ""
        item.post = post
        item.status = post.status


def apply(items: list[Item], *, actor, status: str, author: str = "") -> Author:
    chosen = ensure_author(actor, status, author)
    for item in items:
        if item.action == "unchanged":
            post = item.post
            item.status = post.status
            item.revision_id = post.published_revision_id
            event = _publish_event(post)
            item.sync_event_id = str(event.pk) if event else ""
            continue
        _apply_one(item, chosen, actor, status)
    counts: dict[str, int] = {}
    for item in items:
        counts[item.action] = counts.get(item.action, 0) + 1
    if any(item.action != "unchanged" for item in items):
        record(
            "insights.batch_imported",
            actor=actor,
            summary=f"Imported {len(items)} Insights ({status})",
            via=VIA,
            status=status,
            author=chosen.slug,
            counts=counts,
            slugs=[item.slug for item in items if item.action != "unchanged"],
        )
    return chosen


# --- Report --------------------------------------------------------------------------------------


def _cell(value) -> str:
    return str(value if value not in (None, "") else "–").replace("|", "\\|").replace("\n", " ")


def report(items: list[Item], *, applied: bool, status: str, actor_email: str, author_note: str) -> str:
    now = timezone.localtime(timezone.now(), LONDON)
    mode = f"Applied (--status {status})" if applied else f"Dry run (--status {status}); nothing was written"
    lines = [
        "# Insights batch 2: import report",
        "",
        f"- Run: {now:%d %B %Y %H:%M} Europe/London, by {actor_email} via `import_insights_batch`.",
        f"- Mode: {mode}.",
        f"- Author: {author_note}.",
        f"- Posts: {len(items)}, oldest first. Dates are `publish_date` at 09:00 Europe/London.",
        "",
        "| Slug | Title | Date | Action | Status | Revision | Sync event | Focus keyword |",
        "| ---- | ----- | ---- | ------ | ------ | -------- | ---------- | ------------- |",
    ]
    for item in items:
        status_text = item.status or (item.post.status if item.post else "")
        lines.append(
            "| "
            + " | ".join(
                _cell(value)
                for value in (
                    item.slug,
                    item.title,
                    f"{item.published_at:%Y-%m-%d}",
                    item.action,
                    status_text,
                    item.revision_id,
                    item.sync_event_id,
                    item.focus_keyword,
                )
            )
            + " |"
        )
    lines += ["", "## Secondary keywords (report only; there is no model field)", ""]
    lines += [f"- `{item.slug}`: {', '.join(item.secondary_keywords) or '–'}" for item in items]
    return "\n".join(lines) + "\n"
