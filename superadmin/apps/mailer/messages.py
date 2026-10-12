"""Build a Django email from a rendered layout: plain text, HTML and inline (CID) images."""

from __future__ import annotations

import base64
from email.mime.image import MIMEImage

from django.core.mail import EmailMultiAlternatives

from .layout import RenderedEmail


def build_message(
    rendered: RenderedEmail,
    *,
    subject: str,
    to: list[str],
    from_email: str,
    reply_to: list[str] | None = None,
    headers: dict[str, str] | None = None,
) -> EmailMultiAlternatives:
    """multipart/related: the text and HTML alternatives, then the images the HTML references."""
    message = EmailMultiAlternatives(
        subject=subject,
        body=rendered.text,
        from_email=from_email,
        to=to,
        reply_to=reply_to,
        headers=headers or {},
    )
    message.attach_alternative(rendered.html, "text/html")
    message.mixed_subtype = "related"
    for img in rendered.inline_images:
        part = MIMEImage(base64.b64decode(img["base64"]), _subtype=img["contentType"].split("/")[1])
        part.add_header("Content-ID", f"<{img['contentId']}>")
        part.add_header("Content-Disposition", "inline", filename=img["filename"])
        message.attach(part)
    return message
