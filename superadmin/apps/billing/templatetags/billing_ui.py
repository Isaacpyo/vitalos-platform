"""Display helpers for billing pages: money in pence, status badges, quantities and QR codes."""

import re

import qrcode
import qrcode.image.svg
from django import template
from django.utils.safestring import mark_safe

from apps.core.templatetags.ui import _BADGE, _STYLES

from .. import money

register = template.Library()

STATUS_TONES = {
    "draft": "slate",
    "issued": "blue",
    "partially_paid": "amber",
    "paid": "green",
    "void": "red",
    "succeeded": "green",
    "refunded": "violet",
}
_SVG_SIZE = re.compile(r'\swidth="[^"]*"\sheight="[^"]*"')


@register.filter
def pence(value):
    """Integer pence as £1,234.50."""
    return money.format_gbp(value)


@register.filter
def qty(value):
    return money.format_quantity(value) if value not in (None, "") else ""


@register.filter
def status_badge(status):
    return _BADGE + _STYLES[STATUS_TONES.get(str(status), "slate")]


@register.filter
def first_line(text):
    return str(text or "").strip().split("\n", 1)[0].strip()


@register.filter
def other_lines(text):
    """Everything after a description's first line (printed smaller, as detail)."""
    parts = str(text or "").strip().split("\n", 1)
    return parts[1].strip() if len(parts) > 1 else ""


@register.filter
def short_url(url):
    """``https://buy.stripe.com/abc`` → ``buy.stripe.com/abc`` for print."""
    return re.sub(r"^https?://", "", str(url or "")).rstrip("/")


@register.simple_tag
def qr_svg(url):
    """An inline SVG QR code for an https URL (empty for anything else)."""
    url = str(url or "")
    if not url.startswith("https://") or len(url) > 500:
        return ""
    image = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=0)
    svg = image.to_string(encoding="unicode")
    svg = _SVG_SIZE.sub(' role="img" aria-label="QR code" shape-rendering="crispEdges"', svg, count=1)
    # Generated locally: the path encodes the URL as squares, so no text from the URL reaches the markup.
    return mark_safe(svg)  # noqa: S308  # nosec B308 B703
