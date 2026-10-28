"""Billing reads: who may see it, invoice and payment lists, lookups and outstanding totals."""

import re

from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.accounts.roles import is_superadmin

from .models import OPEN_STATUSES, Invoice, InvoiceStatus, Payment, PaymentMethod

MAX_QUERY = 100
#: PREFIX-YEAR-SEQUENCE, e.g. INV-2026-0001.
NUMBER_RE = re.compile(r"^[A-Z]{2,8}-\d{4}-\d{4,7}$")
DRAFT_REF_RE = re.compile(r"^draft-(\d{1,12})$")


def can_access(user) -> bool:
    """Financial records: SuperAdmin only."""
    return is_superadmin(user)


def normalise_number(text) -> str:
    """``inv-2026-0001`` → ``INV-2026-0001``; anything that is not a number shape → ``""``."""
    value = re.sub(r"\s+", "", str(text or "")).upper()[:40]
    return value if NUMBER_RE.match(value) else ""


def invoice_by_number(number: str) -> Invoice | None:
    value = normalise_number(number)
    if not value:
        return None
    return Invoice.objects.filter(number=value).first()


def get_by_ref(ref: str) -> Invoice | None:
    """An invoice by its URL reference: the number, or ``draft-<id>`` for a draft."""
    match = DRAFT_REF_RE.match(str(ref or ""))
    if match:
        return Invoice.objects.filter(pk=int(match.group(1)), number__isnull=True).first()
    return invoice_by_number(ref)


def overdue_q(today=None) -> Q:
    today = today or timezone.localdate()
    return Q(status__in=OPEN_STATUSES, due_date__lt=today)


def invoices(*, status: str = "", overdue: bool = False, query: str = ""):
    rows = Invoice.objects.select_related("opportunity")
    if status in InvoiceStatus.values:
        rows = rows.filter(status=status)
    if overdue:
        rows = rows.filter(overdue_q())
    query = (query or "").strip()[:MAX_QUERY]
    if query:
        rows = rows.filter(
            Q(number__icontains=query)
            | Q(bill_to_name__icontains=query)
            | Q(bill_to_organisation__icontains=query)
            | Q(bill_to_email__icontains=query)
        )
    return rows


def status_counts() -> list[dict]:
    counts = {status: 0 for status in InvoiceStatus.values}
    for row in Invoice.objects.values("status").annotate(n=Count("id")):
        counts[row["status"]] = row["n"]
    return [
        {"status": value, "label": label, "count": counts[value]} for value, label in InvoiceStatus.choices
    ]


def outstanding() -> dict:
    """Totals across issued and part-paid invoices (pence)."""
    open_rows = Invoice.objects.filter(status__in=OPEN_STATUSES)
    overdue_rows = Invoice.objects.filter(overdue_q())
    return {
        "outstanding_pence": open_rows.aggregate(total=Sum("balance_due_pence"))["total"] or 0,
        "outstanding_count": open_rows.count(),
        "overdue_pence": overdue_rows.aggregate(total=Sum("balance_due_pence"))["total"] or 0,
        "overdue_count": overdue_rows.count(),
        "draft_count": Invoice.objects.filter(status=InvoiceStatus.DRAFT).count(),
    }


def linkable_invoices():
    """Invoices a payment may be linked to: issued, part-paid or paid (never drafts or void)."""
    return Invoice.objects.filter(
        status__in=(InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID)
    ).order_by("-number_year", "-number_sequence")


def payments(*, matched: str = "", method: str = ""):
    rows = Payment.objects.select_related("invoice", "created_by")
    if matched == "unmatched":
        rows = rows.filter(invoice__isnull=True)
    elif matched == "matched":
        rows = rows.filter(invoice__isnull=False)
    if method in PaymentMethod.values:
        rows = rows.filter(method=method)
    return rows


def unmatched_count() -> int:
    return Payment.objects.filter(invoice__isnull=True).count()


def payments_for(invoice: Invoice):
    return invoice.payments.select_related("created_by").order_by("received_at", "id")
