"""AI & Data write rules. Every write is authorised here and recorded in the audit trail.

Views call these functions; they never change AI & Data models directly. Stage changes go only
through ``change_stage``, which validates the transition map server-side.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from apps.audit.services import record

from . import intake, selectors
from .models import (
    CEILING_FIELDS,
    BudgetSettings,
    CostEntry,
    Offer,
    OfferPrice,
    Opportunity,
    OpportunityNote,
    OpportunitySource,
    PipelineSettings,
    Stage,
    StageChange,
)
from .scoring import CRITERIA, MAX_CRITERION

logger = logging.getLogger(__name__)

REMOVED = "[removed]"
MAX_NOTE_LENGTH = 10_000
REVIEW_ACTION = "Review enquiry and reply"

#: Allowed stage moves. Won and Lost are terminal; only a SuperAdmin reopens them, to Reviewing.
TRANSITIONS: dict[str, tuple[str, ...]] = {
    Stage.NEW: (Stage.REVIEWING, Stage.DISCOVERY, Stage.LOST, Stage.ON_HOLD),
    Stage.REVIEWING: (Stage.NEW, Stage.DISCOVERY, Stage.QUALIFIED, Stage.LOST, Stage.ON_HOLD),
    Stage.DISCOVERY: (Stage.REVIEWING, Stage.QUALIFIED, Stage.LOST, Stage.ON_HOLD),
    Stage.QUALIFIED: (Stage.DISCOVERY, Stage.PROPOSAL, Stage.LOST, Stage.ON_HOLD),
    Stage.PROPOSAL: (Stage.QUALIFIED, Stage.WON, Stage.LOST, Stage.ON_HOLD),
    Stage.ON_HOLD: (Stage.NEW, Stage.REVIEWING, Stage.DISCOVERY, Stage.QUALIFIED, Stage.PROPOSAL, Stage.LOST),
    Stage.WON: (Stage.REVIEWING,),
    Stage.LOST: (Stage.REVIEWING,),
}
REASON_REQUIRED = (Stage.WON, Stage.LOST, Stage.ON_HOLD)
#: Stages that stop the clock: closed_at is set on entry and is what retention counts from.
CLOSING = (Stage.WON, Stage.LOST, Stage.ON_HOLD)

#: Fields the details form may change (stage, scores and references have their own functions).
DETAIL_FIELDS = (
    "title",
    "organisation",
    "sector",
    "contact_name",
    "contact_email",
    "contact_role",
    "source",
    "website_reference",
    "offer",
    "owner",
    "next_action",
    "next_action_due",
    "problem_summary",
    "current_tools",
    "desired_outcome",
    "timeframe",
    "budget_band",
    "estimated_value",
    "customer_summary",
    "internal_notes",
    "discovery_date",
    "decision_due",
)


def _require_access(actor) -> None:
    if not selectors.can_edit_pipeline(actor):
        raise PermissionDenied


def _require_superadmin(actor) -> None:
    if not selectors.can_edit_prices(actor):
        raise PermissionDenied


def next_working_day(day: date) -> date:
    """The next Monday to Friday after ``day`` (UK bank holidays are not considered)."""
    day += timedelta(days=1)
    while day.weekday() >= 5:
        day += timedelta(days=1)
    return day


# --- Creation -------------------------------------------------------------------------------------


@transaction.atomic
def _allocate_number() -> int:
    PipelineSettings.load()
    counter = PipelineSettings.objects.select_for_update().get(pk=1)
    highest = Opportunity.objects.aggregate(highest=Max("number"))["highest"] or 0
    number = max(counter.next_number, highest + 1)
    counter.next_number = number + 1
    counter.save(update_fields=["next_number"])
    return number


def _apply_default_value(opportunity: Opportunity) -> None:
    if opportunity.estimated_value is None and opportunity.offer:
        opportunity.estimated_value = selectors.default_value_for(opportunity.offer)


def create_opportunity(data: dict, actor, request=None) -> Opportunity:
    """Create an opportunity by hand (referral, outbound, partner…). It starts in New."""
    _require_access(actor)
    values = {field: data[field] for field in DETAIL_FIELDS if field in data}
    with transaction.atomic():
        opportunity = Opportunity(number=_allocate_number(), created_by=actor, **values)
        opportunity.stage = Stage.NEW
        _apply_default_value(opportunity)
        opportunity.full_clean()
        opportunity.save()
        StageChange.objects.create(opportunity=opportunity, to_stage=Stage.NEW, actor=actor, reason="Created")
        record(
            "aidata.opportunity_created",
            request=request,
            actor=actor,
            entity=opportunity,
            entity_id=opportunity.ref,
            summary=f"Created {opportunity.ref}",
            source=opportunity.source,
        )
    return opportunity


def create_from_enquiry(enquiry, *, offer: str = "", actor=None, request=None) -> Opportunity:
    """Open an opportunity in New from an enquiry. Idempotent: a second call returns the existing one.

    Called by the enquiry ingest for AI & Data form relays (``X-Vitalos-Pipeline: ai-data``) and by
    the "Create opportunity" button. An ``offer`` that is not a known offer key is ignored.
    """
    if actor is not None:
        _require_access(actor)
    existing = Opportunity.objects.filter(enquiry=enquiry).first()
    if existing is not None:
        return existing
    first = enquiry.messages.filter(direction="inbound").order_by("created_at", "id").first()
    text = first.text_body if first is not None else ""
    headers = first.headers_json if first is not None else {}
    fields = intake.parse(text or enquiry.snippet)
    from_form = enquiry.source == "web_form" or headers.get(intake.PIPELINE_HEADER) == intake.PIPELINE_VALUE
    title = fields.organisation or enquiry.from_name or enquiry.subject or "Enquiry"
    opportunity = Opportunity(
        title=f"{title} ({enquiry.ref})"[:200],
        organisation=fields.organisation,
        sector=fields.sector,
        contact_name=enquiry.from_name[:200],
        contact_email=enquiry.from_email,
        contact_role=fields.role,
        source=OpportunitySource.WEBSITE_FORM if from_form else OpportunitySource.OTHER,
        enquiry=enquiry,
        website_reference=str(headers.get("X-Vitalos-Reference", ""))[:100],
        offer=offer if offer in Offer.values else "",
        stage=Stage.NEW,
        next_action=REVIEW_ACTION,
        next_action_due=next_working_day(timezone.localdate()),
        problem_summary=fields.problem,
        current_tools=fields.tools,
        desired_outcome=fields.outcome,
        timeframe=fields.timeframe,
        budget_band=fields.budget_band,
        created_by=actor,
    )
    _apply_default_value(opportunity)
    try:
        with transaction.atomic():
            opportunity.number = _allocate_number()
            opportunity.save()
            StageChange.objects.create(
                opportunity=opportunity, to_stage=Stage.NEW, actor=actor, reason=f"From enquiry {enquiry.ref}"
            )
    except IntegrityError:
        # A concurrent intake for the same enquiry won the race.
        return Opportunity.objects.get(enquiry=enquiry)
    record(
        "aidata.opportunity_created",
        request=request,
        actor=actor,
        entity=opportunity,
        entity_id=opportunity.ref,
        summary=f"Created {opportunity.ref} from enquiry {enquiry.ref}",
        enquiry=enquiry.ref,
        offer=opportunity.offer,
        automatic=actor is None,
    )
    return opportunity


# --- Changes --------------------------------------------------------------------------------------


def update_details(opportunity: Opportunity, data: dict, actor, request=None) -> list[str]:
    """Apply the details form. Returns the names of the fields that changed (values are not audited)."""
    _require_access(actor)
    changed = [
        field for field in DETAIL_FIELDS if field in data and getattr(opportunity, field) != data[field]
    ]
    if not changed:
        return []
    for field in changed:
        setattr(opportunity, field, data[field])
    if "offer" in changed or "estimated_value" in changed:
        _apply_default_value(opportunity)
    opportunity.full_clean()
    opportunity.save()
    record(
        "aidata.opportunity_updated",
        request=request,
        actor=actor,
        entity=opportunity,
        entity_id=opportunity.ref,
        summary=f"Updated {opportunity.ref}",
        fields=changed,
    )
    return changed


def update_scorecard(
    opportunity: Opportunity, scores: dict, *, risk_override: bool, risk_reason: str, actor, request=None
) -> None:
    _require_access(actor)
    risk_reason = (risk_reason or "").strip()
    if risk_override and not risk_reason:
        raise ValidationError({"risk_reason": "Give the reason for the risk override."})
    for criterion in CRITERIA:
        value = scores.get(criterion.field)
        if value is not None and (not isinstance(value, int) or not 0 <= value <= MAX_CRITERION):
            raise ValidationError({criterion.field: f"Score from 0 to {MAX_CRITERION}."})
        setattr(opportunity, criterion.field, value)
    opportunity.risk_override = bool(risk_override)
    opportunity.risk_reason = risk_reason if risk_override else ""
    opportunity.save()
    result = opportunity.scorecard
    record(
        "aidata.scorecard_updated",
        request=request,
        actor=actor,
        entity=opportunity,
        entity_id=opportunity.ref,
        summary=f"Scored {opportunity.ref}: {result.label}",
        score=str(result.score) if result.score is not None else None,
        band=result.band,
        risk_override=opportunity.risk_override,
    )


def allowed_stages(opportunity: Opportunity, actor) -> list[str]:
    """Stages ``actor`` may move ``opportunity`` to now."""
    allowed = list(TRANSITIONS.get(opportunity.stage, ()))
    if opportunity.is_closed and not selectors.can_reopen(actor):
        return []
    return allowed


def change_stage(
    opportunity: Opportunity,
    to_stage: str,
    actor,
    *,
    reason: str = "",
    signed_scope_reference: str = "",
    request=None,
) -> StageChange:
    """Move an opportunity to ``to_stage`` if the transition map allows it.

    Won, Lost and On hold need a reason (stored as the outcome reason). Won also needs the signed-scope
    reference, typed by a person. Reopening Won or Lost (to Reviewing) is SuperAdmin only.
    """
    _require_access(actor)
    from_stage = opportunity.stage
    if to_stage not in Stage.values:
        raise ValidationError({"stage": "Choose a valid stage."})
    if to_stage == from_stage:
        raise ValidationError({"stage": "The opportunity is already at that stage."})
    if to_stage not in TRANSITIONS.get(from_stage, ()):
        raise ValidationError({"stage": f"{Stage(from_stage).label} cannot move to {Stage(to_stage).label}."})
    if opportunity.is_closed and not selectors.can_reopen(actor):
        raise PermissionDenied("Only a SuperAdmin can reopen a won or lost opportunity.")
    reason = (reason or "").strip()
    signed_scope_reference = (signed_scope_reference or "").strip()
    reopening = opportunity.is_closed
    if (to_stage in REASON_REQUIRED or reopening) and not reason:
        raise ValidationError({"reason": f"Give a reason for moving to {Stage(to_stage).label}."})
    if to_stage == Stage.WON and not (signed_scope_reference or opportunity.signed_scope_reference):
        raise ValidationError({"signed_scope_reference": "Enter the signed scope reference to mark it won."})
    now = timezone.now()
    with transaction.atomic():
        opportunity.stage = to_stage
        opportunity.stage_changed_at = now
        fields = ["stage", "stage_changed_at", "updated_at"]
        if to_stage in REASON_REQUIRED:
            opportunity.outcome_reason = reason
            fields.append("outcome_reason")
        if to_stage == Stage.WON and signed_scope_reference:
            opportunity.signed_scope_reference = signed_scope_reference[:200]
            fields.append("signed_scope_reference")
        opportunity.closed_at = now if to_stage in CLOSING else None
        fields.append("closed_at")
        if to_stage == Stage.DISCOVERY and opportunity.discovery_date is None:
            opportunity.discovery_date = timezone.localdate()
            fields.append("discovery_date")
        opportunity.save(update_fields=fields)
        change = StageChange.objects.create(
            opportunity=opportunity, from_stage=from_stage, to_stage=to_stage, reason=reason, actor=actor
        )
        record(
            "aidata.stage_changed",
            request=request,
            actor=actor,
            entity=opportunity,
            entity_id=opportunity.ref,
            summary=f"{opportunity.ref}: {Stage(from_stage).label} → {Stage(to_stage).label}",
            previous=from_stage,
            stage=to_stage,
            reopened=reopening,
        )
    return change


def add_note(opportunity: Opportunity, body: str, actor, request=None) -> OpportunityNote:
    _require_access(actor)
    body = (body or "").strip()
    if not body:
        raise ValidationError({"body": "Write a note."})
    if len(body) > MAX_NOTE_LENGTH:
        raise ValidationError({"body": f"Keep notes under {MAX_NOTE_LENGTH} characters."})
    note = OpportunityNote.objects.create(opportunity=opportunity, author=actor, body=body)
    record(
        "aidata.noted",
        request=request,
        actor=actor,
        entity=opportunity,
        entity_id=opportunity.ref,
        summary=f"Added an internal note to {opportunity.ref}",
    )
    return note


# --- Offers and budget (SuperAdmin) ---------------------------------------------------------------


def update_offer_price(price: OfferPrice, data: dict, actor, request=None) -> list[str]:
    _require_superadmin(actor)
    changed = [
        field
        for field in ("name", "price", "basis", "status", "notes")
        if field in data and getattr(price, field) != data[field]
    ]
    if not changed:
        return []
    previous = {"price": str(price.price), "basis": price.basis, "status": price.status}
    for field in changed:
        setattr(price, field, data[field])
    price.updated_by = actor
    price.full_clean()
    price.save()
    record(
        "aidata.offer_price_changed",
        request=request,
        actor=actor,
        entity=price,
        entity_id=price.key,
        summary=f"Changed the proposed price of {price.name}",
        fields=changed,
        previous=previous,
        price=str(price.price),
        basis=price.basis,
        status=price.status,
    )
    return changed


def update_budget_settings(data: dict, actor, request=None) -> list[str]:
    if not selectors.can_edit_budget(actor):
        raise PermissionDenied
    budget = BudgetSettings.load()
    names = ("overall_ceiling", *CEILING_FIELDS.values())
    changed = [name for name in names if name in data and getattr(budget, name) != data[name]]
    if not changed:
        return []
    for name in changed:
        if data[name] is None or Decimal(data[name]) < 0:
            raise ValidationError({name: "Enter an amount of £0 or more."})
        setattr(budget, name, data[name])
    budget.updated_by = actor
    budget.save()
    record(
        "aidata.budget_changed",
        request=request,
        actor=actor,
        entity=budget,
        summary="Changed the AI & Data budget ceilings",
        **{name: str(getattr(budget, name)) for name in changed},
    )
    return changed


def save_cost_entry(data: dict, actor, *, entry: CostEntry | None = None, request=None) -> CostEntry:
    if not selectors.can_edit_budget(actor):
        raise PermissionDenied
    creating = entry is None
    entry = entry or CostEntry(created_by=actor)
    for field in (
        "date",
        "category",
        "supplier",
        "description",
        "amount",
        "kind",
        "recurrence",
        "owner",
        "evidence_link",
    ):
        if field in data:
            setattr(entry, field, data[field])
    entry.full_clean()
    entry.save()
    record(
        "aidata.cost_added" if creating else "aidata.cost_changed",
        request=request,
        actor=actor,
        entity=entry,
        summary=f"{'Added' if creating else 'Changed'} a {entry.get_kind_display().lower()} cost "
        f"of £{entry.amount} ({entry.get_category_display()})",
        category=entry.category,
        kind=entry.kind,
        amount=str(entry.amount),
    )
    return entry


def delete_cost_entry(entry: CostEntry, actor, request=None) -> None:
    if not selectors.can_edit_budget(actor):
        raise PermissionDenied
    summary = f"Deleted a {entry.get_kind_display().lower()} cost of £{entry.amount} ({entry.get_category_display()})"
    entry_id = entry.pk
    entry.delete()
    record(
        "aidata.cost_deleted",
        request=request,
        actor=actor,
        entity_type="aidata.costentry",
        entity_id=str(entry_id),
        summary=summary,
    )


# --- Retention ------------------------------------------------------------------------------------


def anonymise_opportunity(opportunity: Opportunity) -> None:
    """Retention: keep the commercial record (stage, scores, values, dates), remove personal details."""
    opportunity.contact_name = REMOVED
    opportunity.contact_email = ""
    opportunity.contact_role = ""
    opportunity.internal_notes = REMOVED if opportunity.internal_notes else ""
    opportunity.anonymised_at = timezone.now()
    opportunity.save(
        update_fields=["contact_name", "contact_email", "contact_role", "internal_notes", "anonymised_at"]
    )
    opportunity.notes.update(body=REMOVED)
    record(
        "aidata.anonymised",
        entity=opportunity,
        entity_id=opportunity.ref,
        summary=f"Anonymised {opportunity.ref} under the retention policy",
    )
