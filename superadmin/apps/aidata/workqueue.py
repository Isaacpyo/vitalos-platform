"""Reads for the overview work queue and the opportunity timeline (ADR-055). Nothing here writes.

The queue answers four questions from real records only: what needs my decision, what has AI prepared,
what is blocked, and what should happen next. An empty queue is a normal state and says so.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

from django.urls import reverse
from django.utils import timezone

from apps.audit.models import AuditEvent

from . import selectors
from .models import Draft, DraftKind, DraftMode, DraftState, Opportunity, Stage

PER_GROUP = 8


@dataclass
class QueueItem:
    title: str
    detail: str
    url: str
    action: str
    opportunity: Opportunity | None = None
    owner: str = ""
    due: date | None = None
    evidence: str = ""
    overdue: bool = False
    state: str = ""
    source: str = ""


@dataclass
class Group:
    key: str
    title: str
    question: str
    empty: str
    items: list[QueueItem] = field(default_factory=list)
    total: int = 0


def _owner(opportunity) -> str:
    owner = getattr(opportunity, "owner", None)
    return owner.email if owner else "Unassigned"


def _tab(opportunity, tab: str) -> str:
    return f"{opportunity.get_absolute_url()}?tab={tab}"


def work_queue(today: date | None = None) -> list[Group]:
    today = today or timezone.localdate()
    decide = Group(
        "decide", "Needs your decision", "What needs my decision?", "Nothing is waiting for a decision."
    )
    prepared = Group(
        "prepared",
        "Prepared for review",
        "What has AI prepared?",
        "Nothing has been prepared yet. Paste an enquiry to start.",
    )
    blocked = Group("blocked", "Blocked", "What is blocked?", "Nothing is blocked.")
    nxt = Group(
        "next",
        "Next actions",
        "What should happen next?",
        "No next actions are due. Set one on an opportunity.",
    )

    drafts = Draft.objects.select_related("opportunity", "opportunity__owner", "created_by")
    live = drafts.exclude(opportunity__stage__in=(Stage.WON, Stage.LOST))

    # Decide: reviewed drafts waiting for approval, and enquiry previews waiting to become opportunities.
    reviewed = live.filter(
        state=DraftState.REVIEWED, kind__in=(DraftKind.DISCOVERY, DraftKind.PROPOSAL)
    ).order_by("updated_at")
    decide.total = reviewed.count()
    for draft in reviewed[:PER_GROUP]:
        opp = draft.opportunity
        decide.items.append(
            QueueItem(
                title=f"Approve {draft.get_kind_display().lower()} v{draft.version}",
                detail=f"{opp.ref} {opp.title}",
                url=_tab(opp, draft.kind),
                action="Review and approve",
                opportunity=opp,
                owner=_owner(opp),
                due=opp.next_action_due,
                evidence=f"Reviewed {draft.reviewed_at:%-d %b} by {draft.reviewed_by.email if draft.reviewed_by else 'a person'}; {draft.get_mode_display().lower()}.",
                state=draft.state,
            )
        )
    previews = drafts.filter(kind=DraftKind.BRIEF, opportunity__isnull=True, state=DraftState.DRAFT).order_by(
        "-created_at"
    )
    preview_total = previews.count()
    decide.total += preview_total
    for draft in previews[: max(0, PER_GROUP - len(decide.items))]:
        fields = draft.payload.get("fields", {})
        label = fields.get("organisation") or fields.get("contact_name") or "Pasted enquiry"
        decide.items.append(
            QueueItem(
                title=f"Review the brief for {label}",
                detail=f"{draft.source_label or 'Pasted text'} prepared {draft.created_at:%-d %b}; not yet an opportunity",
                url=reverse("aidata:brief_preview", args=[draft.pk]),
                action="Check and create",
                owner=draft.created_by.email if draft.created_by else "",
                evidence=f"{len(draft.payload.get('missing', []))} field(s) missing; {draft.get_mode_display().lower()}.",
                state=draft.state,
            )
        )

    # Prepared: drafts a person has not reviewed yet (AI, rules or hand-started).
    waiting = live.filter(
        state=DraftState.DRAFT,
        kind__in=(DraftKind.BRIEF, DraftKind.QUESTIONS, DraftKind.DISCOVERY, DraftKind.PROPOSAL),
    ).order_by("-updated_at")
    prepared.total = waiting.count()
    for draft in waiting[:PER_GROUP]:
        opp = draft.opportunity
        who = {
            DraftMode.AI: "AI-prepared",
            DraftMode.RULES: "Rules-prepared (no AI)",
            DraftMode.MANUAL: "Started by hand",
        }[draft.mode]
        prepared.items.append(
            QueueItem(
                title=f"{who} {draft.get_kind_display().lower()} v{draft.version}",
                detail=f"{opp.ref} {opp.title}",
                url=_tab(opp, "workspace" if draft.kind == DraftKind.BRIEF else draft.kind),
                action="Review",
                opportunity=opp,
                owner=_owner(opp),
                due=opp.next_action_due,
                evidence=(
                    draft.warnings[0]
                    if draft.warnings
                    else (f"Source: {draft.source_label}" if draft.source_label else "")
                ),
                state=draft.state,
            )
        )

    # Blocked: failed AI work, and opportunities that cannot move on.
    failed = live.filter(state=DraftState.FAILED).order_by("-updated_at")
    blocked.total = failed.count()
    for draft in failed[:PER_GROUP]:
        opp = draft.opportunity
        blocked.items.append(
            QueueItem(
                title=f"{draft.get_kind_display()} v{draft.version} failed",
                detail=f"{opp.ref} {opp.title}" if opp else "Enquiry preview",
                url=_tab(opp, draft.kind) if opp else reverse("aidata:brief_preview", args=[draft.pk]),
                action="Retry or continue without AI",
                opportunity=opp,
                owner=_owner(opp) if opp else "",
                evidence=f"{draft.error_category or 'error'}: {draft.error_detail or 'no detail'}",
                state=draft.state,
            )
        )
    stuck = (
        Opportunity.objects.filter(stage=Stage.QUALIFIED)
        .exclude(drafts__kind=DraftKind.DISCOVERY, drafts__state=DraftState.APPROVED)
        .select_related("owner")
        .order_by("stage_changed_at")
    )
    blocked.total += stuck.count()
    for opp in stuck[: max(0, PER_GROUP - len(blocked.items))]:
        blocked.items.append(
            QueueItem(
                title="Cannot move to Proposal: no approved discovery",
                detail=f"{opp.ref} {opp.title}",
                url=_tab(opp, "discovery"),
                action="Open discovery",
                opportunity=opp,
                owner=_owner(opp),
                due=opp.next_action_due,
                evidence=f"Qualified {opp.stage_changed_at:%-d %b}; a proposal needs an approved discovery pack.",
            )
        )

    # Blocked: AI tasks that stopped moving (a dead worker or a task nobody picked up). The tick recovers
    # them on its next run; until then they are visible here, with a retry.
    now = timezone.now()
    stale = (
        live.filter(state=DraftState.RUNNING, lease_expires_at__lt=now)
        | live.filter(state=DraftState.QUEUED, updated_at__lt=now - STALE_QUEUED)
    ).order_by("updated_at")
    blocked.total += stale.count()
    for draft in stale[:PER_GROUP]:
        opp = draft.opportunity
        blocked.items.append(
            QueueItem(
                title=f"{draft.get_kind_display()} v{draft.version} looks stuck",
                detail=f"{opp.ref} {opp.title}" if opp else "Enquiry preview",
                url=_tab(opp, draft.kind) if opp else reverse("aidata:brief_preview", args=[draft.pk]),
                action="Retry or continue without AI",
                opportunity=opp,
                owner=_owner(opp) if opp else "",
                evidence=f"{draft.get_state_display()} since {draft.updated_at:%-d %b %H:%M} without finishing; the original text is kept.",
                state="stale",
            )
        )

    # Next: next actions that are due, overdue first.
    open_stages = selectors.ACTIVE_STAGES
    due = (
        Opportunity.objects.filter(
            stage__in=open_stages,
            next_action_due__isnull=False,
            next_action_due__lte=today + timedelta(days=7),
        )
        .select_related("owner")
        .order_by("next_action_due")
    )
    nxt.total = due.count()
    for opp in due[:PER_GROUP]:
        nxt.items.append(
            QueueItem(
                title=opp.next_action or "Set a next action",
                detail=f"{opp.ref} {opp.title}",
                url=opp.get_absolute_url(),
                action="Open",
                opportunity=opp,
                owner=_owner(opp),
                due=opp.next_action_due,
                overdue=opp.next_action_due < today,
                evidence=f"{opp.get_stage_display()}",
            )
        )
    _add_portal_items(today, decide, blocked, nxt)
    return [decide, prepared, blocked, nxt]


#: A queued task nobody has started after this long is shown as stuck.
STALE_QUEUED = timedelta(minutes=10)
#: Portal items always get this many rows, even when AI items have filled the group.
PORTAL_ROWS = 4


def _add_portal_items(today, decide: Group, blocked: Group, nxt: Group) -> None:
    """Real client-portal records: customer answers, change requests, decisions, overdue customer items and
    failed portal emails. Each row links to the staff page where it is handled."""
    from apps.portal import continuity

    found = continuity.queue_items(today)
    for group, rows in ((decide, found.decide), (blocked, found.blocked), (nxt, found.next)):
        group.total += len(rows)
        for row in rows[:PORTAL_ROWS]:
            group.items.append(QueueItem(source="Client portal", **row))


def timeline(opportunity: Opportunity, limit: int = 60) -> list[dict]:
    """Audit events and draft records for one opportunity, newest first, split into AI preparation and human decisions."""
    events = AuditEvent.objects.filter(entity_type="aidata.opportunity", entity_id=opportunity.ref).order_by(
        "-created_at"
    )[:limit]
    ai_actions = {"aidata.draft_prepared", "aidata.draft_failed", "aidata.draft_recovered"}
    rows = []
    for event in events:
        by_ai = event.action in ai_actions and not event.actor_email
        rows.append(
            {
                "at": event.created_at,
                "who": "System (AI or rules)" if by_ai else (event.actor_email or "System"),
                "kind": "preparation" if event.action in ai_actions else "decision",
                "summary": event.summary,
                "action": event.action,
            }
        )
    return rows
