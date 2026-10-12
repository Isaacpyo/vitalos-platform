"""Build a Django email from a rendered layout: plain text, HTML and inline (CID) images."""

from __future__ import annotations

import base64
from email.message import EmailMessage, MIMEPart

from django.core.mail import EmailMultiAlternatives

from .layout import RenderedEmail


class RelatedEmailMessage(EmailMultiAlternatives):
    """Attachments are inline (CID) images, so nest them in multipart/related, not multipart/mixed.

    Django 6 removed ``mixed_subtype``; ``_add_attachments`` is the only hook that controls the container.
    """

    def _add_attachments(self, msg):
        if not self.attachments:
            return
        # EmailMessage.make_related() refuses multipart/alternative, so wrap it by hand:
        # multipart/related holding the alternative part first, then the images it references.
        inner = EmailMessage(policy=msg.policy)
        inner["Content-Type"] = msg["Content-Type"]
        inner.set_payload(msg.get_payload())
        msg.replace_header("Content-Type", "multipart/related")
        msg.set_payload([inner, *self.attachments])


def build_message(
    rendered: RenderedEmail,
    *,
    subject: str,
    to: list[str],
    from_email: str,
    reply_to: list[str] | None = None,
    headers: dict[str, str] | None = None,
) -> RelatedEmailMessage:
    """multipart/related: the text and HTML alternatives, then the images the HTML references."""
    message = RelatedEmailMessage(
        subject=subject,
        body=rendered.text,
        from_email=from_email,
        to=to,
        reply_to=reply_to,
        headers=headers or {},
    )
    message.attach_alternative(rendered.html, "text/html")
    for img in rendered.inline_images:
        maintype, subtype = img["contentType"].split("/", 1)
        part = MIMEPart()
        part.set_content(
            base64.b64decode(img["base64"]),
            maintype=maintype,
            subtype=subtype,
            disposition="inline",
            filename=img["filename"],
            cid=f"<{img['contentId']}>",
        )
        message.attach(part)
    return message
