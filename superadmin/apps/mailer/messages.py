"""Build a Django email from a rendered layout: plain text, HTML, inline (CID) images and any files.

This is the Super Admin's one mailer module: everything else sends through ``build_message`` (or
``apps.mailer.system`` on top of it), never through Django's mail classes directly (docs/email).
"""

from __future__ import annotations

import base64
from email.message import EmailMessage, MIMEPart

from django.core.mail import EmailMultiAlternatives

from .layout import RenderedEmail


def _is_inline(attachment) -> bool:
    return isinstance(attachment, MIMEPart) and attachment.get_content_disposition() == "inline"


class RelatedEmailMessage(EmailMultiAlternatives):
    """Inline (CID) images are nested in multipart/related with the alternatives they belong to; file
    attachments, if any, then wrap the whole in multipart/mixed.

    Django 6 removed ``mixed_subtype``; ``_add_attachments`` is the only hook that controls the container.
    """

    def _add_attachments(self, msg):
        if not self.attachments:
            return
        inline = [a for a in self.attachments if _is_inline(a)]
        files = [a for a in self.attachments if not _is_inline(a)]
        if inline:
            # EmailMessage.make_related() refuses multipart/alternative, so wrap it by hand:
            # multipart/related holding the alternative part first, then the images it references.
            inner = EmailMessage(policy=msg.policy)
            inner["Content-Type"] = msg["Content-Type"]
            inner.set_payload(msg.get_payload())
            msg.replace_header("Content-Type", "multipart/related")
            msg.set_payload([inner, *inline])
        if files:
            msg.make_mixed()
            for attachment in files:
                if isinstance(attachment, MIMEPart):
                    msg.attach(attachment)
                else:
                    self._add_attachment(msg, *attachment)


def build_message(
    rendered: RenderedEmail,
    *,
    subject: str,
    to: list[str],
    from_email: str,
    reply_to: list[str] | None = None,
    headers: dict[str, str] | None = None,
    attachments: list[tuple[str, bytes, str]] | None = None,
) -> RelatedEmailMessage:
    """multipart/related: the text and HTML alternatives, then the images the HTML references; files
    (``(filename, content, mimetype)``) make it multipart/mixed around that."""
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
    for filename, content, mimetype in attachments or ():
        message.attach(filename, content, mimetype)
    return message
