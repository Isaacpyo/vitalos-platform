"""Demonstrator writes: start a run, retry, continue without the model, decide review items.

Business rules stay here (not in views). Every write leaves an audit event. Model calls go only
through ``apps.aicore.services.build_gateway`` (kill switch, caps, metering).
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from apps.aicore import services as aicore
from apps.aicore.core.limits import RunContext
from apps.aicore.core.prompts import load_prompt
from apps.aicore.core.providers import SimulatedProvider
from apps.aicore.models import AiSettings
from apps.audit.services import record

from . import samples, workflow
from .models import TEXT_LIMIT, ReconRun, ReviewItem
from .values import TYPES, normalise_type, parse_amount, parse_date

PROMPT = ("statement_extraction", 2)


class DemonstratorError(Exception):
    """A request the demonstrator refuses, with a message safe to show."""


@dataclass(frozen=True)
class PathChoice:
    path: workflow.ModelPath
    mode: str  # what actually runs: "off", "simulated" or "live"
    note: str = ""  # shown when the requested mode could not be used


def demonstrator_enabled() -> bool:
    return aicore.is_enabled()


def live_available() -> tuple[bool, str]:
    ai = AiSettings.load()
    if not ai.model_path_enabled:
        return False, "The live model path is switched off in AI settings."
    provider, reason = aicore.live_provider_status()
    return provider is not None, reason


def model_path(mode: str, sample: samples.Sample | None, *, retry: bool = False) -> PathChoice:
    prompt = load_prompt(*PROMPT)
    if mode == "simulated":
        if sample is None or not sample.has_script:
            raise DemonstratorError(
                "Simulated model responses exist only for the built-in samples that have them."
            )
        script = (sample.simulated_retry_script if retry else None) or sample.simulated_script
        gateway = aicore.build_gateway(SimulatedProvider(script))
        return PathChoice(workflow.ModelPath("simulated", gateway, prompt), "simulated")
    if mode == "live":
        available, reason = live_available()
        if available:
            provider, _ = aicore.live_provider_status()
            return PathChoice(workflow.ModelPath("live", aicore.build_gateway(provider), prompt), "live")
        off = workflow.ModelPath("off", off_reason=f"Live model path unavailable: {reason}")
        return PathChoice(off, "off", reason)
    return PathChoice(
        workflow.ModelPath("off", off_reason="Model path not used for this run (rules only)."), "off"
    )


def _store_text(data: bytes) -> tuple[str, bool]:
    """Text safe to keep in PostgreSQL: decoded leniently, NUL removed, limited to 64 KB."""
    text = data.decode("utf-8", errors="replace").replace("\x00", "�")
    if len(text) > TEXT_LIMIT:
        return text[:TEXT_LIMIT], True
    return text, False


def _next_number() -> int:
    return (ReconRun.objects.aggregate(top=Max("number"))["top"] or 0) + 1


def _now_iso() -> str:
    return timezone.now().isoformat(timespec="seconds")


def _apply(run: ReconRun, result: workflow.WorkflowResult) -> None:
    run.state = result.state
    run.config_versions = result.config_versions
    run.results = result.to_dict()
    run.reasons = result.reasons
    run.simulated = run.simulated or result.simulated  # earlier simulated attempts stay labelled
    run.model_calls += result.model_calls
    run.input_tokens += result.input_tokens
    run.output_tokens += result.output_tokens
    run.cost_gbp += Decimal(result.cost_gbp)
    run.duration_ms = result.duration_ms
    run.error_category = result.error_category[:40]
    run.error_detail = (result.error_detail or "")[:300]
    stamp = _now_iso()
    run.timeline = [*run.timeline, *({**entry, "at": stamp} for entry in result.timeline)]
    run.save()
    run.review_items.all().delete()
    ReviewItem.objects.bulk_create(
        ReviewItem(
            run=run,
            position=index,
            kind=item["kind"],
            source_lines=[n for n in item.get("source_lines", []) if n],
            detail=item["detail"][:400],
        )
        for index, item in enumerate(result.review_items, start=1)
    )


def _execute(run: ReconRun, statement: bytes, ledger: bytes, choice: PathChoice) -> None:
    ctx = RunContext(workflow.WORKFLOW, run.ref)
    try:
        result = workflow.execute(
            statement, ledger, model_path=choice.path, ctx=ctx, enabled=demonstrator_enabled()
        )
    except workflow.RunsDisabled as error:
        # The kill switch went off between the check and the run: record that, start nothing.
        run.state = ReconRun.State.CANCELLED
        run.timeline = [*run.timeline, {"state": workflow.CANCELLED, "note": str(error), "at": _now_iso()}]
        run.save(update_fields=["state", "timeline", "updated_at"])
        raise DemonstratorError(str(error)) from None
    if choice.note:
        result.timeline.insert(0, {"state": "NOTE", "note": choice.note[:200]})
    _apply(run, result)


def start_run(
    *,
    request,
    statement: bytes,
    ledger: bytes,
    sample_key: str = "",
    mode: str = "off",
    synthetic_confirmed: bool,
    run_again: bool = False,
) -> tuple[ReconRun, bool]:
    """Start (or, for identical input, return) a run. Returns (run, created)."""
    if not synthetic_confirmed:
        raise DemonstratorError("Confirm that the data is synthetic or explicitly authorised.")
    if not demonstrator_enabled():
        raise DemonstratorError(
            "The AI & Data demonstrator is switched off (kill switch). No run was started."
        )
    sample = samples.get(sample_key) if sample_key else None
    if sample_key and sample is None:
        raise DemonstratorError("Unknown sample.")
    choice = model_path(mode, sample)
    versions = workflow.config_versions(choice.path)
    key = workflow.run_key(statement, ledger, {**versions, "sample": sample_key})
    if not run_again:
        existing = ReconRun.objects.filter(run_key=key).order_by("-number").first()
        if existing is not None:
            return existing, False
    statement_text, cut_statement = _store_text(statement)
    ledger_text, cut_ledger = _store_text(ledger)
    for _attempt in range(3):
        try:
            with transaction.atomic():
                run = ReconRun.objects.create(
                    number=_next_number(),
                    run_key=key,
                    statement_text=statement_text,
                    ledger_text=ledger_text,
                    input_truncated=cut_statement or cut_ledger,
                    sample_key=sample_key,
                    model_mode=choice.mode,
                    config_versions=versions,
                    synthetic_data_confirmed=True,
                    created_by=request.user,
                    timeline=[],
                )
            break
        except IntegrityError:
            continue
    else:
        raise DemonstratorError("Could not allocate a run number; try again.")
    _execute(run, statement, ledger, choice)
    record(
        "recon_demo.run_created",
        request=request,
        entity=run,
        summary=f"Started {run.ref} ({run.get_state_display()})",
        ref=run.ref,
        state=run.state,
        sample=sample_key,
        model_mode=choice.mode,
        simulated=run.simulated,
        run_again=run_again,
    )
    return run, True


def _inputs(run: ReconRun) -> tuple[bytes, bytes]:
    sample = samples.get(run.sample_key) if run.sample_key else None
    if sample is not None:
        return sample.statement(), sample.ledger()
    return run.statement_text.encode("utf-8"), run.ledger_text.encode("utf-8")


def retry_run(run: ReconRun, *, request) -> ReconRun:
    """Re-run a FAILED run with the same model mode (the provider may have recovered)."""
    if run.state != ReconRun.State.FAILED:
        raise DemonstratorError("Only a failed run can be retried.")
    if not demonstrator_enabled():
        raise DemonstratorError("The AI & Data demonstrator is switched off (kill switch).")
    sample = samples.get(run.sample_key) if run.sample_key else None
    choice = model_path(run.model_mode, sample, retry=True)
    statement, ledger = _inputs(run)
    run.retries += 1
    _execute(run, statement, ledger, choice)
    record(
        "recon_demo.run_retried",
        request=request,
        entity=run,
        summary=f"Retried {run.ref}: now {run.get_state_display()}",
        ref=run.ref,
        state=run.state,
        retries=run.retries,
    )
    return run


def continue_without_model(run: ReconRun, *, request) -> ReconRun:
    """Finish a FAILED run without the model: unread lines become manual review items."""
    if run.state != ReconRun.State.FAILED:
        raise DemonstratorError("Only a failed run can continue without the model.")
    if not demonstrator_enabled():
        raise DemonstratorError("The AI & Data demonstrator is switched off (kill switch).")
    statement, ledger = _inputs(run)
    path = workflow.ModelPath("off", off_reason="Continued without the model after a provider failure.")
    _execute(run, statement, ledger, PathChoice(path, "off"))
    record(
        "recon_demo.run_continued",
        request=request,
        entity=run,
        summary=f"Continued {run.ref} without the model: {run.get_state_display()}",
        ref=run.ref,
        state=run.state,
    )
    return run


DECISIONS = {
    "accept": ReviewItem.Status.ACCEPTED,
    "correct": ReviewItem.Status.CORRECTED,
    "reject": ReviewItem.Status.REJECTED,
}


def validate_correction(data: dict) -> dict:
    """A reviewer's corrected statement line: date, reference, type and amount, all validated."""
    errors = []
    when = parse_date(str(data.get("date", "")))
    reference = str(data.get("reference", "")).strip()[:64]
    type_ = normalise_type(str(data.get("type", "")))
    amount = parse_amount(str(data.get("amount", "")))
    if when is None:
        errors.append("a date (e.g. 2026-09-03 or 03/09/2026)")
    if not reference:
        errors.append("a reference")
    if type_ not in TYPES:
        errors.append("a type (invoice, credit or payment)")
    if amount is None:
        errors.append("an amount (e.g. 1250.00)")
    if errors:
        raise DemonstratorError("A correction needs " + ", ".join(errors) + ".")
    return {"date": when.isoformat(), "reference": reference, "type": type_, "amount": str(amount)}


def decide(
    item: ReviewItem, *, request, decision: str, note: str = "", correction: dict | None = None
) -> ReviewItem:
    if decision not in DECISIONS:
        raise DemonstratorError("Choose accept, correct or reject.")
    if item.run.state != ReconRun.State.REVIEW_REQUIRED:
        raise DemonstratorError("This run is not waiting for review.")
    item.correction = validate_correction(correction or {}) if decision == "correct" else {}
    item.status = DECISIONS[decision]
    item.note = (note or "").strip()[:500]
    item.reviewer = request.user
    item.decided_at = timezone.now()
    item.save()
    record(
        "recon_demo.review_decided",
        request=request,
        entity=item,
        summary=f"{item.get_status_display()} review item {item.position} on {item.run.ref}",
        ref=item.run.ref,
        kind=item.kind,
        decision=item.status,
    )
    return item
