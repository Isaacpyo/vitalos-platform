"""The seams between the admin workspace (``apps.aidata``) and the portal (ADR-055, ADR-056).

Four things live here, because each crosses the boundary and none belongs in a view:

* ``carried_brief_segments``: what a newly linked challenge carries over from an APPROVED workspace brief;
* ``create_project_from_proposal``: an explicit, idempotent, unpublished prefill from an APPROVED proposal;
* ``stage_difference`` and ``sync_customer_stage``: the opportunity's stage versus what the customer sees;
* ``challenge_status`` and ``queue_items``: what staff see for each active challenge, and the portal-derived
  entries of the overview work queue.

Rules: nothing here publishes. Internal notes, scores, prices, qualification and unapproved drafts are never
read into customer-visible fields. The portal stores the proposal's id as a number and imports the
workspace's models only inside functions.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

from django.db import transaction
from django.urls import reverse
from django.utils import timezone

from apps.audit.services import record

from . import selectors
from .models import (
    Approval,
    BriefStatus,
    Challenge,
    ChangeRequest,
    ChangeStatus,
    Deliverable,
    DeliverableVersion,
    EmailDelivery,
    InformationRequest,
    InformationResponse,
    ItemKind,
    Journey,
    Milestone,
    MilestoneStatus,
    Party,
    Project,
    ProjectItem,
)

SEGMENT_LIMIT = 2000

# --- Brief continuity ---------------------------------------------------------------------------------------------

#: Approved brief fields that become brief segments, in reading order, with the label the customer sees.
BRIEF_FIELDS = (
    ("problem_summary", "The problem"),
    ("current_tools", "How it works today"),
    ("desired_outcome", "What good looks like"),
    ("timeframe", "Timeframe"),
)


def _chunks(text: str, limit: int = SEGMENT_LIMIT) -> list[str]:
    """Split ``text`` at line boundaries into pieces of at most ``limit`` characters. Joining the pieces gives
    back exactly the original text (nothing trimmed, nothing added)."""
    pieces: list[str] = []
    current = ""
    for line in text.splitlines(keepends=True):
        while len(line) > limit:
            if current:
                pieces.append(current)
                current = ""
            pieces.append(line[:limit])
            line = line[limit:]
        if len(current) + len(line) > limit:
            pieces.append(current)
            current = ""
        current += line
    if current:
        pieces.append(current)
    return pieces


def approved_brief(opportunity):
    """The latest APPROVED brief draft of the opportunity, or None. Drafts, reviewed or failed ones never count."""
    from apps.aidata.models import Draft, DraftKind, DraftState

    return (
        Draft.objects.filter(opportunity=opportunity, kind=DraftKind.BRIEF, state=DraftState.APPROVED)
        .order_by("-version")
        .first()
    )


def _norm(value) -> str:
    return " ".join(str(value or "").split()).lower()


def _ai_values(draft) -> dict[str, str]:
    """What the model proposed for each field (only when the brief was prepared with AI)."""
    if draft.mode != "ai":
        return {}
    items = (draft.ai_payload or {}).get("fields", [])
    return {i.get("name"): i.get("value", "") for i in items if isinstance(i, dict)}


def original_statement(opportunity, brief) -> str:
    """The customer's own submission, exactly as received: the first inbound message of the source enquiry,
    or (for an opportunity made from pasted text) the pasted source the brief was prepared from."""
    from apps.aidata import workspace

    if opportunity.enquiry_id:
        text = workspace.original_enquiry_text(opportunity.enquiry)
        if text.strip():
            return text
    return brief.source_text or ""


def carried_brief_segments(opportunity) -> list[dict] | None:
    """Segments for the first brief version of a challenge, or None when there is no approved brief.

    * The original enquiry text, unchanged, as ``customer_statement`` segments.
    * Each approved field of the brief as one segment: ``ai_suggestion`` when the model proposed that exact
      wording and staff approved it unchanged, ``agreed_fact`` when staff wrote or edited it (or rules read it
      from the customer's words) and approved it.

    Never read: notes, scores, prices, qualification, discovery, proposal, or any draft that is not approved.
    """
    brief = approved_brief(opportunity)
    if brief is None:
        return None
    fields = (brief.payload or {}).get("fields", {})
    ai = _ai_values(brief)
    segments: list[dict] = []

    def add(text, provenance):
        segments.append({"id": f"s{len(segments) + 1}", "text": text, "provenance": provenance})

    for piece in _chunks(original_statement(opportunity, brief)):
        if piece.strip():
            add(piece, "customer_statement")
    for name, label in BRIEF_FIELDS:
        value = str(fields.get(name) or "").strip()
        if not value:
            continue
        provenance = "ai_suggestion" if name in ai and _norm(ai[name]) == _norm(value) else "agreed_fact"
        add(f"{label}: {value}"[:SEGMENT_LIMIT], provenance)
    return segments


# --- Proposal to project ------------------------------------------------------------------------------------------


class ContinuityError(Exception):
    """A refusal with a message that is safe to show to staff."""


def approved_proposal(opportunity):
    from apps.aidata.models import Draft, DraftKind, DraftState

    return (
        Draft.objects.filter(opportunity=opportunity, kind=DraftKind.PROPOSAL, state=DraftState.APPROVED)
        .order_by("-version")
        .first()
    )


def project_from_proposal(challenge: Challenge) -> Project | None:
    return challenge.projects.filter(source_proposal_id__isnull=False).order_by("created_at").first()


def _lines(items, limit=500):
    return [str(i).strip()[:limit] for i in items or [] if str(i).strip()]


def create_project_from_proposal(challenge: Challenge, *, actor, request=None) -> tuple[Project, bool]:
    """Prefill an unpublished project from the opportunity's approved proposal. Returns ``(project, created)``.

    Idempotent: when this challenge already has a project made from a proposal, that project is returned and
    nothing is written. The price is never copied; nothing is published; no Deliverable has a version.
    """
    existing = project_from_proposal(challenge)
    if existing is not None:
        return existing, False
    proposal = approved_proposal(challenge.opportunity)
    if proposal is None:
        raise ContinuityError(
            "Approve a proposal draft first. A portal project is prefilled only from an approved one."
        )
    data = proposal.payload or {}
    scope = _lines(data.get("scope"))
    exclusions = _lines(data.get("exclusions"))
    agreed_scope = "\n".join(f"- {line}" for line in scope)
    if exclusions:
        agreed_scope += (
            ("\n\n" if agreed_scope else "")
            + "Not included:\n"
            + "\n".join(f"- {line}" for line in exclusions)
        )
    with transaction.atomic():
        locked = Challenge.objects.select_for_update().select_related("opportunity").get(pk=challenge.pk)
        existing = project_from_proposal(locked)
        if existing is not None:
            return existing, False
        project = Project.objects.create(
            challenge=locked,
            name=(str(data.get("title") or "").strip() or f"Project for {locked.title}")[:200],
            summary=str(data.get("summary") or "").strip()[:4000],
            agreed_scope=agreed_scope,
            internal_notes=(
                f"Prefilled from {locked.opportunity.ref} proposal v{proposal.version}. Review before publishing."
            ),
            source_proposal_id=proposal.pk,
        )
        for position, row in enumerate(data.get("milestones") or [], start=1):
            name = str(row.get("name", "")).strip()
            if not name:
                continue
            description = str(row.get("description", "")).strip()
            target = str(row.get("target", "")).strip()
            if target:
                description = f"{description} (Target: {target})".strip()
            Milestone.objects.create(
                project=project, title=name[:200], description=description[:500], position=position
            )
        for title in _lines(data.get("deliverables"), 200):
            Deliverable.objects.create(project=project, title=title)
            ProjectItem.objects.create(
                project=project,
                kind=ItemKind.RESPONSIBILITY,
                party=Party.VITALOS,
                text=f"Vitalos delivers: {title}"[:500],
            )
        for text in _lines(data.get("dependencies")):
            ours = text.lower().startswith(("assumption:", "to be confirmed:"))
            ProjectItem.objects.create(
                project=project,
                kind=ItemKind.DEPENDENCY,
                party=Party.VITALOS if ours else Party.CUSTOMER,
                text=text[:500],
            )
    record(
        "portal.project_from_proposal",
        request=request,
        actor=actor,
        entity=project,
        summary=f"{locked.opportunity.ref} proposal v{proposal.version} -> {project.name}"[:250],
    )
    return project, True


# --- Stage visibility ---------------------------------------------------------------------------------------------

#: Opportunity stage -> the journey stage the customer would normally see. On hold and lost have no mapping.
STAGE_MAP = {
    "new": Journey.SUBMITTED,
    "reviewing": Journey.SUBMITTED,
    "discovery": Journey.DISCOVERY,
    "qualified": Journey.ASSESSMENT,
    "proposal": Journey.PROPOSAL,
    "won": Journey.ACTIVE,
}
#: After a win the delivery stages are chosen by hand, so any of them agrees with "won".
WON_STAGES = {Journey.ACTIVE, Journey.HANDOVER, Journey.MANAGED}


@dataclass
class StageDifference:
    opportunity_stage: str
    customer_stage: str
    suggested: str
    suggested_label: str


def stage_difference(challenge: Challenge) -> StageDifference | None:
    """None when the customer-visible stage agrees with the opportunity (or there is no mapping)."""
    opp = challenge.opportunity
    suggested = STAGE_MAP.get(opp.stage)
    if suggested is None:
        return None
    current = challenge.journey_stage
    if current == suggested or (opp.stage == "won" and current in WON_STAGES):
        return None
    return StageDifference(
        opportunity_stage=opp.get_stage_display(),
        customer_stage=challenge.get_journey_stage_display(),
        suggested=suggested.value,
        suggested_label=suggested.label,
    )


def sync_customer_stage(challenge: Challenge, *, actor, request=None) -> Challenge:
    """The explicit, audited action: set the customer-visible stage to the one the opportunity maps to.
    Nothing else ever changes it as a side effect of an opportunity stage change."""
    from . import services

    difference = stage_difference(challenge)
    if difference is None:
        raise ContinuityError("The customer-visible stage already matches the opportunity.")
    before = challenge.get_journey_stage_display()
    services.update_challenge(challenge, actor=actor, request=request, journey_stage=difference.suggested)
    record(
        "portal.stage_synced",
        request=request,
        actor=actor,
        entity=challenge,
        summary=f"{challenge.opportunity.ref}: customer stage {before} -> {difference.suggested_label}",
    )
    return challenge


# --- Status for staff -----------------------------------------------------------------------------------------------


def _pending_versions(challenge: Challenge) -> list[DeliverableVersion]:
    out = []
    for v in DeliverableVersion.objects.select_related("deliverable").filter(
        deliverable__project__challenge=challenge,
        shared_at__isnull=False,
        withdrawn_at__isnull=True,
        requires_approval=True,
    ):
        if selectors.version_state(v) == "pending":
            out.append(v)
    return out


def _customer_todo(challenge: Challenge) -> list[str]:
    todo = []
    for q in InformationRequest.objects.filter(
        challenge=challenge, status=InformationRequest.Status.OPEN, published_at__isnull=False
    ):
        todo.append(f"Answer: {q.question}")
    for b in challenge.briefs.filter(status=BriefStatus.PROPOSED):
        todo.append(f"Review brief version {b.number}")
    for v in _pending_versions(challenge):
        todo.append(f"Decide on {v.deliverable.title} version {v.number}")
    for item in ProjectItem.objects.filter(
        project__challenge=challenge,
        project__published_at__isnull=False,
        party=Party.CUSTOMER,
        is_done=False,
        published_at__isnull=False,
    ).exclude(kind=ItemKind.BLOCKER):
        todo.append(item.text)
    return todo


def _blocked(challenge: Challenge, today) -> list[str]:
    blocked = [
        f"Blocker ({i.get_party_display()}): {i.text}"
        for i in ProjectItem.objects.filter(
            project__challenge=challenge, kind=ItemKind.BLOCKER, is_done=False
        )
    ]
    for m in Milestone.objects.filter(project__challenge=challenge, status=MilestoneStatus.BLOCKED):
        blocked.append(f"Milestone blocked: {m.title}")
    for q in InformationRequest.objects.filter(
        challenge=challenge,
        status=InformationRequest.Status.OPEN,
        published_at__isnull=False,
        due_date__lt=today,
    ):
        blocked.append(f"Overdue customer answer: {q.question}")
    failed = EmailDelivery.objects.filter(
        organisation=challenge.organisation, status=EmailDelivery.Status.FAILED
    ).count()
    if failed:
        blocked.append(f"{failed} portal email(s) failed to send")
    return blocked


def challenge_status(challenge: Challenge, today=None) -> dict:
    """What staff need for each active challenge: status, who is responsible, what happens next, what is
    blocked and what the customer needs to do. Staff-only: reads internal fields."""
    today = today or timezone.localdate()
    opp = challenge.opportunity
    project = challenge.projects.order_by("-created_at").first()
    next_milestone = (
        Milestone.objects.filter(project__challenge=challenge)
        .exclude(status=MilestoneStatus.COMPLETE)
        .order_by("position", "target_date", "id")
        .first()
    )
    nxt = opp.next_action or (f"Milestone: {next_milestone.title}" if next_milestone else "")
    due = opp.next_action_due
    return {
        "status": challenge.status_note or challenge.get_journey_stage_display(),
        "journey": challenge.get_journey_stage_display(),
        "shared": challenge.is_shared,
        "project": project,
        "responsible": opp.owner.email if opp.owner_id else "Unassigned",
        "next": nxt or "Nothing set",
        "next_due": due,
        "next_overdue": bool(due and due < today),
        "blocked": _blocked(challenge, today),
        "customer_todo": _customer_todo(challenge),
        "difference": stage_difference(challenge),
    }


# --- Work queue -----------------------------------------------------------------------------------------------------


@dataclass
class PortalQueue:
    """Portal-derived queue entries by queue group. Each entry is a dict of ``QueueItem`` arguments."""

    decide: list = field(default_factory=list)
    blocked: list = field(default_factory=list)
    next: list = field(default_factory=list)


APPROVAL_WINDOW = dt.timedelta(days=7)


def queue_items(today=None, now=None) -> PortalQueue:
    """Real portal records only. Each entry links to the right staff page."""
    today = today or timezone.localdate()
    now = now or timezone.now()
    q = PortalQueue()

    def challenge_url(ch):
        return reverse("portaladmin:challenge", args=[ch.pk])

    # Needs a decision: change requests awaiting review.
    for c in (
        ChangeRequest.objects.select_related("project__challenge__organisation")
        .filter(status__in=[ChangeStatus.SUBMITTED, ChangeStatus.UNDER_REVIEW])
        .order_by("created_at")
    ):
        ch = c.project.challenge
        q.decide.append(
            dict(
                title=f"Review change request: {c.title}",
                detail=f"{ch.organisation.name} / {ch.title}",
                url=reverse("portaladmin:change_review", args=[c.pk]),
                action="Review",
                evidence=f"{c.get_status_display()} {c.created_at:%-d %b}; asked for by the customer.",
                state="portal",
            )
        )
    # Deliverable decisions the customer recorded on the latest shared version.
    latest: dict[int, DeliverableVersion] = {}
    for v in (
        DeliverableVersion.objects.select_related("deliverable__project__challenge__organisation")
        .filter(shared_at__isnull=False, withdrawn_at__isnull=True)
        .order_by("number")
    ):
        latest[v.deliverable_id] = v
    for v in latest.values():
        ch = v.deliverable.project.challenge
        row = (
            Approval.objects.filter(version=v, kind=Approval.Kind.REVIEW)
            .order_by("-created_at", "-id")
            .first()
        )
        if row is None:
            continue
        label = f"{v.deliverable.title} v{v.number}"
        when = f"{row.user_name or row.user_email}, {row.created_at:%-d %b %H:%M}"
        url = reverse("portaladmin:deliverable", args=[v.deliverable_id])
        detail = f"{ch.organisation.name} / {ch.title}"
        if row.decision == Approval.Decision.CHANGES:
            q.decide.append(
                dict(
                    title=f"Changes requested on {label}",
                    detail=detail,
                    url=url,
                    action="Prepare the next version",
                    evidence=f"Changes requested by {when}.",
                    state="portal",
                )
            )
        elif row.decision == Approval.Decision.APPROVED and now - row.created_at <= APPROVAL_WINDOW:
            q.next.append(
                dict(
                    title=f"{label} approved",
                    detail=detail,
                    url=url,
                    action="Open deliverable",
                    evidence=f"Approved by {when}.",
                    state="portal",
                )
            )
    # Customer answers received and not yet read.
    for r in (
        InformationResponse.objects.select_related("request__challenge__organisation", "user")
        .filter(staff_seen_at__isnull=True)
        .order_by("created_at")
    ):
        ch = r.request.challenge
        q.next.append(
            dict(
                title=f"Read the customer's answer: {r.request.question}",
                detail=f"{ch.organisation.name} / {ch.title}",
                url=challenge_url(ch),
                action="Read the answer",
                evidence=f"Answered by {r.user.full_name or r.user.email}, {r.created_at:%-d %b %H:%M}; not yet read.",
                state="portal",
            )
        )
    # Blocked: overdue items waiting on the customer.
    for iq in InformationRequest.objects.select_related("challenge__organisation").filter(
        status=InformationRequest.Status.OPEN, published_at__isnull=False, due_date__lt=today
    ):
        ch = iq.challenge
        q.blocked.append(
            dict(
                title=f"Waiting on the customer: {iq.question}",
                detail=f"{ch.organisation.name} / {ch.title}",
                url=challenge_url(ch),
                action="Open the challenge",
                evidence=f"Due {iq.due_date:%-d %b}; overdue.",
                overdue=True,
                state="portal",
            )
        )
    for item in ProjectItem.objects.select_related("project__challenge__organisation").filter(
        party=Party.CUSTOMER, is_done=False, due_date__lt=today, published_at__isnull=False
    ):
        q.blocked.append(
            dict(
                title=f"Waiting on the customer: {item.text}",
                detail=f"{item.project.challenge.organisation.name} / {item.project.name}",
                url=reverse("portaladmin:project", args=[item.project_id]),
                action="Open the project",
                evidence=f"Due {item.due_date:%-d %b}; overdue.",
                overdue=True,
                state="portal",
            )
        )
    # Blocked: failed portal emails.
    for d in (
        EmailDelivery.objects.select_related("organisation")
        .filter(status=EmailDelivery.Status.FAILED)
        .order_by("-created_at")
    ):
        q.blocked.append(
            dict(
                title=f"Portal email failed: {d.subject}",
                detail=d.organisation.name,
                url=reverse("portaladmin:deliveries") + "?status=failed",
                action="Review and retry",
                evidence=(
                    f"{d.last_error or 'error'}; attempt {d.attempts} of {EmailDelivery.MAX_ATTEMPTS}. "
                    "The underlying action was saved."
                ),
                state="portal",
            )
        )
    return q
