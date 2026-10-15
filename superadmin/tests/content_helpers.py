"""Helpers for the Insights, Careers and content-sync tests. Every value is obviously fictional."""

import json
import struct
import uuid
from datetime import timedelta
from pathlib import Path

import yaml
from django.test import Client
from django.utils import timezone
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from apps.careers import services as careers_services
from apps.careers.models import Role
from apps.content_sync import render, signing
from apps.content_sync.models import SiteSettings
from apps.insights import services
from apps.insights.models import Author, CheckKey, Post, Topic

READ_KEYS = "read-1:read-secret-for-tests,read-0:older-read-secret"
REVALIDATE_KEYS = "rev-1:revalidate-secret-for-tests"
RENDER_KEYS = "render-1:render-secret-for-tests"
PREVIEW_KEYS = "prev-1:preview-secret-for-tests"
SUBMIT_KEYS = "submit-1:submit-secret-for-tests"
WEB = "https://web.example.test"

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_DIR = REPO_ROOT / "contracts" / "content-api" / "v1"
SPEC_URI = "urn:vitalos:content-api"


def configure(settings, *, targets=(WEB,)):
    settings.CONTENT_READ_CLIENT_KEYS = READ_KEYS
    settings.CONTENT_REVALIDATE_SECRET = REVALIDATE_KEYS
    settings.CONTENT_RENDER_SECRET = RENDER_KEYS
    settings.CONTENT_PREVIEW_SECRET = PREVIEW_KEYS
    settings.CAREERS_SUBMIT_CLIENT_KEYS = SUBMIT_KEYS
    settings.CONTENT_WEB_TARGETS = list(targets)


def ok_render(markdown="", context="post"):
    return render.RenderResult(True, "<p>Example body (fixture).</p>", [], 0, [])


def signed_get(client: Client, path: str, *, scope="read", key=None, headers=None, now=None):
    signed = signing.sign_headers(scope, "GET", path, b"", key=key, now=now)
    extra = {
        f"HTTP_{name.upper().replace('-', '_')}": value
        for name, value in {**signed, **(headers or {})}.items()
    }
    return client.get(path, **extra)


def signed_post(client: Client, path: str, body: bytes = b"{}", *, scope="tick", key=None):
    signed = signing.sign_headers(scope, "POST", path, body, key=key)
    extra = {f"HTTP_{name.upper().replace('-', '_')}": value for name, value in signed.items()}
    return client.post(path, data=body, content_type="application/json", **extra)


def open_site(insights=True, careers=True):
    SiteSettings.objects.update_or_create(pk=1, defaults={"insights_open": insights, "careers_open": careers})


# --- Builders ------------------------------------------------------------------------------------


def make_author(name="Example Author", *, confirmed=True, actor=None, slug=None):
    author = Author.objects.create(
        name=name,
        slug=slug or services.formatting.slugify(name) + "-" + uuid.uuid4().hex[:4],
        role_title="Example role title",
        bio_md="Example biography (fixture).",
    )
    if confirmed:
        author.confirmed_real_at = timezone.now()
        author.confirmed_real_by = actor
        author.save()
    return author


def topic(slug="ai-and-agents"):
    return Topic.objects.get(slug=slug)


def make_post(
    title,
    actor,
    *,
    authors=(),
    topics=(),
    body="## Example heading\n\nExample paragraph (fixture).\n",
    **fields,
):
    post = services.create_post(title=title, format=fields.pop("format", "engineering_note"), actor=actor)
    data = {
        "title": title,
        "excerpt": fields.pop("excerpt", "Example excerpt for a fixture post. It is not real content."),
        "body_md": body,
        "format": post.format,
        "slug": fields.pop("slug", post.slug),
        "practice": fields.pop("practice", "engineering"),
        **fields,
    }
    return services.save_working_copy(
        post,
        data,
        authors=[str(a.pk) for a in authors],
        topics=[str(t.pk) for t in topics],
        actor=actor,
    )


def tick_all(post, actor):
    for key in CheckKey.values:
        services.tick_check(post, key, actor)


def publish_post(title, actor, **kwargs):
    post = make_post(title, actor, **kwargs)
    services.submit_for_review(post, actor)
    services.approve(post, actor)
    tick_all(post, actor)
    return services.publish(Post.objects.get(pk=post.pk), actor)


def edit(post, actor, **changes):
    post = Post.objects.get(pk=post.pk)
    data = {name: getattr(post, name) for name in services.WORKING_FIELDS}
    data.update(changes)
    return services.save_working_copy(
        post,
        data,
        authors=services.author_ids(post),
        topics=services.topic_ids(post),
        related=services.related_ids(post),
        actor=actor,
    )


def make_role(title="Example role (fixture)", *, status="open", actor=None, closes_in=None, **fields):
    role = Role.objects.create(
        title=title,
        slug=services.formatting.slugify(title) + "-" + uuid.uuid4().hex[:4],
        practice=fields.pop("practice", "engineering"),
        level=fields.pop("level", "l3_senior"),
        location_text=fields.pop("location_text", "Example City"),
        work_model=fields.pop("work_model", "hybrid"),
        employment_type=fields.pop("employment_type", "permanent_full_time"),
        summary=fields.pop("summary", "Example summary for a fixture role. It is not a real vacancy."),
        about_md=fields.pop("about_md", "Example about text (fixture)."),
        requirements_md=fields.pop("requirements_md", "- Example requirement"),
        responsibilities_md=fields.pop("responsibilities_md", "- Example responsibility"),
        closes_at=timezone.now() + closes_in if closes_in is not None else None,
        **fields,
    )
    if status == "draft":
        return role
    role = careers_services.open_role(role, actor)
    if status in ("paused", "archived"):
        Role.objects.filter(pk=role.pk).update(status=status)
    elif status == "closed":
        careers_services.close_role(role, actor)
    return Role.objects.get(pk=role.pk)


def expire_role(role):
    """Simulate the published closing date passing without the tick running."""
    past = timezone.now() - timedelta(minutes=5)
    Role.objects.filter(pk=role.pk).update(published_closes_at=past, closes_at=past)


# --- Contract validation -------------------------------------------------------------------------


def load_spec() -> dict:
    return yaml.safe_load((CONTRACT_DIR / "openapi.yaml").read_text(encoding="utf-8"))


def _checker() -> FormatChecker:
    checker = FormatChecker()

    @checker.checks("uuid", raises=ValueError)
    def _uuid(value):
        if not isinstance(value, str):
            return True
        uuid.UUID(value)
        return True

    @checker.checks("date-time", raises=ValueError)
    def _date_time(value):
        if not isinstance(value, str):
            return True
        from datetime import datetime

        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return "T" in value

    @checker.checks("uri", raises=ValueError)
    def _uri(value):
        if not isinstance(value, str):
            return True
        return value.startswith(("https://", "http://"))

    return checker


class Contract:
    def __init__(self):
        self.spec = load_spec()
        resource = Resource.from_contents(self.spec, default_specification=DRAFT202012)
        self.registry = Registry().with_resource(SPEC_URI, resource)
        self.checker = _checker()

    @staticmethod
    def _escape(part: str) -> str:
        return part.replace("~", "~0").replace("/", "~1")

    def validator(self, pointer: str) -> Draft202012Validator:
        return Draft202012Validator(
            {"$ref": f"{SPEC_URI}#{pointer}"}, registry=self.registry, format_checker=self.checker
        )

    def component(self, name: str) -> Draft202012Validator:
        return self.validator(f"/components/schemas/{name}")

    def operation(self, path: str, method: str = "get", status: str = "200") -> Draft202012Validator:
        pointer = "/".join(
            [
                "",
                "paths",
                self._escape(path),
                method,
                "responses",
                status,
                "content",
                "application~1json",
                "schema",
            ]
        )
        return self.validator(pointer)

    def errors(self, validator: Draft202012Validator, data) -> list[str]:
        return [f"{'/'.join(map(str, e.absolute_path))}: {e.message}" for e in validator.iter_errors(data)]


def response_json(response):
    return json.loads(response.content)


# --- Images --------------------------------------------------------------------------------------


def png_bytes(width=16, height=9) -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        + b"\x00\x00\x00\x0dIHDR"
        + struct.pack(">II", width, height)
        + b"\x08\x02\x00\x00\x00"
        + b"\x00" * 16
    )


def jpeg_bytes(width=32, height=18) -> bytes:
    sof = (
        b"\xff\xc0"
        + struct.pack(">H", 17)
        + b"\x08"
        + struct.pack(">HH", height, width)
        + b"\x03"
        + b"\x00" * 9
    )
    return b"\xff\xd8\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00" + b"\x00" * 9 + sof + b"\xff\xd9"


def webp_bytes(width=40, height=30) -> bytes:
    payload = (
        b"VP8X"
        + struct.pack("<I", 10)
        + b"\x00\x00\x00\x00"
        + (width - 1).to_bytes(3, "little")
        + (height - 1).to_bytes(3, "little")
    )
    return b"RIFF" + struct.pack("<I", 4 + len(payload)) + b"WEBP" + payload


def avif_bytes(width=64, height=48) -> bytes:
    ftyp = struct.pack(">I", 20) + b"ftypavif" + b"\x00\x00\x00\x00" + b"mif1"
    ispe = struct.pack(">I", 20) + b"ispe" + b"\x00\x00\x00\x00" + struct.pack(">II", width, height)
    return ftyp + ispe
