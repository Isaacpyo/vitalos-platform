"""Durable execution of AI-prepared drafts (ADR-055).

A ``Draft`` row is the task record. Its state comes from PostgreSQL, so a reload never loses a task and
the UI just polls the row while it is queued or running. There is no new queue or paid service:

* A request creates the row (queued, idempotent on its key) and then runs it inline. Synchronous
  execution is acceptable here because the gateway already bounds a run (per-call timeout, at most two
  retries, a 40 s overall deadline) and because the row, not the request, owns the outcome.
* A run takes a lease (``LEASE``) and renews it before the model call. If the process dies or is killed
  mid-run the lease expires; ``recover_stale`` (called by the content tick, ADR-042, and by the polling
  status view) puts the task back in the queue while attempts remain, otherwise marks it failed
  ("interrupted"). ``run_queued`` (same tick) then runs queued work. Nothing stays "running" for ever.
* Every transition is a conditional UPDATE, so two workers, a double submit or a cancel racing a
  completion can never run, finish or duplicate the same task twice.
* Retries are bounded by ``max_attempts``. A retry reuses the same row, so it cannot duplicate a draft.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import F, Max
from django.utils import timezone

from apps.audit.services import record

from . import ai
from .models import Draft, DraftMode, DraftState

logger = logging.getLogger(__name__)

#: Longer than the gateway's overall deadline (40 s) so a live run never loses its lease.
LEASE = timedelta(seconds=90)
BATCH = 3


def _audit(action: str, draft: Draft, actor=None, request=None, summary="", **extra):
    entity = draft.opportunity
    record(
        action,
        request=request,
        actor=actor,
        entity=entity if entity is not None else draft,
        entity_id=entity.ref if entity is not None else str(draft.pk),
        summary=summary or f"{draft.get_kind_display()} v{draft.version}",
        draft=draft.pk,
        kind=draft.kind,
        version=draft.version,
        **extra,
    )


# --- Creation (idempotent) ------------------------------------------------------------------------


def new_key() -> str:
    return uuid.uuid4().hex


def submit(
    kind: str,
    *,
    key: str,
    actor,
    opportunity=None,
    enquiry=None,
    source_text: str = "",
    source_label: str = "",
    requested_mode: str = DraftMode.AI,
    basis: Draft | None = None,
    run: bool = True,
    request=None,
) -> tuple[Draft, bool]:
    """Create a queued draft and run it. Returns (draft, created).

    The same ``key`` returns the same draft (a double submit or a retried request creates nothing).
    An active draft of the same kind on the same opportunity is returned instead of starting another.
    """
    from .extraction import clean_source

    key = (key or new_key())[:64]
    existing = Draft.objects.filter(idempotency_key=key).first()
    if existing is not None:
        return existing, False
    if opportunity is not None:
        active = Draft.objects.filter(
            opportunity=opportunity, kind=kind, state__in=(DraftState.QUEUED, DraftState.RUNNING)
        ).first()
        if active is not None:
            return active, False
    text, _truncated = clean_source(source_text)
    for _attempt in range(3):
        try:
            with transaction.atomic():
                version = 1
                if opportunity is not None:
                    top = Draft.objects.filter(opportunity=opportunity, kind=kind).aggregate(
                        top=Max("version")
                    )["top"]
                    version = (top or 0) + 1
                draft = Draft.objects.create(
                    opportunity=opportunity,
                    enquiry=enquiry or getattr(opportunity, "enquiry", None),
                    kind=kind,
                    state=DraftState.QUEUED,
                    version=version,
                    requested_mode=requested_mode,
                    mode=DraftMode.RULES,
                    idempotency_key=key,
                    source_label=source_label[:120],
                    source_text=text,
                    source_hash=hashlib.sha256(text.encode()).hexdigest() if text else "",
                    basis=basis,
                    created_by=actor,
                )
            break
        except IntegrityError:
            existing = Draft.objects.filter(idempotency_key=key).first()
            if existing is not None:
                return existing, False
    else:
        raise ValidationError("Could not start this just now. Try again.")
    _audit("aidata.draft_queued", draft, actor, request, requested_mode=requested_mode)
    if run:
        run_now(draft)
        draft.refresh_from_db()
    return draft, True


# --- Execution ------------------------------------------------------------------------------------


def claim(pk: int) -> Draft | None:
    now = timezone.now()
    claimed = Draft.objects.filter(pk=pk, state=DraftState.QUEUED).update(
        state=DraftState.RUNNING,
        attempts=F("attempts") + 1,
        started_at=now,
        heartbeat_at=now,
        lease_expires_at=now + LEASE,
        error_category="",
        error_detail="",
    )
    return Draft.objects.select_related("opportunity", "basis").get(pk=pk) if claimed else None


def heartbeat(draft: Draft) -> bool:
    """Renew the lease. False when the task is no longer ours (cancelled or recovered)."""
    now = timezone.now()
    return bool(
        Draft.objects.filter(pk=draft.pk, state=DraftState.RUNNING).update(
            heartbeat_at=now, lease_expires_at=now + LEASE
        )
    )


def run_now(draft: Draft) -> Draft:
    claimed = claim(draft.pk)
    if claimed is not None:
        execute(claimed)
    return draft


def execute(draft: Draft) -> None:
    from . import workspace

    try:
        outcome = workspace.RUNNERS[draft.kind](draft)
    except ai.AiFailed as exc:
        _fail(draft, exc.category, exc.detail, exc.result)
    except ValidationError as exc:
        _fail(draft, "invalid_input", " ".join(exc.messages))
    except Exception:  # noqa: BLE001 - the task must end in a recorded state whatever happens
        logger.exception("Draft task failed", extra={"draft": draft.pk, "kind": draft.kind})
        _fail(draft, "internal_error", "Something went wrong preparing this. Try again.")
    else:
        _complete(draft, outcome)


def _complete(draft: Draft, outcome) -> None:
    now = timezone.now()
    done = Draft.objects.filter(pk=draft.pk, state=DraftState.RUNNING).update(
        state=DraftState.DRAFT,
        mode=outcome.mode,
        payload=outcome.payload,
        ai_payload=outcome.ai_payload,
        evidence=outcome.evidence,
        warnings=outcome.warnings,
        prompt_ref=outcome.prompt_ref[:80],
        execution_id=outcome.execution_id,
        simulated=outcome.simulated,
        fallback_reason=outcome.fallback_reason[:300],
        finished_at=now,
        lease_expires_at=None,
        updated_at=now,
    )
    if done:
        draft.refresh_from_db()
        _audit(
            "aidata.draft_prepared",
            draft,
            None,
            mode=outcome.mode,
            simulated=outcome.simulated,
            fallback=bool(outcome.fallback_reason),
        )


def _fail(draft: Draft, category: str, detail: str, result=None) -> None:
    now = timezone.now()
    done = Draft.objects.filter(pk=draft.pk, state=DraftState.RUNNING).update(
        state=DraftState.FAILED,
        error_category=category[:40],
        error_detail=(detail or "")[:300],
        execution_id=getattr(result, "execution_id", None) or None,
        prompt_ref=(
            f"{result.prompt_id}@{result.prompt_version}" if result is not None else draft.prompt_ref
        )[:80],
        simulated=bool(getattr(result, "simulated", False)),
        finished_at=now,
        lease_expires_at=None,
        updated_at=now,
    )
    if done:
        draft.refresh_from_db()
        _audit("aidata.draft_failed", draft, None, category=category[:40])


def recover_stale(now=None) -> int:
    """Tasks whose lease expired (a dead worker or a killed request): requeue, or fail when out of attempts."""
    now = now or timezone.now()
    count = 0
    for draft in Draft.objects.filter(state=DraftState.RUNNING, lease_expires_at__lt=now):
        if draft.attempts < draft.max_attempts:
            changed = Draft.objects.filter(
                pk=draft.pk, state=DraftState.RUNNING, lease_expires_at__lt=now
            ).update(state=DraftState.QUEUED, lease_expires_at=None, updated_at=now)
        else:
            changed = Draft.objects.filter(
                pk=draft.pk, state=DraftState.RUNNING, lease_expires_at__lt=now
            ).update(
                state=DraftState.FAILED,
                error_category="interrupted",
                error_detail="The run was interrupted and did not finish. Retry it, or prepare without AI.",
                finished_at=now,
                lease_expires_at=None,
                updated_at=now,
            )
        if changed:
            count += 1
            draft.refresh_from_db()
            _audit("aidata.draft_recovered", draft, None, to=draft.state)
    return count


def run_queued(limit: int = BATCH) -> int:
    """Claim and run queued tasks (the tick's job). Overlapping callers never take the same task."""
    with transaction.atomic():
        ids = list(
            Draft.objects.select_for_update(skip_locked=True)
            .filter(state=DraftState.QUEUED)
            .order_by("created_at")
            .values_list("pk", flat=True)[:limit]
        )
    ran = 0
    for pk in ids:
        claimed = claim(pk)
        if claimed is not None:
            execute(claimed)
            ran += 1
    return ran


def tick(now=None) -> dict:
    """Called by the content tick: recover stale tasks, then run queued ones."""
    return {"recovered": recover_stale(now), "ran": run_queued()}


# --- Retry and cancel -----------------------------------------------------------------------------


def retry(draft: Draft, actor, *, without_ai: bool = False, request=None) -> Draft:
    """Failed -> queued -> run, on the same row. Bounded by ``max_attempts``; idempotent on a double click."""
    fields = {"state": DraftState.QUEUED, "updated_at": timezone.now(), "finished_at": None}
    if without_ai:
        fields.update(requested_mode=DraftMode.RULES, max_attempts=F("attempts") + 1)
    elif draft.attempts >= draft.max_attempts:
        raise ValidationError("Retries are used up. Prepare it without AI, or write it by hand.")
    moved = Draft.objects.filter(pk=draft.pk, state=DraftState.FAILED).update(**fields)
    if moved:
        draft.refresh_from_db()
        _audit("aidata.draft_retried", draft, actor, request, without_ai=without_ai)
        run_now(draft)
    draft.refresh_from_db()
    return draft


def cancel(draft: Draft, actor, request=None) -> Draft:
    now = timezone.now()
    moved = Draft.objects.filter(pk=draft.pk, state__in=(DraftState.QUEUED, DraftState.RUNNING)).update(
        state=DraftState.CANCELLED, finished_at=now, lease_expires_at=None, updated_at=now
    )
    draft.refresh_from_db()
    if moved:
        _audit("aidata.draft_cancelled", draft, actor, request)
    return draft
