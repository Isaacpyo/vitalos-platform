"""System email: the emails the Super Admin sends on its own (alerts, digests, account links).

Every one renders on the shared layout (ADR-030) with the company footer from Settings > Company, and
carries the headers automated mail needs: ``Auto-Submitted: auto-generated`` (RFC 3834),
``X-Auto-Response-Suppress: All`` and ``X-Vitalos-Notification`` naming the email, which inbound
ingestion uses to recognise the platform's own mail when it comes back to support@ (ADR-046).
"""

from __future__ import annotations

from apps.mailer import layout
from apps.mailer.messages import RelatedEmailMessage, build_message

NOTIFICATION_HEADER = "X-Vitalos-Notification"


def automated_headers(kind: str) -> dict[str, str]:
    return {
        "Auto-Submitted": "auto-generated",
        "X-Auto-Response-Suppress": "All",
        NOTIFICATION_HEADER: kind,
    }


def footer(notice: str = "") -> dict:
    """The standard footer: an optional notice, social links and the company facts."""
    from apps.email_templates.rendering import company_footer

    facts, social = company_footer()
    out: dict = {"social": social, "company": facts}
    if notice:
        out["notice"] = notice
    return out


def link_fallback(url: str) -> dict:
    """A muted line under a button, for clients that do not show the button."""
    return {
        "type": "text",
        "tone": "muted",
        "text": f"If the button does not work, copy this link into your browser: {url}",
    }


def message(
    doc: dict,
    *,
    kind: str,
    subject: str,
    to: list[str],
    from_email: str,
    reply_to: list[str] | None = None,
    headers: dict[str, str] | None = None,
) -> RelatedEmailMessage:
    """Render ``doc`` and build the message (not sent)."""
    return build_message(
        layout.render_email(doc),
        subject=layout.clean_line(subject)[:200],
        to=to,
        from_email=from_email,
        reply_to=reply_to,
        headers={**automated_headers(kind), **(headers or {})},
    )


def send(doc: dict, **kwargs) -> None:
    message(doc, **kwargs).send(fail_silently=False)
