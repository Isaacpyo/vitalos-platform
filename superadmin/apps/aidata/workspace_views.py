"""Views for the AI-assisted workspace: enquiry composer and preview, discovery, proposal, assistant.

Same gate as the rest of AI & Data: SuperAdmin and ServiceLead (anonymous users go to sign-in; every
other role gets 403, including Viewer: opportunities hold personal data, as enquiries do). Every write is
a POST with CSRF and goes through ``workspace`` / ``tasks`` services, which authorise again, validate,
audit and are idempotent. Forms post and redirect, so a reload never repeats an action; HTMX is used for
task status polling, inline field edits and the assistant.
"""

from __future__ import annotations

from datetime import date

from django.contrib import messages
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, role_required
from apps.aicore.models import ModelExecution

from . import ai, assist, discovery, exports, extraction, selectors, tasks, workqueue, workspace
from .forms import NewOpportunityForm
from .models import (
    BudgetBand,
    Draft,
    DraftKind,
    DraftMode,
    DraftState,
    Offer,
    Opportunity,
    Sector,
    Stage,
)

access_required = role_required(SUPERADMIN, SERVICE_LEAD)

TABS = (
    ("workspace", "Workspace", "layers"),
    ("discovery", "Discovery", "question"),
    ("proposal", "Proposal", "document"),
    ("details", "Qualify and details", "target"),
    ("activity", "Activity", "history"),
)
INLINE_FIELDS = (
    "organisation",
    "contact_name",
    "contact_email",
    "contact_phone",
    "contact_role",
    "sector",
    "problem_summary",
    "desired_outcome",
    "current_tools",
    "timeframe",
    "next_action",
    "next_action_due",
)


def _opp(ref) -> Opportunity:
    item = selectors.get_by_ref(ref)
    if item is None:
        raise Http404
    return item


def _draft(pk) -> Draft:
    return get_object_or_404(Draft.objects.select_related("opportunity", "basis", "created_by"), pk=pk)


def _fail(request, exc: ValidationError):
    for text in exc.messages:
        messages.error(request, text)


def _mode(request) -> str:
    return DraftMode.RULES if request.POST.get("mode") == "rules" else DraftMode.AI


def _back(opportunity: Opportunity, tab: str, anchor: str = "") -> str:
    return (
        f"{reverse('aidata:opportunity', args=[opportunity.ref])}?tab={tab}{('#' + anchor) if anchor else ''}"
    )


# --- Task status ------------------------------------------------------------------------------------------------


def execution_info(draft: Draft) -> dict | None:
    """Metadata of the gateway call behind a draft (never the prompt or the answer)."""
    if not draft.execution_id:
        return None
    run = ModelExecution.objects.filter(execution_id=draft.execution_id).first()
    return (
        {
            "provider": run.provider,
            "model": run.model,
            "outcome": run.get_outcome_display(),
            "attempts": run.attempts,
            "tokens": run.input_tokens + run.output_tokens,
            "cost": run.cost_gbp,
            "latency_ms": run.latency_ms,
            "simulated": run.simulated,
        }
        if run
        else None
    )


@access_required
@require_GET
@never_cache
def draft_status(request, pk):
    """HTMX: the task status panel. Polls while the task is active; reloads the page once it finishes."""
    tasks.recover_stale()
    draft = _draft(pk)
    response = render(
        request,
        "aidata/components/_task_status.html",
        {
            "draft": draft,
            "execution": execution_info(draft),
            "polling": draft.is_active,
            "availability": ai.availability(),
        },
    )
    if request.headers.get("X-Task-Was-Active") == "true" and not draft.is_active:
        response["HX-Refresh"] = "true"
    return response


def _draft_return(draft: Draft) -> str:
    if draft.opportunity_id:
        tab = {
            "brief": "workspace",
            "questions": "discovery",
            "discovery": "discovery",
            "proposal": "proposal",
        }[draft.kind]
        return _back(draft.opportunity, tab, draft.kind)
    return reverse("aidata:brief_preview", args=[draft.pk])


@access_required
@require_POST
def draft_retry(request, pk):
    draft = _draft(pk)
    try:
        tasks.retry(draft, request.user, without_ai=request.POST.get("without_ai") == "1", request=request)
    except ValidationError as exc:
        _fail(request, exc)
    else:
        draft.refresh_from_db()
        if draft.state == DraftState.FAILED:
            messages.error(
                request, "It failed again. You can retry, continue without AI, or write it by hand."
            )
        else:
            messages.success(
                request, "Prepared again." if draft.state != DraftState.QUEUED else "Queued to run again."
            )
    return redirect(_draft_return(draft))


@access_required
@require_POST
def draft_cancel(request, pk):
    draft = _draft(pk)
    tasks.cancel(draft, request.user, request=request)
    messages.success(request, "Cancelled. Nothing was changed.")
    return redirect(_draft_return(draft))


# --- Enquiry composer and brief preview -------------------------------------------------------------------------


@access_required
@require_POST
def brief_paste(request):
    """Composer: queue a brief from pasted text. Idempotent on the form's key."""
    text = request.POST.get("text", "")
    try:
        draft, _ = workspace.prepare_brief(
            source_text=text,
            source_label=request.POST.get("source_label", "Pasted enquiry")[:120] or "Pasted enquiry",
            key=request.POST.get("key", ""),
            actor=request.user,
            mode=_mode(request),
            request=request,
        )
    except ValidationError as exc:
        _fail(request, exc)
        return redirect(reverse("aidata:opportunity_new"))
    return redirect(reverse("aidata:brief_preview", args=[draft.pk]))


def _brief_values(draft: Draft) -> dict:
    return {name: draft.payload.get("fields", {}).get(name, "") for name in workspace.BRIEF_FORM_FIELDS}


@access_required
@require_GET
@never_cache
def brief_preview(request, pk):
    tasks.recover_stale()
    draft = _draft(pk)
    if draft.kind != DraftKind.BRIEF:
        raise Http404
    opportunity = draft.opportunity
    values = _brief_values(draft)
    context = {
        "draft": draft,
        "opportunity": opportunity,
        "execution": execution_info(draft),
        "availability": ai.availability(),
        "polling": draft.is_active,
        "values": values,
        "rows": _brief_rows(draft, opportunity, values),
        "segments": extraction.highlight_segments(draft.source_text, draft.evidence),
        "offer": draft.payload.get("offer", {}),
        "next_action": draft.payload.get("next_action", {}),
        "offers": Offer.choices,
        "missing": [extraction.FIELD_LABELS.get(n, n) for n in draft.payload.get("missing", [])],
        "unclear": [extraction.FIELD_LABELS.get(n, n) for n in draft.payload.get("unclear", [])],
        "key": tasks.new_key(),
        "stale": draft.state in (DraftState.DRAFT, DraftState.REVIEWED),
        "sectors": Sector.choices,
        "bands": BudgetBand.choices,
    }
    if draft.state in (DraftState.DRAFT, DraftState.REVIEWED):
        context["duplicates"] = workspace.find_duplicates(values, draft.source_text, exclude=opportunity)
    return render(request, "aidata/brief_preview.html", context)


def _brief_rows(draft: Draft, opportunity, values: dict) -> list[dict]:
    rows = []
    evidence = {item["field"]: item for item in draft.evidence}
    for name, label in extraction.FIELDS:
        current = ""
        if opportunity is not None:
            current = getattr(opportunity, name, "") or ""
        rows.append(
            {
                "name": name,
                "label": label,
                "proposed": values.get(name, ""),
                "current": current,
                "has_evidence": name in evidence,
                "by": evidence.get(name, {}).get("by", ""),
                "missing": not values.get(name, ""),
                "accept": bool(values.get(name)) and (not current or current == values.get(name)),
                "changes": bool(current) and bool(values.get(name)) and current != values.get(name),
                "kind": "select"
                if name in ("sector", "budget_band")
                else ("area" if name in ("problem_summary", "desired_outcome", "current_tools") else "input"),
            }
        )
    return rows


@access_required
@require_POST
def brief_apply(request, pk):
    draft = _draft(pk)
    if draft.kind != DraftKind.BRIEF:
        raise Http404
    values = {name: request.POST.get(name, "") for name in workspace.BRIEF_FORM_FIELDS}
    accept = None
    if draft.opportunity_id or request.POST.get("target", "new").startswith(("update:", "enquiry:")):
        accept = set(request.POST.getlist("accept"))
    try:
        opportunity = workspace.apply_brief(
            draft,
            values,
            request.user,
            target=request.POST.get("target", "new"),
            title=request.POST.get("title", ""),
            offer=request.POST.get("offer", ""),
            next_action=request.POST.get("next_action", ""),
            accept=accept,
            request=request,
        )
    except ValidationError as exc:
        _fail(request, exc)
        return redirect(reverse("aidata:brief_preview", args=[draft.pk]))
    messages.success(request, f"Brief approved. {opportunity.ref} is ready.")
    return redirect(_back(opportunity, "workspace"))


@access_required
@require_POST
def brief_discard(request, pk):
    draft = _draft(pk)
    try:
        workspace.reject(draft, request.user, note=request.POST.get("note", ""), request=request)
    except ValidationError as exc:
        _fail(request, exc)
        return redirect(_draft_return(draft))
    messages.success(request, "Preview discarded. Nothing was created.")
    if draft.opportunity_id:
        return redirect(_back(draft.opportunity, "workspace"))
    return redirect(reverse("aidata:overview"))


@access_required
@require_POST
def brief_from_enquiry(request, ref):
    opportunity = _opp(ref)
    try:
        draft, _ = workspace.prepare_brief_from_enquiry(
            opportunity,
            key=request.POST.get("key", ""),
            actor=request.user,
            mode=_mode(request),
            request=request,
        )
    except ValidationError as exc:
        _fail(request, exc)
        return redirect(_back(opportunity, "workspace"))
    return redirect(reverse("aidata:brief_preview", args=[draft.pk]))


@access_required
@require_POST
def brief_from_text(request, ref):
    opportunity = _opp(ref)
    try:
        draft, _ = workspace.prepare_brief(
            source_text=request.POST.get("text", ""),
            source_label=request.POST.get("source_label", "Pasted note")[:120] or "Pasted note",
            key=request.POST.get("key", ""),
            actor=request.user,
            opportunity=opportunity,
            mode=_mode(request),
            request=request,
        )
    except ValidationError as exc:
        _fail(request, exc)
        return redirect(_back(opportunity, "workspace"))
    return redirect(reverse("aidata:brief_preview", args=[draft.pk]))


@access_required
@require_POST
def inline_field(request, ref, name):
    """HTMX: save one brief field in place and answer with the display state plus a toast."""
    opportunity = _opp(ref)
    if name not in INLINE_FIELDS:
        raise Http404
    from . import services

    raw = request.POST.get("value", "")
    error = ""
    try:
        field = Opportunity._meta.get_field(name)
        if name == "next_action_due":
            value = date.fromisoformat(raw) if raw else None
        else:
            value = field.clean(raw.strip(), opportunity)
        services.update_details(opportunity, {name: value}, request.user, request=request)
    except (ValidationError, ValueError) as exc:
        error = " ".join(exc.messages) if isinstance(exc, ValidationError) else "Enter a valid date."
    opportunity.refresh_from_db()
    if not request.htmx:
        if error:
            messages.error(request, error)
        else:
            messages.success(request, "Saved.")
        return redirect(_back(opportunity, "workspace", "brief"))
    response = render(
        request,
        "aidata/components/_inline_field.html",
        {
            "opportunity": opportunity,
            "name": name,
            "label": extraction.FIELD_LABELS.get(name, name.replace("_", " ").capitalize()),
            "error": error,
            "saved": not error,
            "raw": raw,
            "field_kind": "select"
            if name == "sector"
            else (
                "area"
                if name in ("problem_summary", "desired_outcome", "current_tools")
                else ("date" if name == "next_action_due" else "input")
            ),
            "sectors": Sector.choices,
        },
        status=400 if error else 200,
    )
    if not error:
        response["HX-Trigger"] = '{"vsa-toast": {"message": "Saved."}}'
    return response


# --- Discovery -------------------------------------------------------------------------------------------------


@access_required
@require_POST
def questions_start(request, ref):
    opportunity = _opp(ref)
    try:
        draft, created = workspace.start_questions(
            opportunity,
            key=request.POST.get("key", ""),
            actor=request.user,
            mode=_mode(request),
            request=request,
        )
    except ValidationError as exc:
        _fail(request, exc)
    else:
        messages.success(
            request, "Questions prepared." if created else "Those questions were already prepared."
        )
    return redirect(_back(opportunity, "discovery", "questions"))


@access_required
@require_POST
def discovery_start(request, ref):
    opportunity = _opp(ref)
    try:
        if request.POST.get("manual") == "1":
            workspace.manual_discovery(
                opportunity, key=request.POST.get("key", ""), actor=request.user, request=request
            )
            messages.success(request, "Started an empty discovery pack for you to fill in.")
        else:
            workspace.start_discovery(
                opportunity,
                notes=request.POST.get("notes", ""),
                key=request.POST.get("key", ""),
                actor=request.user,
                mode=_mode(request),
                request=request,
            )
    except ValidationError as exc:
        _fail(request, exc)
    return redirect(_back(opportunity, "discovery", "pack"))


@access_required
@require_POST
def proposal_start(request, ref):
    opportunity = _opp(ref)
    try:
        workspace.start_proposal(
            opportunity, key=request.POST.get("key", ""), actor=request.user, request=request
        )
    except ValidationError as exc:
        _fail(request, exc)
    else:
        messages.success(request, "Proposal drafted from the approved discovery pack. It has not been sent.")
    return redirect(_back(opportunity, "proposal", "draft"))


def _rows(post, prefix: str, names: tuple[str, ...]) -> list[dict]:
    columns = {name: post.getlist(f"{prefix}_{name}") for name in names}
    spans = post.getlist(f"{prefix}_span")
    count = max((len(v) for v in columns.values()), default=0)
    rows = []
    for index in range(count):
        row = {name: (columns[name][index] if index < len(columns[name]) else "") for name in names}
        span = spans[index] if index < len(spans) else ""
        start, _, end = span.partition(":")
        if start.isdigit() and end.isdigit():
            row.update({"start": int(start), "end": int(end), "quote": ""})
        rows.append(row)
    return rows


def _pack_from_post(post) -> dict:
    pack = {"summary": post.get("summary", "")}
    pack["workflow_steps"] = _rows(post, "step", discovery.STEP_FIELDS)
    for kind, prefix in (
        ("requirements", "req"),
        ("assumptions", "asm"),
        ("unknowns", "unk"),
        ("acceptance_criteria", "acc"),
    ):
        pack[kind] = _rows(post, prefix, ("text",))
    pack["contradictions"] = post.getlist("contradiction")
    return pack


def _proposal_from_post(post, draft: Draft) -> dict:
    data = {name: post.get(name, "") for name in ("title", "summary", "payment", *workspace.PROPOSAL_LISTS)}
    data["milestones"] = _rows(post, "ms", ("name", "description", "target"))
    payload = workspace.normalise_proposal(data, draft.payload)
    return workspace.set_price(
        payload,
        kind=post.get("price_kind", (draft.payload.get("price") or {}).get("kind", "none")),
        amount=post.get("price_amount", ""),
        note=post.get("price_note", ""),
        offer=draft.opportunity.offer if draft.opportunity else "",
    )


@access_required
@require_POST
def draft_save(request, pk):
    draft = _draft(pk)
    try:
        if draft.kind == DraftKind.DISCOVERY:
            payload = _pack_from_post(request.POST)
        elif draft.kind == DraftKind.PROPOSAL:
            payload = _proposal_from_post(request.POST, draft)
        elif draft.kind == DraftKind.QUESTIONS:
            answers = {key[2:]: value for key, value in request.POST.items() if key.startswith("a_")}
            workspace.update_questions(draft, answers, request.user, request=request)
            messages.success(request, "Answers saved.")
            return redirect(_draft_return(draft))
        else:
            raise Http404
        workspace.save_payload(draft, payload, request.user, request=request)
    except ValidationError as exc:
        _fail(request, exc)
    else:
        messages.success(request, "Saved. It needs reviewing again before it can be approved.")
    return redirect(_draft_return(draft))


@access_required
@require_POST
def draft_review(request, pk):
    draft = _draft(pk)
    try:
        workspace.mark_reviewed(draft, request.user, request=request)
    except ValidationError as exc:
        _fail(request, exc)
    else:
        messages.success(request, "Marked reviewed. It can now be approved.")
    return redirect(_draft_return(draft))


@access_required
@require_POST
def draft_approve(request, pk):
    draft = _draft(pk)
    try:
        workspace.approve(draft, request.user, note=request.POST.get("note", ""), request=request)
    except ValidationError as exc:
        _fail(request, exc)
    else:
        label = (
            "Proposal marked ready. Nothing was sent." if draft.kind == DraftKind.PROPOSAL else "Approved."
        )
        messages.success(request, label)
    return redirect(_draft_return(draft))


@access_required
@require_POST
def draft_reject(request, pk):
    draft = _draft(pk)
    try:
        workspace.reject(draft, request.user, note=request.POST.get("note", ""), request=request)
    except ValidationError as exc:
        _fail(request, exc)
    else:
        messages.success(request, "Rejected. It stays in the history.")
    return redirect(_draft_return(draft))


@access_required
@require_POST
def draft_revise(request, pk):
    draft = _draft(pk)
    try:
        new = workspace.revise(draft, request.user, request.POST.get("key", ""), request=request)
    except ValidationError as exc:
        _fail(request, exc)
        return redirect(_draft_return(draft))
    messages.success(request, f"Started version {new.version}. The approved version is unchanged.")
    return redirect(_draft_return(new))


# --- Proposal export (print or Markdown, for the owner to send manually) --------------------------------------------


@access_required
@require_GET
def proposal_export(request, pk, fmt):
    draft = _draft(pk)
    if draft.kind != DraftKind.PROPOSAL or draft.opportunity is None:
        raise Http404
    from apps.audit.services import record

    record(
        "aidata.proposal_exported",
        request=request,
        entity=draft.opportunity,
        entity_id=draft.opportunity.ref,
        summary=f"Exported proposal v{draft.version} of {draft.opportunity.ref}",
        draft=draft.pk,
        format=fmt,
        state=draft.state,
    )
    if fmt == "md":
        response = HttpResponse(exports.proposal_markdown(draft), content_type="text/markdown; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="{draft.opportunity.ref}-proposal-v{draft.version}.md"'
        )
        return response
    if fmt == "print":
        payload = draft.payload
        sections = [
            ("Scope", payload.get("scope", [])),
            ("Deliverables", payload.get("deliverables", [])),
            ("Exclusions", payload.get("exclusions", [])),
            ("Dependencies and what we need from you", payload.get("dependencies", [])),
            ("Acceptance criteria", payload.get("acceptance_criteria", [])),
        ]
        return render(
            request,
            "aidata/proposal_print.html",
            {
                "draft": draft,
                "opportunity": draft.opportunity,
                "p": payload,
                "sections": sections,
                "ready": draft.state == DraftState.APPROVED,
            },
        )
    raise Http404


# --- Assistant ------------------------------------------------------------------------------------------------------


@access_required
@require_POST
def assistant(request, ref):
    opportunity = _opp(ref)
    action = request.POST.get("action", "")
    error = ""
    answer = None
    try:
        if action == "ask":
            answer = assist.ask(opportunity, request.POST.get("question", ""), request.user, request=request)
        else:
            answer = assist.run_action(opportunity, action, request.user)
    except ValidationError as exc:
        error = " ".join(exc.messages)
    except PermissionDenied:
        raise
    return render(
        request,
        "aidata/components/_assistant_answer.html",
        {"answer": answer, "error": error, "opportunity": opportunity},
        status=400 if error else 200,
    )


# --- Context for the workspace page ---------------------------------------------------------------------------------


def _group(opportunity: Opportunity, kind: str) -> dict:
    items = list(
        Draft.objects.filter(opportunity=opportunity, kind=kind).select_related(
            "created_by", "reviewed_by", "decided_by"
        )
    )
    current = next(
        (
            d
            for d in items
            if d.state not in (DraftState.REJECTED, DraftState.SUPERSEDED, DraftState.CANCELLED)
        ),
        None,
    )
    approved = next((d for d in items if d.state == DraftState.APPROVED), None)
    return {
        "current": current,
        "approved": approved,
        "history": [d for d in items if d is not current],
        "all": items,
    }


def workspace_context(request, opportunity: Opportunity, tab: str) -> dict:
    tasks.recover_stale()
    groups = {
        kind: _group(opportunity, kind)
        for kind in (DraftKind.BRIEF, DraftKind.QUESTIONS, DraftKind.DISCOVERY, DraftKind.PROPOSAL)
    }
    brief = groups[DraftKind.BRIEF]["approved"] or groups[DraftKind.BRIEF]["current"]
    pack = groups[DraftKind.DISCOVERY]["current"]
    proposal = groups[DraftKind.PROPOSAL]["current"]
    questions = groups[DraftKind.QUESTIONS]["current"]
    approved_discovery = groups[DraftKind.DISCOVERY]["approved"]
    enquiry = opportunity.enquiry
    context = {
        "tab": tab,
        "tabs": TABS,
        "groups": groups,
        "brief": brief,
        "pack": pack,
        "proposal": proposal,
        "questions": questions,
        "approved_discovery": approved_discovery,
        "availability": ai.availability(),
        "key": tasks.new_key(),
        "can_act": selectors.can_edit_pipeline(request.user),
        "inline_fields": _inline_rows(opportunity),
        "original_enquiry": enquiry,
        "proposal_blocked": workspace.stage_blockers(opportunity, Stage.PROPOSAL),
        "proposal_blockers": workspace.proposal_blockers(proposal)
        if proposal and proposal.state in (DraftState.DRAFT, DraftState.REVIEWED)
        else [],
        "pack_blockers": workspace.approval_blockers(pack)
        if pack and pack.state in (DraftState.DRAFT, DraftState.REVIEWED)
        else [],
        "proposal_stale": bool(
            proposal
            and approved_discovery
            and proposal.basis_id
            and proposal.basis_id != approved_discovery.pk
            and not proposal.is_locked
        ),
        "execution": {d.pk: execution_info(d) for d in (brief, pack, proposal, questions) if d is not None},
        "timeline": workqueue.timeline(opportunity) if tab == "activity" else [],
        "offers": Offer.choices,
        "sectors": Sector.choices,
        "offer_price": workspace.price_block(opportunity.offer),
        "pack_sections": [
            ("requirements", "req", "Requirements"),
            ("assumptions", "asm", "Assumptions"),
            ("unknowns", "unk", "Unknowns (still open)"),
            ("acceptance_criteria", "acc", "Acceptance criteria"),
        ],
        "assistant_actions": [
            ("summary", "Summarise", "list"),
            ("missing", "What is missing?", "question"),
            ("next", "Suggest next step", "arrow-right"),
        ],
    }
    if tab == "workspace" and brief is not None and brief.source_text:
        context["segments"] = extraction.highlight_segments(brief.source_text, brief.evidence)
    if tab == "discovery" and pack is not None and pack.source_text:
        context["pack_segments"] = extraction.highlight_segments(pack.source_text, pack.evidence)
    if tab == "discovery" and pack is not None:
        context["pack_view"] = _pack_view(pack)
    return context


def _pack_view(pack: Draft) -> dict:
    """The editable pack with a few blank rows to fill in (no JavaScript needed to add one)."""
    data = pack.payload or discovery.empty_pack()
    blank_step = {k: "" for k in discovery.STEP_FIELDS}
    blank_item = {"text": ""}
    view = {"summary": data.get("summary", ""), "contradictions": data.get("contradictions", [])}
    view["workflow_steps"] = [
        *data.get("workflow_steps", []),
        *([] if pack.is_locked else [blank_step, blank_step]),
    ]
    for kind in discovery.LIST_KEYS:
        view[kind] = [*data.get(kind, []), *([] if pack.is_locked else [blank_item])]
    return view


def _inline_rows(opportunity: Opportunity) -> list[dict]:
    rows = []
    for name in INLINE_FIELDS:
        kind = (
            "select"
            if name == "sector"
            else (
                "area"
                if name in ("problem_summary", "desired_outcome", "current_tools")
                else ("date" if name == "next_action_due" else "input")
            )
        )
        rows.append(
            {
                "name": name,
                "label": extraction.FIELD_LABELS.get(name, name.replace("_", " ").capitalize()),
                "kind": kind,
            }
        )
    return rows


def composer_context(request, **extra) -> dict:
    return {
        "form": extra.pop("form", None) or NewOpportunityForm(),
        "availability": ai.availability(),
        "key": tasks.new_key(),
        **extra,
    }
