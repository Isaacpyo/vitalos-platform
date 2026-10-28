"""Staff-side reads for the Client portal admin. Staff see everything, including internal-only fields, so these
are used ONLY by views behind ``staff_required`` (never by customer views, search, AI or notifications)."""

from __future__ import annotations

from django.db.models import Q

from . import selectors
from .models import (
    BriefStatus,
    BriefVersion,
    Challenge,
    ChangeRequest,
    ChangeStatus,
    Deliverable,
    DeliverableVersion,
    EmailDelivery,
    Event,
    InformationRequest,
    Invitation,
    Membership,
    Organisation,
)


def outstanding_decisions() -> dict:
    """What is waiting on customers, across every organisation."""
    versions = []
    for v in (
        DeliverableVersion.objects.select_related("deliverable__project__challenge__organisation")
        .filter(shared_at__isnull=False, withdrawn_at__isnull=True, requires_approval=True)
        .order_by("shared_at")
    ):
        latest = (
            DeliverableVersion.objects.filter(
                deliverable=v.deliverable, shared_at__isnull=False, withdrawn_at__isnull=True
            )
            .order_by("-number")
            .first()
        )
        if latest and latest.pk == v.pk and selectors.version_state(v) == "pending":
            versions.append(v)
    return {
        "versions": versions,
        "briefs": BriefVersion.objects.select_related("challenge__organisation").filter(
            status=BriefStatus.PROPOSED
        ),
        "questions": InformationRequest.objects.select_related("challenge__organisation").filter(
            status=InformationRequest.Status.OPEN, published_at__isnull=False
        ),
        "changes": ChangeRequest.objects.select_related("project__challenge__organisation").filter(
            status__in=[ChangeStatus.SUBMITTED, ChangeStatus.UNDER_REVIEW]
        ),
    }


def recent_customer_activity(limit=15):
    return Event.objects.select_related("challenge__organisation").filter(actor_is_customer=True)[:limit]


def failed_deliveries():
    return EmailDelivery.objects.filter(status=EmailDelivery.Status.FAILED)


def organisations():
    return Organisation.objects.all()


def members(organisation):
    return Membership.objects.select_related("user").filter(organisation=organisation).order_by("-created_at")


def invitation_state(member) -> str:
    inv = Invitation.objects.filter(membership=member).order_by("-created_at").first()
    if member.accepted_at:
        return "Active" if member.is_active and not member.revoked_at else "Revoked"
    if member.revoked_at:
        return "Revoked"
    return {
        "pending": "Invited",
        "expired": "Invitation expired",
        "used": "Accepted",
        "revoked": "Invitation replaced",
    }.get(inv.state if inv else "", "Not invited")


def challenge_for_opportunity(opportunity):
    return Challenge.objects.select_related("organisation").filter(opportunity=opportunity).first()


def challenge_deliverables(challenge):
    return Deliverable.objects.filter(project__challenge=challenge)


def challenge_filter(user_id=None):
    return Q()
