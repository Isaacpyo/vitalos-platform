"""AI & Data pages: overview, pipeline, opportunity, offers and budget. Writes go through services.py.

Every page needs SuperAdmin or ServiceLead (anonymous users go to sign-in, other roles get 403).
Every change is a POST with a CSRF token; forms post back to full pages (no JavaScript needed). The
scorecard preview is the one HTMX partial: it recomputes the score on the server as scores change.
"""

from django.contrib import messages
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, role_required
from apps.enquiries import selectors as enquiry_selectors

from . import scoring, selectors, services
from .forms import (
    BudgetSettingsForm,
    CostEntryForm,
    NewOpportunityForm,
    NoteForm,
    OfferPriceForm,
    OpportunityForm,
    ScorecardForm,
    StageForm,
)
from .models import BudgetSettings, CostEntry, OfferPrice, Sector

#: Linked by path only; the demonstrator is another app (apps.recon_demo).
DEMONSTRATOR_PATH = "/ai-data/demonstrator/"
PRICES_BANNER = "Proposed commercial assumptions — not validated market rates, not published."
access_required = role_required(SUPERADMIN, SERVICE_LEAD)


def _get(ref):
    opportunity = selectors.get_by_ref(ref)
    if opportunity is None:
        raise Http404
    return opportunity


def _error_text(exc: ValidationError) -> str:
    return " ".join(exc.messages)


# --- Overview -------------------------------------------------------------------------------------


@access_required
@require_GET
def overview(request):
    summary = selectors.budget_summary()
    return render(
        request,
        "aidata/overview.html",
        {
            "stage_counts": selectors.stage_counts(),
            "overdue": selectors.overdue(),
            "overdue_count": selectors.overdue_count(),
            "budget": summary,
            "prices": selectors.offer_prices(),
            "demonstrator_path": DEMONSTRATOR_PATH,
            "today": timezone.localdate(),
        },
    )


# --- Pipeline -------------------------------------------------------------------------------------


@access_required
@require_GET
def pipeline(request):
    state = {
        "stage": request.GET.get("stage", ""),
        "owner": request.GET.get("owner", ""),
        "sector": request.GET.get("sector", ""),
        "overdue": request.GET.get("overdue") == "1",
        "query": request.GET.get("q", "").strip()[: selectors.MAX_QUERY],
    }
    rows = list(selectors.pipeline(**state)[:200])
    counts = selectors.stage_counts()
    params = request.GET.copy()
    params.pop("stage", None)
    return render(
        request,
        "aidata/pipeline.html",
        {
            **state,
            "rows": rows,
            "stage_tabs": [{"stage": "", "label": "All", "count": sum(c["count"] for c in counts)}, *counts],
            "base_query": params.urlencode(),
            "owners": selectors.owners(),
            "sectors": Sector.choices,
            "today": timezone.localdate(),
            "overdue_count": selectors.overdue_count(),
        },
    )


@access_required
@require_http_methods(["GET", "POST"])
def opportunity_new(request):
    form = NewOpportunityForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            opportunity = services.create_opportunity(form.cleaned_data, request.user, request=request)
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            messages.success(request, f"Created {opportunity.ref}.")
            return redirect(opportunity.get_absolute_url())
    return render(request, "aidata/opportunity_form.html", {"form": form})


def _detail_context(request, opportunity, **forms) -> dict:
    allowed = services.allowed_stages(opportunity, request.user)
    initial_scores = opportunity.criterion_scores()
    return {
        "opportunity": opportunity,
        "form": forms.get("form") or OpportunityForm(instance=opportunity),
        "score_form": forms.get("score_form")
        or ScorecardForm(
            initial={
                **initial_scores,
                "risk_override": opportunity.risk_override,
                "risk_reason": opportunity.risk_reason,
            }
        ),
        "stage_form": forms.get("stage_form") or StageForm(allowed=allowed),
        "note_form": forms.get("note_form") or NoteForm(),
        "result": opportunity.scorecard,
        "allowed_stages": allowed,
        "stage_changes": opportunity.stage_changes.select_related("actor")[:50],
        "notes": opportunity.notes.select_related("author")[:100],
        "today": timezone.localdate(),
        "is_closed": opportunity.is_closed,
    }


@access_required
@require_GET
def opportunity(request, ref):
    item = _get(ref)
    return render(request, "aidata/opportunity.html", _detail_context(request, item))


@access_required
@require_POST
def opportunity_edit(request, ref):
    item = _get(ref)
    # The form validates a separate copy, so the service can still see what changed on ``item``.
    form = OpportunityForm(request.POST, instance=_get(ref))
    if form.is_valid():
        try:
            changed = services.update_details(item, form.cleaned_data, request.user, request=request)
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            messages.success(request, "Details saved." if changed else "Nothing changed.")
            return redirect(item.get_absolute_url())
    response = render(request, "aidata/opportunity.html", _detail_context(request, item, form=form))
    response.status_code = 400
    return response


@access_required
@require_POST
def opportunity_score(request, ref):
    item = _get(ref)
    form = ScorecardForm(request.POST)
    if form.is_valid():
        try:
            services.update_scorecard(
                item,
                form.scores(),
                risk_override=form.cleaned_data["risk_override"],
                risk_reason=form.cleaned_data["risk_reason"],
                actor=request.user,
                request=request,
            )
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            messages.success(request, f"Scorecard saved: {item.scorecard.label}.")
            return redirect(item.get_absolute_url() + "#scorecard")
    response = render(request, "aidata/opportunity.html", _detail_context(request, item, score_form=form))
    response.status_code = 400
    return response


@access_required
@require_GET
def score_preview(request, ref):
    """HTMX: the score and band for the scores in the form, computed on the server. Changes nothing."""
    _get(ref)
    form = ScorecardForm(request.GET)
    form.is_valid()
    scores = {c.field: form.cleaned_data.get(c.field) for c in scoring.CRITERIA}
    result = scoring.evaluate(scores, risk_override=bool(form.cleaned_data.get("risk_override")))
    return render(request, "aidata/_score_result.html", {"result": result, "preview": True})


@access_required
@require_POST
def opportunity_stage(request, ref):
    item = _get(ref)
    allowed = services.allowed_stages(item, request.user)
    form = StageForm(request.POST, allowed=allowed)
    if form.is_valid():
        try:
            services.change_stage(
                item,
                form.cleaned_data["stage"],
                request.user,
                reason=form.cleaned_data["reason"],
                signed_scope_reference=form.cleaned_data["signed_scope_reference"],
                request=request,
            )
        except ValidationError as exc:
            if hasattr(exc, "error_dict"):
                for field, errors in exc.message_dict.items():
                    form.add_error(field if field in form.fields else None, errors)
            else:
                form.add_error(None, exc)
        else:
            messages.success(request, f"Moved to {item.get_stage_display()}.")
            return redirect(item.get_absolute_url())
    response = render(request, "aidata/opportunity.html", _detail_context(request, item, stage_form=form))
    response.status_code = 400
    return response


@access_required
@require_POST
def opportunity_note(request, ref):
    item = _get(ref)
    form = NoteForm(request.POST)
    if form.is_valid():
        try:
            services.add_note(item, form.cleaned_data["body"], request.user, request=request)
        except ValidationError as exc:
            form.add_error("body", exc)
        else:
            messages.success(request, "Note added.")
            return redirect(item.get_absolute_url() + "#notes")
    response = render(request, "aidata/opportunity.html", _detail_context(request, item, note_form=form))
    response.status_code = 400
    return response


@access_required
@require_POST
def from_enquiry(request, ref):
    """The "Create opportunity" button on an enquiry. Opens the existing one if there already is one."""
    if not enquiry_selectors.can_access(request.user):
        raise PermissionDenied
    enquiry = enquiry_selectors.get_by_ref(ref)
    if enquiry is None:
        raise Http404
    existed = selectors.for_enquiry(enquiry) is not None
    item = services.create_from_enquiry(enquiry, actor=request.user, request=request)
    messages.success(request, f"{item.ref} {'already exists' if existed else 'created'} for {enquiry.ref}.")
    return redirect(item.get_absolute_url())


# --- Offers ---------------------------------------------------------------------------------------


@access_required
@require_GET
def offers(request):
    prices = list(selectors.offer_prices())
    return render(
        request,
        "aidata/offers.html",
        {
            "prices": [{"price": p, "label": selectors.price_label(p)} for p in prices],
            "can_edit": selectors.can_edit_prices(request.user),
            "banner": PRICES_BANNER,
        },
    )


@access_required
@require_http_methods(["GET", "POST"])
def offer_edit(request, key):
    if not selectors.can_edit_prices(request.user):
        raise PermissionDenied
    price = get_object_or_404(OfferPrice, key=key)
    form = OfferPriceForm(request.POST or None, instance=OfferPrice.objects.get(pk=price.pk))
    if request.method == "POST" and form.is_valid():
        try:
            services.update_offer_price(price, form.cleaned_data, request.user, request=request)
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            messages.success(request, f"Saved {price.name}.")
            return redirect("aidata:offers")
    return render(request, "aidata/offer_form.html", {"form": form, "price": price, "banner": PRICES_BANNER})


# --- Budget ---------------------------------------------------------------------------------------


@access_required
@require_GET
def budget(request):
    return render(
        request,
        "aidata/budget.html",
        {
            **selectors.budget_summary(),
            "entries": selectors.cost_entries()[:200],
            "can_edit": selectors.can_edit_budget(request.user),
        },
    )


@access_required
@require_http_methods(["GET", "POST"])
def budget_settings(request):
    if not selectors.can_edit_budget(request.user):
        raise PermissionDenied
    current = BudgetSettings.load()
    form = BudgetSettingsForm(request.POST or None, instance=BudgetSettings.objects.get(pk=current.pk))
    if request.method == "POST" and form.is_valid():
        try:
            services.update_budget_settings(form.cleaned_data, request.user, request=request)
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            messages.success(request, "Budget ceilings saved.")
            return redirect("aidata:budget")
    return render(request, "aidata/budget_form.html", {"form": form, "title": "Budget ceilings"})


@access_required
@require_http_methods(["GET", "POST"])
def cost_edit(request, pk=None):
    if not selectors.can_edit_budget(request.user):
        raise PermissionDenied
    entry = get_object_or_404(CostEntry, pk=pk) if pk else None
    initial = {} if entry else {"date": timezone.localdate(), "owner": request.user.pk}
    copy = CostEntry.objects.get(pk=entry.pk) if entry else None
    form = CostEntryForm(request.POST or None, instance=copy, initial=initial)
    if request.method == "POST" and form.is_valid():
        try:
            services.save_cost_entry(form.cleaned_data, request.user, entry=entry, request=request)
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            messages.success(request, "Cost saved.")
            return redirect("aidata:budget")
    return render(
        request,
        "aidata/budget_form.html",
        {"form": form, "entry": entry, "title": "Edit cost" if entry else "Add a cost"},
    )


@access_required
@require_POST
def cost_delete(request, pk):
    if not selectors.can_edit_budget(request.user):
        raise PermissionDenied
    entry = get_object_or_404(CostEntry, pk=pk)
    services.delete_cost_entry(entry, request.user, request=request)
    messages.success(request, "Cost deleted.")
    return redirect(reverse("aidata:budget"))
