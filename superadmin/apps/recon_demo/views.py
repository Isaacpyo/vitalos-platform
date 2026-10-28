"""Demonstrator pages (/ai-data/demonstrator/). SuperAdmin and ServiceLead; settings are SuperAdmin only.

Writes are POST with CSRF and go through services.py, which records an audit event for each.
"""

from django.contrib import messages
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, role_required
from apps.aicore import services as aicore
from apps.aicore.core.pricing import default_table
from apps.aicore.models import AiSettings, ModelExecution

from . import samples, selectors, services
from .forms import AiSettingsForm, NewRunForm, ReviewDecisionForm
from .models import ReconRun, ReviewItem

ACCESS = (SERVICE_LEAD,)  # SuperAdmin satisfies every role check


def _run_or_404(ref: str) -> ReconRun:
    run = selectors.get_run(ref)
    if run is None:
        raise Http404("No such run.")
    return run


def _status_context() -> dict:
    live, live_reason = services.live_available()
    return {
        "demo_enabled": services.demonstrator_enabled(),
        "env_disabled": aicore.env_disabled(),
        "live_available": live,
        "live_reason": live_reason,
        "ai": AiSettings.load(),
    }


@role_required(*ACCESS)
@require_GET
@never_cache
def index(request):
    return render(
        request,
        "recon_demo/index.html",
        {
            "runs": selectors.runs(),
            "counts": selectors.summary_counts(),
            "usage": aicore.usage_summary(),
            "section": "runs",
            **_status_context(),
        },
    )


@role_required(*ACCESS)
@require_http_methods(["GET", "POST"])
@never_cache
def new_run(request):
    initial = {"source": "sample", "mode": "off"}
    sample_key = request.GET.get("sample", "")
    sample = samples.get(sample_key)
    if sample is not None:
        initial.update(sample_key=sample.key, mode=sample.default_mode)
    form = NewRunForm(request.POST or None, initial=initial)
    if request.method == "POST" and form.is_valid():
        data = form.cleaned_data
        if data["source"] == "sample":
            chosen = samples.get(data["sample_key"])
            statement, ledger, key = chosen.statement(), chosen.ledger(), chosen.key
        else:
            statement, ledger, key = data["statement"].encode("utf-8"), data["ledger"].encode("utf-8"), ""
        try:
            run, created = services.start_run(
                request=request,
                statement=statement,
                ledger=ledger,
                sample_key=key,
                mode=data["mode"],
                synthetic_confirmed=data["synthetic_confirmed"],
                run_again=data["run_again"],
            )
        except services.DemonstratorError as error:
            messages.error(request, str(error))
        else:
            if not created:
                messages.info(
                    request,
                    f"Identical input and configuration: showing the existing run {run.ref}. Use Run again for a new run.",
                )
            return redirect(run)
    return render(
        request,
        "recon_demo/new.html",
        {"form": form, "samples": samples.SAMPLES, "section": "new", **_status_context()},
    )


@role_required(*ACCESS)
@require_GET
@never_cache
def detail(request, ref):
    run = _run_or_404(ref)
    results = run.results or {}
    executions = ModelExecution.objects.filter(run_ref=run.ref).order_by("created_at")
    items = list(run.review_items.select_related("reviewer"))
    return render(
        request,
        "recon_demo/detail.html",
        {
            "run": run,
            "results": results,
            "source": selectors.source_lines(run),
            "recon_rows": selectors.reconciliation_rows(run),
            "review_items": items,
            "open_items": sum(1 for item in items if item.status == ReviewItem.Status.OPEN),
            "executions": executions,
            "sample": samples.get(run.sample_key) if run.sample_key else None,
            "section": "runs",
            **_status_context(),
        },
    )


@role_required(*ACCESS)
@require_POST
def retry(request, ref):
    run = _run_or_404(ref)
    try:
        services.retry_run(run, request=request)
        messages.success(request, f"Retried {run.ref}: {run.get_state_display()}.")
    except services.DemonstratorError as error:
        messages.error(request, str(error))
    return redirect(run)


@role_required(*ACCESS)
@require_POST
def continue_without_model(request, ref):
    run = _run_or_404(ref)
    try:
        services.continue_without_model(run, request=request)
        messages.success(request, f"{run.ref} continued without the model: {run.get_state_display()}.")
    except services.DemonstratorError as error:
        messages.error(request, str(error))
    return redirect(run)


@role_required(*ACCESS)
@require_POST
def run_again(request, ref):
    run = _run_or_404(ref)
    if run.sample_key:
        sample = samples.get(run.sample_key)
        statement, ledger = sample.statement(), sample.ledger()
    else:
        statement, ledger = run.statement_text.encode("utf-8"), run.ledger_text.encode("utf-8")
    try:
        new, _created = services.start_run(
            request=request,
            statement=statement,
            ledger=ledger,
            sample_key=run.sample_key,
            mode=run.model_mode,
            synthetic_confirmed=run.synthetic_data_confirmed,
            run_again=True,
        )
    except services.DemonstratorError as error:
        messages.error(request, str(error))
        return redirect(run)
    messages.success(request, f"Started {new.ref} with the same input.")
    return redirect(new)


@role_required(*ACCESS)
@require_POST
def decide(request, ref, item_id):
    run = _run_or_404(ref)
    item = get_object_or_404(ReviewItem, pk=item_id, run=run)
    form = ReviewDecisionForm(request.POST)
    if not form.is_valid():
        messages.error(request, "Choose accept, correct or reject.")
        return redirect(run)
    data = form.cleaned_data
    try:
        services.decide(
            item,
            request=request,
            decision=data["decision"],
            note=data["note"],
            correction={key: data[key] for key in ("date", "reference", "type", "amount")},
        )
        messages.success(request, f"Review item {item.position}: {item.get_status_display()}.")
    except services.DemonstratorError as error:
        messages.error(request, str(error))
    return redirect(f"{run.get_absolute_url()}#review-{item.position}")


@role_required(*ACCESS)
@require_GET
@never_cache
def evaluation(request):
    return render(
        request,
        "recon_demo/evaluation.html",
        {"report": selectors.latest_report(), "section": "evaluation", **_status_context()},
    )


@role_required(SUPERADMIN)
@require_http_methods(["GET", "POST"])
@never_cache
def ai_settings(request):
    ai = AiSettings.load()
    form = AiSettingsForm(request.POST or None, instance=AiSettings.load())
    if request.method == "POST":
        if not form.is_valid():
            messages.error(request, "Check the highlighted fields.")
        else:
            changed = aicore.update_settings(ai, request=request, changes=form.cleaned_data)
            messages.success(request, "Settings saved." if changed else "No changes.")
            return redirect("recon_demo:settings")
    provider, reason = aicore.live_provider_status()
    table = default_table()
    return render(
        request,
        "recon_demo/settings.html",
        {
            "form": form,
            "section": "settings",
            "provider_configured": provider is not None,
            "provider_reason": reason,
            "provider_model": getattr(provider, "model", ""),
            "provider_host": getattr(provider, "base_url", ""),
            "usage": aicore.usage_summary(),
            "price_table": table,
            "price": table.price(getattr(provider, "model", "") or "unknown"),
            "executions": ModelExecution.objects.all()[:20],
            **_status_context(),
        },
    )
