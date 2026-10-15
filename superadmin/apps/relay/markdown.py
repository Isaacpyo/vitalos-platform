"""Server-side Markdown preview for knowledge entries: a small, safe subset, then nh3.

Raw HTML is never passed through: the source is HTML-escaped before any Markdown is applied, links
accept only https and mailto, and the result is cleaned again with nh3 against a short allow-list.
Supported: headings, paragraphs, bullet and numbered lists, block quotes, fenced code, inline code,
bold, italic and links. That is all Relay knowledge entries use.
"""

import html
import re

import nh3
from django.utils.safestring import SafeString, mark_safe

ALLOWED_TAGS = {
    "p",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "code",
    "pre",
    "blockquote",
    "a",
    "br",
}
_LINK = re.compile(r"\[([^\]\n]+)\]\(((?:https://|mailto:)[^\s)]+)\)")
_CODE = re.compile(r"`([^`\n]+)`")
_BOLD = re.compile(r"\*\*([^*\n]+)\*\*")
_ITALIC = re.compile(r"(?<![\w*])[*_]([^*_\n]+)[*_](?![\w*])")
_HEADING = re.compile(r"^(#{1,6})\s+(.*)$")
_BULLET = re.compile(r"^\s*[-*]\s+(.*)$")
_NUMBER = re.compile(r"^\s*\d+[.)]\s+(.*)$")


def _inline(text: str) -> str:
    codes: list[str] = []

    def keep(match):
        codes.append(match.group(1))
        return f"\x00{len(codes) - 1}\x00"

    text = _CODE.sub(keep, text)
    text = _LINK.sub(lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>', text)
    text = _BOLD.sub(r"<strong>\1</strong>", text)
    text = _ITALIC.sub(r"<em>\1</em>", text)
    return re.sub(r"\x00(\d+)\x00", lambda m: f"<code>{codes[int(m.group(1))]}</code>", text)


def _blocks(source: str) -> list[str]:
    lines = source.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out: list[str] = []
    paragraph: list[str] = []
    items: list[str] = []
    list_tag = ""
    quote: list[str] = []
    index = 0

    def flush():
        nonlocal list_tag
        if paragraph:
            out.append("<p>" + "<br>".join(_inline(line) for line in paragraph) + "</p>")
            paragraph.clear()
        if items:
            out.append(
                f"<{list_tag}>" + "".join(f"<li>{_inline(item)}</li>" for item in items) + f"</{list_tag}>"
            )
            items.clear()
            list_tag = ""
        if quote:
            out.append("<blockquote><p>" + "<br>".join(_inline(line) for line in quote) + "</p></blockquote>")
            quote.clear()

    while index < len(lines):
        line = lines[index]
        if line.strip().startswith("```"):
            flush()
            code = []
            index += 1
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code.append(lines[index])
                index += 1
            out.append("<pre><code>" + "\n".join(code) + "</code></pre>")
        elif not line.strip():
            flush()
        elif heading := _HEADING.match(line):
            flush()
            level = min(len(heading.group(1)) + 1, 4)
            out.append(f"<h{level}>{_inline(heading.group(2).strip())}</h{level}>")
        elif line.lstrip().startswith("&gt;"):
            if paragraph or items:
                flush()
            quote.append(line.lstrip()[4:].lstrip())
        elif (bullet := _BULLET.match(line)) or (number := _NUMBER.match(line)):
            tag = "ul" if bullet else "ol"
            if paragraph or quote or (items and list_tag != tag):
                flush()
            list_tag = tag
            items.append((bullet or number).group(1))
        else:
            if items or quote:
                flush()
            paragraph.append(line.strip())
        index += 1
    flush()
    return out


def render(source: str | None) -> SafeString:
    escaped = html.escape(source or "", quote=True)
    rendered = "\n".join(_blocks(escaped))
    cleaned = nh3.clean(
        rendered,
        tags=ALLOWED_TAGS,
        attributes={"a": {"href"}},
        url_schemes={"https", "mailto"},
        link_rel="noopener noreferrer nofollow",
        strip_comments=True,
    )
    return mark_safe(cleaned)  # noqa: S308  # nosec B308 B703 - escaped, then cleaned by nh3
