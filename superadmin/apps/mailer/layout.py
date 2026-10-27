"""The shared Vitalos email layout, rendered in Python.

This module mirrors ``packages/email-layout/src/render.ts`` line for line. The markup, colours, style
blocks and inline images come from ``email-layout/email-layout.json``, which the package's tests
generate; never edit that file by hand. ``tests/test_email_layout.py`` renders the golden fixtures in
``email-layout/fixtures`` and requires byte-identical output, so a change to the TypeScript renderer
must be repeated here (ADR-030).

A document is a dict: ``mode`` (optional, ``"correspondence"`` for a person-to-person reply), ``title``,
``preheader``, ``headerLabel``, ``blocks`` (list of block dicts) and ``footer`` (``notice``, ``social``,
``company``, ``unsubscribe``), using the same keys as the TypeScript types. Values are plain text: they are
cleaned and escaped here.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from django.conf import settings

SPEC_PATH = Path(settings.BASE_DIR) / "email-layout" / "email-layout.json"

# JavaScript's whitespace (``\s`` and ``trim()``), which differs from Python's ``str.isspace``.
_JS_WS = "\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
_CONTROL = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")
_BIDI = re.compile("[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]")
_FOLD = re.compile(f"[{_JS_WS}]*\n[{_JS_WS}]*")
_LEAD = re.compile(f"^[{_JS_WS}]+")
_TRAIL = re.compile(f"[{_JS_WS}]+$")
_SAFE_URL = re.compile(f"^(https://|mailto:)[^{_JS_WS}\"'<>`]+\\Z", re.IGNORECASE)
_SLOT = re.compile(r"\[\[([a-z_]+)\]\]")
_JS_SPACE = re.compile(f"[{_JS_WS}]+")

#: The block types a correspondence email (a person writing to a person) may use.
CORRESPONDENCE_BLOCKS = ("text", "quote", "divider", "signature")
CARD_EDGE = "border-top:0;border-radius:0 0 12px 12px;"
CARD_EDGE_ALONE = "border-radius:12px;"


@cache
def spec() -> dict:
    return json.loads(SPEC_PATH.read_text(encoding="utf-8"))


def _js_trim(value: str) -> str:
    return _TRAIL.sub("", _LEAD.sub("", value))


def clean_multiline(value: str | None) -> str:
    """Removes control and bidi-override characters and normalises line endings; keeps line breaks."""
    text = (value or "").replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
    return _js_trim(_BIDI.sub("", _CONTROL.sub("", text)))


def clean_line(value: str | None) -> str:
    """As ``clean_multiline``, folded onto one line."""
    return _FOLD.sub(" ", clean_multiline(value))


def escape_html(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def truncate(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    return _TRAIL.sub("", value[: limit - 1]) + "…"


def is_safe_url(url: str) -> bool:
    """Only ``https:`` and ``mailto:`` links are rendered; anything else is shown as text."""
    return bool(_SAFE_URL.match(url))


def fill(name: str, slots: dict[str, str]) -> str:
    """Fills ``[[slot]]`` placeholders. Values must already be HTML."""
    return _SLOT.sub(lambda m: slots.get(m.group(1), ""), spec()["snippets"][name])


e = escape_html


def not_provided() -> str:
    return spec()["notProvided"]


def _missing(value) -> str:
    return not_provided() if value is None else value


def image_by_id(content_id: str) -> dict | None:
    return next((img for img in spec()["images"].values() if img["contentId"] == content_id), None)


def _image_html(img: dict, alt: str) -> str:
    return fill(
        "image",
        {
            "content_id": e(img["contentId"]),
            "width": str(img["width"]),
            "height": str(img["height"]),
            "alt": e(alt),
        },
    )


def _text_groups(text: str) -> list[tuple[bool, list[str]]]:
    groups: list[tuple[bool, list[str]]] = []
    for paragraph in re.split(r"\n{2,}", text):
        current: tuple[bool, list[str]] | None = None
        for line in paragraph.split("\n"):
            is_item = line.startswith("- ")
            content = line[2:] if is_item else line
            if current is not None and current[0] == is_item:
                current[1].append(content)
            else:
                current = (is_item, [content])
                groups.append(current)
    return groups


def _text_html(text: str, muted: bool) -> str:
    groups = _text_groups(text)
    parts = []
    for index, (is_list, lines) in enumerate(groups):
        margin = "0" if index == len(groups) - 1 else "0 0 12px"
        if is_list:
            items = "".join(fill("list_item", {"text": e(line)}) for line in lines)
            parts.append(fill("list", {"margin": margin, "items": items}))
        else:
            parts.append(
                fill(
                    "paragraph_muted" if muted else "paragraph",
                    {"margin": margin, "text": "<br>\n".join(e(line) for line in lines)},
                )
            )
    return "\n".join(parts)


def _missing_html(text: str) -> str:
    return fill("missing", {"text": e(text)})


_DATE_T = re.compile(r"T(?=[0-9])")
_OFFSET = re.compile(r"([+-][0-9][0-9]:[0-9][0-9]|Z)\Z")


def _detail_value_html(row: dict) -> tuple[str, bool]:
    value = clean_line(row.get("value"))
    if not value:
        return fill("padded", {"text": _missing_html(_missing(row.get("missing")))}), True
    href = clean_line(row["href"]) if row.get("href") else ""
    linked = bool(href and is_safe_url(href))
    if linked:
        html = fill("link", {"href": e(href), "text": e(value)})
    elif row.get("code"):
        html = fill("code", {"text": e(value)})
    else:
        html = e(value)
    if row.get("note"):
        html += fill("note", {"text": e(clean_line(row["note"]))})
    if row.get("subvalue"):
        sub = e(clean_line(row["subvalue"]))
        sub = _OFFSET.sub(r"<wbr>\1", _DATE_T.sub("T<wbr>", sub, count=1))
        html += fill("subvalue", {"text": sub})
    if row.get("hint"):
        html += fill("hint", {"text": e(clean_line(row["hint"]))})
    return html, linked


def _badge_items(block: dict) -> list[tuple[str, str]]:
    items = []
    for index, item in enumerate(block.get("items", [])):
        if isinstance(item, str):
            text, tone = clean_line(item), None
        else:
            text, tone = clean_line(item.get("text")), item.get("tone")
        if not tone:
            tone = "intent" if index % 2 == 0 else "time"
        if text:
            items.append((text, tone))
    return items


def _block_html(block: dict) -> str:
    kind = block["type"]
    if kind == "heading":
        text = clean_line(block.get("text"))
        return fill("heading", {"text": e(text) if text else _missing_html(_missing(block.get("missing")))})
    if kind == "section":
        return fill("section", {"text": e(clean_line(block.get("text")))})
    if kind == "text":
        text = clean_multiline(block.get("text"))
        muted = block.get("tone") == "muted"
        if not text:
            return fill(
                "paragraph_muted" if muted else "paragraph",
                {"margin": "0", "text": _missing_html(_missing(block.get("missing")))},
            )
        return _text_html(text, muted)
    if kind == "button":
        url = clean_line(block.get("url"))
        label = clean_line(block.get("label"))
        if not is_safe_url(url):
            return fill("paragraph_muted", {"margin": "0", "text": e(f"{label}: link not available")})
        return fill("button", {"href": e(url), "label": e(label)})
    if kind == "badge":
        items = "".join(fill(f"badge_{tone}", {"text": e(text)}) for text, tone in _badge_items(block))
        return fill("badges", {"items": items})
    if kind == "quote":
        text = clean_multiline(block.get("text"))
        return fill(
            "quote",
            {
                "text": e(text).replace("\n", "<br>\n")
                if text
                else _missing_html(_missing(block.get("missing")))
            },
        )
    if kind == "details":
        rows = []
        for row in block.get("rows", []):
            html, linked = _detail_value_html(row)
            rows.append(
                fill(
                    "details_row",
                    {
                        "label": e(clean_line(row.get("label"))),
                        "value": html,
                        "padding": "0" if linked else "12px 0",
                    },
                )
            )
        return fill("details", {"rows": "\n".join(rows)})
    if kind == "divider":
        return spec()["snippets"]["divider"]
    if kind == "signature":
        title = clean_line(block.get("title"))
        return fill(
            "signature",
            {
                "name": e(clean_line(block.get("name")) or "Vitalos"),
                "title": fill("signature_title", {"text": e(title)}) if title else "",
            },
        )
    if kind == "code":
        code = _clean_code(block.get("code"))
        expiry = clean_line(block.get("expiry"))
        box = fill("code_box", {"code": e(code) if code else _missing_html(_missing(block.get("missing")))})
        return f"{box}\n{fill('code_expiry', {'text': e(expiry)})}" if expiry else box
    if kind == "steps":
        title = clean_line(block.get("title"))
        rows = "\n".join(
            fill("step_row", {"pad": "0" if index == 0 else "8", "number": str(index + 1), "text": e(text)})
            for index, text in enumerate(_step_items(block))
        )
        steps = fill("steps", {"rows": rows})
        return f"{fill('section', {'text': e(title)})}\n{steps}" if title else steps
    if kind == "items":
        rows = "\n".join(
            fill("item_row", {"content": _list_item_html(item)}) for item in block.get("items", [])
        )
        return fill("items", {"rows": rows})
    if kind == "stats":
        stats = block.get("items", [])
        width = str(100 // max(len(stats), 1))
        cells = []
        for index, stat in enumerate(stats):
            value = clean_line(stat.get("value"))
            cells.append(
                fill(
                    "stat_cell",
                    {
                        "width": width,
                        "edge": "0" if index == 0 else "1",
                        "value": e(value) if value else _missing_html(not_provided()),
                        "label": e(clean_line(stat.get("label"))),
                    },
                )
            )
        return fill("stats", {"cells": "".join(cells)})
    raise ValueError(f"Unknown block type: {kind!r}")


def _clean_code(code: str | None) -> str:
    """A code is shown without spaces, so it copies as one string."""
    return _JS_SPACE.sub("", clean_line(code))


def _step_items(block: dict) -> list[str]:
    return [text for text in (clean_line(item) for item in block.get("items", [])) if text]


def _list_item_html(item: dict) -> str:
    parts = []
    tag = clean_line(item.get("tag"))
    if tag:
        parts.append(fill("item_tag", {"text": e(tag)}))
    title = clean_line(item.get("title"))
    href = clean_line(item.get("href"))
    if not title:
        parts.append(fill("item_title", {"text": _missing_html(not_provided())}))
    elif href and is_safe_url(href):
        parts.append(fill("item_title_link", {"href": e(href), "text": e(title)}))
    else:
        parts.append(fill("item_title", {"text": e(title)}))
    summary = clean_multiline(item.get("summary"))
    if summary:
        parts.append(fill("item_summary", {"text": e(summary).replace("\n", "<br>\n")}))
    meta = clean_line(item.get("meta"))
    if meta:
        parts.append(fill("item_meta", {"text": e(meta)}))
    return "".join(parts)


def check_document(doc: dict) -> None:
    """A verification code never appears in the subject or preheader (both show in notifications and
    inbox lists), and correspondence uses only the correspondence blocks."""
    visible = f"{clean_line(doc.get('title'))}\n{clean_line(doc.get('preheader'))}"
    correspondence = doc.get("mode") == "correspondence"
    for block in doc.get("blocks", []):
        if block["type"] == "code":
            code = _clean_code(block.get("code"))
            if code and code in visible:
                raise ValueError("A verification code must not appear in the subject or preheader.")
        if correspondence and block["type"] not in CORRESPONDENCE_BLOCKS:
            raise ValueError(f"Correspondence email cannot use a {block['type']} block.")


def _block_pad(block: dict, previous: dict | None) -> int:
    if previous is None or previous["type"] == "section":
        return 0
    if block["type"] == "section":
        return 28
    if block["type"] == "badge":
        return 12
    if block["type"] == "text" and previous["type"] == "heading":
        # A muted line right under a heading reads as its subtitle (the enquiry email's organisation).
        return 4 if block.get("tone") == "muted" else 12
    return 16


def _pick_filled(company: dict) -> dict:
    return {key: clean_line(value) for key, value in company.items() if clean_line(value)}


def _company_lines(company: dict) -> tuple[str, str]:
    facts = {**spec()["companyPlaceholders"], **_pick_filled(company)}
    return (
        f"{facts['legalName']}, company number {facts['companyNumber']}",
        f"Registered office: {facts['registeredOffice']}",
    )


def _display_url(url: str) -> str:
    return re.sub(r"/\Z", "", re.sub(r"^https://", "", url, flags=re.IGNORECASE))


def _social(footer: dict) -> list[dict]:
    links = []
    for link in footer.get("social", []):
        url = clean_line(link.get("url"))
        img = image_by_id(link.get("contentId", ""))
        if img and is_safe_url(url):
            links.append({"label": clean_line(link.get("label")), "url": url, "image": img})
    return links


_UNSUBSCRIBE_FALLBACK = "Unsubscribe: reply to this email with the word unsubscribe"


def _company_footer_html(footer: dict, pad: str) -> str:
    company = footer.get("company", {})
    product = clean_line(footer.get("product"))
    placeholders = spec()["companyPlaceholders"]
    company_line, office_line = _company_lines(company)
    filled = _pick_filled(company)
    website = filled.get("website", "")
    support = filled.get("supportEmail", "")
    if website and is_safe_url(website):
        website_html = fill("footer_link", {"href": e(website), "text": e(_display_url(website))})
    else:
        website_html = e(website or placeholders["website"])
    if support:
        support_html = fill("footer_link", {"href": e(f"mailto:{support}"), "text": e(support)})
    else:
        support_html = e(placeholders["supportEmail"])
    lines = f"{e(company_line)}<br>{e(office_line)}<br>{website_html} · {support_html}"
    return fill("footer_text", {"pad": pad, "text": f"{e(product)}<br>{lines}" if product else lines})


def _footer_html(footer: dict, compact: bool = False) -> tuple[str, list[dict]]:
    if compact:
        return _company_footer_html(footer, "16"), []
    rows: list[str] = []
    images: list[dict] = []
    notice = clean_multiline(footer.get("notice"))
    if notice:
        rows.append(fill("footer_text", {"pad": "16", "text": e(notice)}))

    social = _social(footer)
    if social:
        links = []
        for link in social:
            images.append(link["image"])
            links.append(
                fill(
                    "footer_social_link",
                    {
                        "href": e(link["url"]),
                        "image": _image_html(link["image"], f"Vitalos on {link['label']}"),
                    },
                )
            )
        rows.append(fill("footer_social", {"links": "".join(links)}))

    rows.append(_company_footer_html(footer, "8" if social else "16"))

    unsubscribe = footer.get("unsubscribe")
    if unsubscribe:
        reason = clean_line(unsubscribe.get("reason"))
        url = clean_line(unsubscribe.get("url"))
        link = (
            fill("footer_link", {"href": e(url), "text": "Unsubscribe"})
            if is_safe_url(url)
            else e(_UNSUBSCRIBE_FALLBACK)
        )
        rows.append(fill("footer_text", {"pad": "12", "text": f"{e(reason)}<br>{link}"}))
    return "\n".join(rows), images


def render_html(doc: dict) -> tuple[str, list[dict]]:
    check_document(doc)
    correspondence = doc.get("mode") == "correspondence"
    blocks = doc.get("blocks", [])
    body = "\n".join(
        fill(
            "row",
            {
                "pad": str(_block_pad(block, blocks[index - 1] if index else None)),
                "content": _block_html(block),
            },
        )
        for index, block in enumerate(blocks)
    )
    footer, footer_images = _footer_html(doc.get("footer", {}), correspondence)
    s = spec()
    logo = s["images"]["logo"]
    html = fill(
        "shell",
        {
            "title": e(clean_line(doc.get("title"))),
            "style_blocks": "\n".join(fill("style", {"css": css}) for css in s["styleBlocks"]),
            "preheader": e(clean_line(doc.get("preheader"))) + s["preheaderPad"],
            "header": ""
            if correspondence
            else fill(
                "header",
                {"logo": _image_html(logo, "Vitalos"), "label": e(clean_line(doc.get("headerLabel")))},
            ),
            "card_edge": CARD_EDGE_ALONE if correspondence else CARD_EDGE,
            "body": body,
            "footer": footer,
        },
    )
    return html, (footer_images if correspondence else [logo, *footer_images])


def _detail_text(row: dict) -> list[str]:
    value = clean_line(row.get("value")) or _missing(row.get("missing"))
    note = f" ({clean_line(row['note'])})" if row.get("note") else ""
    hint = f" [{clean_line(row['hint'])}]" if row.get("hint") and clean_line(row.get("value")) else ""
    label = clean_line(row.get("label"))
    lines = [f"{label}: {value}{note}{hint}"]
    if row.get("subvalue"):
        sub_label = row.get("subvalueLabel")
        lines.append(
            f"{label} ({'detail' if sub_label is None else sub_label}): {clean_line(row['subvalue'])}"
        )
    return lines


def _block_text(block: dict) -> str:
    kind = block["type"]
    if kind == "heading":
        return clean_line(block.get("text")) or _missing(block.get("missing"))
    if kind == "section":
        return clean_line(block.get("text")).upper()
    if kind == "text":
        return clean_multiline(block.get("text")) or _missing(block.get("missing"))
    if kind == "button":
        url = clean_line(block.get("url"))
        return f"{clean_line(block.get('label'))}: {url if is_safe_url(url) else 'link not available'}"
    if kind == "badge":
        return " · ".join(text for text, _tone in _badge_items(block))
    if kind == "quote":
        text = clean_multiline(block.get("text"))
        if not text:
            return f"> {_missing(block.get('missing'))}"
        return "\n".join(f"> {line}" if line else ">" for line in text.split("\n"))
    if kind == "details":
        return "\n".join(line for row in block.get("rows", []) for line in _detail_text(row))
    if kind == "divider":
        return "----"
    if kind == "signature":
        lines = ["Kind regards,", clean_line(block.get("name")) or "Vitalos", clean_line(block.get("title"))]
        return "\n".join([line for line in lines if line] + ["Vitalos Technologies"])
    if kind == "code":
        code = _clean_code(block.get("code")) or _missing(block.get("missing"))
        expiry = clean_line(block.get("expiry"))
        return f"{code}\n{expiry}" if expiry else code
    if kind == "steps":
        title = clean_line(block.get("title"))
        steps = [f"{index + 1}. {text}" for index, text in enumerate(_step_items(block))]
        return "\n".join([title.upper(), *steps] if title else steps)
    if kind == "items":
        return "\n\n".join(_list_item_text(item) for item in block.get("items", []))
    if kind == "stats":
        return "\n".join(
            f"{clean_line(stat.get('label'))}: {clean_line(stat.get('value')) or not_provided()}"
            for stat in block.get("items", [])
        )
    raise ValueError(f"Unknown block type: {kind!r}")


def _list_item_text(item: dict) -> str:
    tag = clean_line(item.get("tag"))
    title = clean_line(item.get("title")) or not_provided()
    href = clean_line(item.get("href"))
    lines = [
        f"[{tag}] {title}" if tag else title,
        clean_multiline(item.get("summary")),
        clean_line(item.get("meta")),
        href if href and is_safe_url(href) else "",
    ]
    return "\n".join(line for line in lines if line)


def _company_text(footer: dict) -> list[str]:
    company = footer.get("company", {})
    product = clean_line(footer.get("product"))
    placeholders = spec()["companyPlaceholders"]
    company_line, office_line = _company_lines(company)
    filled = _pick_filled(company)
    website = _display_url(filled["website"]) if filled.get("website") else placeholders["website"]
    lines = [
        company_line,
        office_line,
        f"{website} · {filled.get('supportEmail', placeholders['supportEmail'])}",
    ]
    return [product, *lines] if product else lines


def _footer_text(footer: dict, compact: bool = False) -> str:
    parts = ["--"]
    if compact:
        return "\n".join(parts + _company_text(footer))
    notice = clean_multiline(footer.get("notice"))
    if notice:
        parts += [notice, ""]
    social = _social(footer)
    if social:
        parts += [f"{link['label']}: {link['url']}" for link in social] + [""]
    parts += _company_text(footer)
    unsubscribe = footer.get("unsubscribe")
    if unsubscribe:
        url = clean_line(unsubscribe.get("url"))
        parts += [
            "",
            clean_line(unsubscribe.get("reason")),
            f"Unsubscribe: {url}" if is_safe_url(url) else _UNSUBSCRIBE_FALLBACK,
        ]
    return "\n".join(parts)


def render_text(doc: dict) -> str:
    """The plain-text part: every block, in the same order as the HTML."""
    check_document(doc)
    correspondence = doc.get("mode") == "correspondence"
    chunks = [] if correspondence else [f"VITALOS · {clean_line(doc.get('headerLabel')).upper()}"]
    blocks = doc.get("blocks", [])
    for index, block in enumerate(blocks):
        if index == 0 and correspondence:
            chunks.append(_block_text(block))
            continue
        separator = "\n" if index and blocks[index - 1]["type"] == "section" else "\n\n"
        chunks += [separator, _block_text(block)]
    chunks += ["\n\n", _footer_text(doc.get("footer", {}), correspondence)]
    return "".join(chunks)


@dataclass(frozen=True)
class RenderedEmail:
    html: str
    text: str
    inline_images: list[dict]


def render_email(doc: dict) -> RenderedEmail:
    html, images = render_html(doc)
    return RenderedEmail(html=html, text=render_text(doc), inline_images=images)


def force_theme(html: str, theme: str) -> str:
    """For previews: apply the dark theme unconditionally, or never."""
    query = spec()["darkMediaQuery"]
    if theme == "dark":
        return html.replace(query, "@media all", 1)
    if theme == "light":
        return html.replace(query, "@media not all", 1)
    return html
