"""Cache tags and paths for sync events, from the contract's tags.json (A2, brief 3.3).

The Docker build context is ``superadmin/`` only, so the contract files are vendored into
``contract/``; a test asserts they are byte-identical to ``contracts/content-api/v1/``.
"""

import json
import re
from functools import cache
from pathlib import Path

CONTRACT_DIR = Path(__file__).resolve().parent / "contract"
TAGS_FILE = CONTRACT_DIR / "tags.json"
OPENAPI_FILE = CONTRACT_DIR / "openapi.yaml"
MAX_TAGS = 64
MAX_PATHS = 64
_PLACEHOLDER = re.compile(r"\{([A-Za-z]+)\}")


@cache
def contract() -> dict:
    return json.loads(TAGS_FILE.read_text(encoding="utf-8"))


@cache
def tag_pattern() -> re.Pattern:
    return re.compile(contract()["tagPattern"])


@cache
def path_patterns() -> tuple[re.Pattern, ...]:
    return tuple(re.compile(pattern) for pattern in contract()["pathPatterns"])


def event_spec(action: str) -> dict:
    events = contract()["events"]
    if action not in events:
        raise KeyError(f"Unknown sync event {action!r}")
    return events[action]


def kind_for(action: str) -> str:
    return event_spec(action)["kind"]


def _unique(values) -> list[str]:
    seen: dict[str, None] = {}
    for value in values:
        if value and value not in seen:
            seen[value] = None
    return list(seen)


def expand_tags(
    action: str,
    *,
    slug: str = "",
    old_slug: str = "",
    author_slugs=(),
    topic_slugs=(),
) -> list[str]:
    """The event's tags with placeholders filled. A tag ending in ``*`` becomes one tag per slug given
    (old and new related items); a placeholder with no value drops its tag."""
    values = {
        "slug": [slug] if slug else [],
        "oldSlug": [old_slug] if old_slug and old_slug != slug else [],
        "authorSlug": _unique(author_slugs),
        "topicSlug": _unique(topic_slugs),
    }
    tags = []
    for template in event_spec(action)["tags"]:
        multi = template.endswith("*")
        template = template.rstrip("*")
        names = _PLACEHOLDER.findall(template)
        if not names:
            tags.append(template)
            continue
        name = names[0]
        options = values.get(name, [])
        for value in options if multi else options[:1]:
            tags.append(template.replace("{" + name + "}", value))
    pattern = tag_pattern()
    return [tag for tag in _unique(tags) if pattern.match(tag)][:MAX_TAGS]


def valid_path(path: str) -> bool:
    return len(path) <= 200 and any(pattern.match(path) for pattern in path_patterns())


def clean_paths(paths) -> list[str]:
    return [path for path in _unique(paths) if valid_path(path)][:MAX_PATHS]


def default_paths(
    entity: str, *, slug: str = "", old_slug: str = "", author_slugs=(), topic_slugs=()
) -> list[str]:
    """Public paths an event affects: warmed on publish, revalidated on removal."""
    if entity == "post":
        paths = [f"/insights/{slug}" if slug else "", f"/insights/{old_slug}" if old_slug else ""]
        # The sitemap is listed so a publish warms it too (stale-while-revalidate otherwise serves
        # the old sitemap to the first request after a publish).
        paths += ["/insights", "/", "/insights/feed.xml", "/sitemap.xml"]
        paths += [f"/insights/authors/{value}" for value in author_slugs]
        paths += [f"/insights/topics/{value}" for value in topic_slugs]
    elif entity == "author":
        paths = [
            f"/insights/authors/{slug}" if slug else "",
            f"/insights/authors/{old_slug}" if old_slug else "",
        ]
        paths += ["/insights"]
    elif entity == "topic":
        paths = [
            f"/insights/topics/{slug}" if slug else "",
            f"/insights/topics/{old_slug}" if old_slug else "",
        ]
        paths += ["/insights"]
    elif entity == "role":
        paths = [f"/careers/{slug}" if slug else "", f"/careers/{old_slug}" if old_slug else ""]
        paths += ["/careers", "/", "/sitemap.xml"]
    elif entity == "careers_settings":
        paths = ["/careers", "/"]
    elif entity == "home_section":
        paths = ["/"]
    else:  # site: opened, closed, resync
        paths = ["/", "/insights", "/insights/feed.xml", "/careers", "/sitemap.xml"]
    return clean_paths(paths)
