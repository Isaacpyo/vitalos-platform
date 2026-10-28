"""Template helpers for the customer portal."""

from __future__ import annotations

from django import template
from django.urls import NoReverseMatch, reverse
from django.utils.html import format_html

from ..access import portal_path

register = template.Library()

# Status words map to calm semantic tones; the portal stylesheet defines .badge--<tone>.
TONES = {
    "complete": "ok",
    "approved": "ok",
    "accepted": "ok",
    "agreed": "ok",
    "answered": "ok",
    "operational": "ok",
    "stored": "ok",
    "sent": "ok",
    "in_progress": "info",
    "proposed": "info",
    "pending": "info",
    "under_review": "info",
    "submitted": "info",
    "planning": "info",
    "active": "info",
    "open": "warn",
    "awaiting_customer": "warn",
    "changes_requested": "warn",
    "degraded": "warn",
    "maintenance": "warn",
    "stale": "warn",
    "on_hold": "warn",
    "unavailable": "warn",
    "blocked": "danger",
    "declined": "danger",
    "incident": "danger",
    "failed": "danger",
    "rejected": "danger",
}
LABELS = {
    "pending": "Waiting for a decision",
    "approved": "Approved",
    "changes_requested": "Changes requested",
    "superseded": "Replaced by a newer version",
}


@register.simple_tag(takes_context=True)
def purl(context, name, **kwargs):
    """Address of a portal route on the surface being viewed (the customer site or a staff preview)."""
    return portal_path(context["request"], name, kwargs)


@register.simple_tag(takes_context=True)
def purl_kw(context, name, kwargs=None):
    """Like ``purl`` but with the arguments in a dict (used for stored targets); a stale target goes home."""
    try:
        return portal_path(context["request"], name or "home", dict(kwargs or {}))
    except NoReverseMatch:
        return portal_path(context["request"], "home", {})


@register.simple_tag
def badge(value, label=""):
    key = str(value)
    tone = TONES.get(key, "neutral")
    text = label or LABELS.get(key) or key.replace("_", " ").capitalize()
    return format_html('<span class="badge badge--{}">{}</span>', tone, text)


@register.filter
def provenance_label(value):
    return {
        "customer_statement": "Your words",
        "ai_suggestion": "AI suggestion",
        "agreed_fact": "Agreed fact",
    }.get(value, value)


@register.filter
def provenance_class(value):
    return {"customer_statement": "customer", "ai_suggestion": "ai", "agreed_fact": "fact"}.get(
        value, "customer"
    )


@register.filter
def person(user, is_staff=False):
    """A display name that never exposes a staff member's email address to a customer."""
    name = (getattr(user, "full_name", "") or "").strip()
    if is_staff:
        return f"{name} (Vitalos)" if name else "Vitalos team"
    return name or getattr(user, "email", "")


@register.filter
def human(value):
    return str(value).replace("_", " ")


@register.filter
def initials(name):
    parts = str(name).replace("(Vitalos)", "").split()
    return "".join(p[0] for p in parts[:2]).upper() or "V"


@register.simple_tag
def admin_url(name, *args):
    return reverse(f"portaladmin:{name}", args=args)


@register.simple_tag
def portal_panel(opportunity):
    """Staff-only summary for the opportunity workspace: the linked challenge and what is awaiting the customer."""
    from .. import continuity, staff_selectors
    from ..models import InformationRequest

    challenge = staff_selectors.challenge_for_opportunity(opportunity)
    waiting = 0
    status = proposal = project = None
    if challenge is not None:
        waiting = (
            InformationRequest.objects.filter(
                challenge=challenge, status="open", published_at__isnull=False
            ).count()
            + challenge.briefs.filter(status="proposed").count()
        )
        status = continuity.challenge_status(challenge)
        proposal = continuity.approved_proposal(opportunity)
        project = continuity.project_from_proposal(challenge)
    return {
        "challenge": challenge,
        "waiting": waiting,
        "status": status,
        "difference": status["difference"] if status else None,
        "approved_proposal": proposal,
        "proposal_project": project,
    }
