"""Billing pages: invoices, the invoice document, payments and settings. Writes go through services.py.

SuperAdmin only (financial data): anonymous users go to sign-in, other roles get 403. Every change is
a POST with a CSRF token and posts back to a full page (no JavaScript needed).
"""

from django.conf import settings
from django.contrib import messages
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.accounts.roles import role_required
from apps.aidata import selectors as aidata_selectors

from . import money, selectors, services, stripe_client
from .forms import (
    BillingSettingsForm,
    InvoiceForm,
    LineFormSet,
    LinkPaymentForm,
    PaymentForm,
    VoidForm,
    initial_lines,
)
from .models import BillingSettings, InvoiceStatus, Payment, PaymentMethod

NOT_CONFIGURED = "Stripe is not configured."


def superadmin_required(view):
    """SuperAdmin only. role_required handles anonymous (login) and no-role (403) users."""

    @role_required()
    def wrapped(request, *args, **kwargs):
        if not selectors.can_access(request.user):
            raise PermissionDenied
        return view(request, *args, **kwargs)

    wrapped.__name__ = view.__name__
    wrapped.__doc__ = view.__doc__
    return wrapped


def _get(ref):
    invoice = selectors.get_by_ref(ref)
    if invoice is None:
        raise Http404
    return invoice


def _errors(exc: ValidationError) -> str:
    return " ".join(exc.messages)


# --- Invoices -------------------------------------------------------------------------------------


@superadmin_required
@require_GET
def invoices(request):
    state = {
        "status": request.GET.get("status", ""),
        "overdue": request.GET.get("overdue") == "1",
        "query": request.GET.get("q", "").strip()[: selectors.MAX_QUERY],
    }
    rows = list(selectors.invoices(**state)[:200])
    counts = selectors.status_counts()
    params = request.GET.copy()
    params.pop("status", None)
    return render(
        request,
        "billing/invoices.html",
        {
            **state,
            "rows": rows,
            "status_tabs": [
                {"status": "", "label": "All", "count": sum(c["count"] for c in counts)},
                *counts,
            ],
            "base_query": params.urlencode(),
            "totals": selectors.outstanding(),
            "unmatched_count": selectors.unmatched_count(),
            "today": timezone.localdate(),
        },
    )


def _editor(request, invoice=None, opportunity=None):
    conf = BillingSettings.load()
    if request.method == "POST":
        form = InvoiceForm(request.POST, instance=invoice)
        formset = LineFormSet(request.POST, prefix="lines")
        if form.is_valid() and formset.is_valid():
            data = {name: form.cleaned_data[name] for name in form.cleaned_data}
            try:
                if invoice is None:
                    if opportunity is not None:
                        data["opportunity"] = opportunity
                    invoice = services.create_invoice(data, formset.lines(), request.user, request=request)
                    messages.success(request, "Draft saved.")
                else:
                    services.update_draft(invoice, data, formset.lines(), request.user, request=request)
                    messages.success(request, "Draft saved.")
            except ValidationError as exc:
                form.add_error(None, exc)
            else:
                if "issue" in request.POST:
                    return _issue(request, invoice)
                if "add_lines" in request.POST:
                    return redirect("billing:invoice_edit", invoice.ref)
                return redirect(invoice.get_absolute_url())
    else:
        form = InvoiceForm(instance=invoice)
        formset = LineFormSet(prefix="lines", initial=initial_lines(invoice) if invoice else None)
    live = services.draft_totals(invoice, conf) if invoice else None
    return render(
        request,
        "billing/invoice_form.html",
        {
            "form": form,
            "formset": formset,
            "invoice": invoice,
            "opportunity": opportunity or (invoice.opportunity if invoice else None),
            "conf": conf,
            "live": live,
        },
        status=400 if request.method == "POST" else 200,
    )


@superadmin_required
@require_http_methods(["GET", "POST"])
def invoice_new(request):
    return _editor(request)


@superadmin_required
@require_POST
def from_opportunity(request, ref):
    """The "Create invoice" button on an AI & Data opportunity: a draft billed to its contact."""
    opportunity = aidata_selectors.get_by_ref(ref)
    if opportunity is None:
        raise Http404
    invoice = services.create_from_opportunity(opportunity, request.user, request=request)
    messages.success(request, f"Draft invoice created for {opportunity.ref}. Set the price, then issue it.")
    return redirect("billing:invoice_edit", invoice.ref)


@superadmin_required
@require_http_methods(["GET", "POST"])
def invoice_edit(request, ref):
    invoice = _get(ref)
    if not invoice.is_draft:
        messages.error(request, "Only a draft invoice can be edited.")
        return redirect(invoice.get_absolute_url())
    return _editor(request, invoice)


def _detail_context(request, invoice, **forms):
    conf = BillingSettings.load()
    return {
        "invoice": invoice,
        "lines": list(invoice.lines.all()),
        "payments": list(selectors.payments_for(invoice)),
        "conf": conf,
        "live": services.draft_totals(invoice, conf) if invoice.is_draft else None,
        "stripe_configured": stripe_client.is_configured(),
        "void_form": forms.get("void_form") or VoidForm(),
        "payment_form": forms.get("payment_form") or PaymentForm(invoice=invoice),
        "can_void": invoice.status in (InvoiceStatus.DRAFT, InvoiceStatus.ISSUED)
        and not invoice.payments.exists(),
        "summary_text": _summary_text(invoice, conf),
        "site_host": services.site_url().removeprefix("https://").removeprefix("http://"),
        "today": timezone.localdate(),
    }


def _summary_text(invoice, conf) -> str:
    if invoice.is_draft:
        return ""
    return render_to_string(
        "billing/summary.txt",
        {
            "invoice": invoice,
            "conf": conf,
            "site": services.site_url(),
            "site_host": services.site_url().removeprefix("https://").removeprefix("http://"),
        },
    ).strip()


@superadmin_required
@require_GET
def invoice(request, ref):
    item = _get(ref)
    return render(request, "billing/invoice.html", _detail_context(request, item))


def _issue(request, invoice):
    try:
        invoice, note = services.issue_invoice(invoice, request.user, request=request)
    except ValidationError as exc:
        messages.error(request, _errors(exc))
        return redirect("billing:invoice_edit", invoice.ref) if invoice.is_draft else redirect(invoice)
    messages.success(request, f"Issued {invoice.number}.")
    if note:
        messages.warning(request, note)
    return redirect(invoice.get_absolute_url())


@superadmin_required
@require_POST
def invoice_issue(request, ref):
    return _issue(request, _get(ref))


@superadmin_required
@require_POST
def invoice_void(request, ref):
    item = _get(ref)
    form = VoidForm(request.POST)
    if form.is_valid():
        try:
            services.void_invoice(item, form.cleaned_data["reason"], request.user, request=request)
        except ValidationError as exc:
            messages.error(request, _errors(exc))
        else:
            messages.success(request, f"{item.display_number} is void.")
            return redirect(item.get_absolute_url())
    response = render(request, "billing/invoice.html", _detail_context(request, item, void_form=form))
    response.status_code = 400
    return response


@superadmin_required
@require_POST
def invoice_payment_link(request, ref):
    item = _get(ref)
    try:
        services.create_payment_link(item, actor=request.user, request=request)
    except stripe_client.StripeNotConfigured:
        messages.error(request, f"{NOT_CONFIGURED} Add BILLING_STRIPE_SECRET_KEY to create payment links.")
    except (stripe_client.StripeError, services.BillingError) as exc:
        messages.error(request, f"The payment link was not created: {exc}")
    else:
        messages.success(request, "Payment link ready.")
    return redirect(item.get_absolute_url())


@superadmin_required
@require_POST
def invoice_record_payment(request, ref):
    item = _get(ref)
    form = PaymentForm(request.POST, invoice=item)
    if form.is_valid():
        try:
            services.record_manual_payment(
                invoice=item,
                amount_pence=money.pounds_to_pence(form.cleaned_data["amount"]),
                method=form.cleaned_data["method"],
                received_at=_received_at(form.cleaned_data["received_on"]),
                payer_email=form.cleaned_data["payer_email"],
                note=form.cleaned_data["note"],
                actor=request.user,
                request=request,
            )
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            messages.success(request, "Payment recorded.")
            return redirect(item.get_absolute_url() + "#payments")
    response = render(request, "billing/invoice.html", _detail_context(request, item, payment_form=form))
    response.status_code = 400
    return response


def _received_at(day):
    """Midday London time on the day given: a date-only bank transfer keeps its date in every zone."""
    from datetime import datetime, time

    return timezone.make_aware(datetime.combine(day, time(12, 0)))


def _document_context(invoice):
    conf = BillingSettings.load()
    totals = services.draft_totals(invoice, conf) if invoice.is_draft else None
    site = services.site_url()
    return {
        "invoice": invoice,
        "lines": list(invoice.lines.all()),
        "conf": conf,
        "totals": totals,
        "subtotal": totals.subtotal if totals else invoice.subtotal_pence,
        "vat": totals.vat if totals else invoice.vat_pence,
        "vat_rate": totals.vat_rate if totals else invoice.vat_rate,
        "total": totals.total if totals else invoice.total_pence,
        # VAT appears only when Vitalos was VAT registered (at issue; live for a draft).
        "show_vat": conf.vat_registered if invoice.is_draft else bool(invoice.vat_number),
        "vat_number": conf.vat_number if invoice.is_draft and conf.vat_registered else invoice.vat_number,
        "site_host": site.removeprefix("https://").removeprefix("http://"),
        "show_link": invoice.is_open
        and invoice.stripe_payment_link_active
        and invoice.stripe_payment_link_url,
        "address_lines": [line for line in conf.registered_address.splitlines() if line.strip()],
        "bill_address_lines": [line for line in invoice.bill_to_address.splitlines() if line.strip()],
    }


@superadmin_required
@require_GET
def invoice_document(request, ref):
    """The print-ready A4 invoice (Print / Save as PDF in the browser)."""
    item = _get(ref)
    return render(request, "billing/document.html", _document_context(item))


@superadmin_required
@require_GET
def invoice_summary(request, ref):
    item = _get(ref)
    if item.is_draft:
        raise Http404
    text = _summary_text(item, BillingSettings.load())
    return HttpResponse(text + "\n", content_type="text/plain; charset=utf-8")


# --- Payments -------------------------------------------------------------------------------------


@superadmin_required
@require_GET
def payments(request):
    matched = request.GET.get("matched", "")
    method = request.GET.get("method", "")
    rows = list(selectors.payments(matched=matched, method=method)[:200])
    conf = BillingSettings.load()
    return render(
        request,
        "billing/payments.html",
        {
            "rows": rows,
            "matched": matched,
            "method": method,
            "methods": PaymentMethod.choices,
            "unmatched_count": selectors.unmatched_count(),
            "link_form": LinkPaymentForm(),
            "stripe_configured": stripe_client.is_configured(),
            "last_sync": conf.last_stripe_sync_at,
        },
    )


@superadmin_required
@require_http_methods(["GET", "POST"])
def payment_new(request):
    form = PaymentForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        target = form.cleaned_data["invoice"]
        try:
            services.record_manual_payment(
                invoice=target,
                amount_pence=money.pounds_to_pence(form.cleaned_data["amount"]),
                method=form.cleaned_data["method"],
                received_at=_received_at(form.cleaned_data["received_on"]),
                payer_email=form.cleaned_data["payer_email"],
                note=form.cleaned_data["note"],
                actor=request.user,
                request=request,
            )
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            messages.success(request, "Payment recorded.")
            return redirect("billing:payments")
    return render(request, "billing/payment_form.html", {"form": form}, status=400 if form.errors else 200)


@superadmin_required
@require_POST
def payment_link(request, pk):
    payment = get_object_or_404(Payment, pk=pk)
    form = LinkPaymentForm(request.POST)
    if form.is_valid():
        try:
            services.link_payment(payment, form.cleaned_data["invoice"], request.user, request=request)
        except ValidationError as exc:
            messages.error(request, _errors(exc))
        else:
            messages.success(request, f"Linked to {form.cleaned_data['invoice'].number}.")
    else:
        messages.error(request, "Choose an invoice to link the payment to.")
    return redirect("billing:payments")


@superadmin_required
@require_POST
def payment_unlink(request, pk):
    payment = get_object_or_404(Payment, pk=pk)
    try:
        services.unlink_payment(payment, request.user, request=request)
    except ValidationError as exc:
        messages.error(request, _errors(exc))
    else:
        messages.success(request, "Payment unlinked. It is listed as unmatched.")
    return redirect("billing:payments")


@superadmin_required
@require_POST
def payments_sync(request):
    try:
        result = services.sync_from_stripe(actor=request.user, request=request)
    except stripe_client.StripeNotConfigured:
        messages.error(request, f"{NOT_CONFIGURED} Add BILLING_STRIPE_SECRET_KEY to sync payments.")
    except stripe_client.StripeError as exc:
        messages.error(request, f"Sync failed: {exc}")
    else:
        found = f"{result.recorded} new payment{'s' if result.recorded != 1 else ''}"
        messages.success(
            request, f"Synced from Stripe: {found} ({result.seen} Vitalos checkout sessions checked)."
        )
    return redirect("billing:payments")


# --- Settings -------------------------------------------------------------------------------------


@superadmin_required
@require_http_methods(["GET", "POST"])
def billing_settings(request):
    current = BillingSettings.load()
    form = BillingSettingsForm(request.POST or None, instance=BillingSettings.objects.get(pk=current.pk))
    if request.method == "POST" and form.is_valid():
        try:
            changed = services.update_settings(form.cleaned_data, request.user, request=request)
        except ValidationError as exc:
            form.add_error(None, exc)
        else:
            messages.success(request, "Billing settings saved." if changed else "Nothing changed.")
            return redirect("billing:settings")
    return render(
        request,
        "billing/settings.html",
        {
            "form": form,
            "stripe_configured": stripe_client.is_configured(),
            "webhook_configured": bool(settings.BILLING_STRIPE_WEBHOOK_SECRET),
            "site": services.site_url(),
            "last_sync": current.last_stripe_sync_at,
        },
        status=400 if form.errors else 200,
    )
