"""Billing write rules. Every change is authorised here and recorded in the audit trail.

Views call these functions; they never change billing models directly. Audit summaries name invoice
numbers, never customer names or amounts. Stripe is called only through stripe_client.py, and never
inside a database transaction: an invoice is issued (and a payment recorded) whether or not Stripe
answers, and a failed Stripe step can be retried from the invoice page.
"""

import hmac
import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import quote, urlencode, urlsplit

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from apps.audit.services import record

from . import money, selectors, stripe_client
from .models import (
    MANUAL_METHODS,
    OPEN_STATUSES,
    BillingSettings,
    Invoice,
    InvoiceLine,
    InvoiceStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
)

logger = logging.getLogger(__name__)

#: No 0/O, 1/I/L: easy to read from paper and to type.
PAYMENT_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
PAYMENT_CODE_LENGTH = 8
MAX_LINES = 50
SYNC_INTERVAL = timedelta(minutes=10)
SYNC_LOOKBACK = timedelta(days=14)
TICK_LOOKBACK = timedelta(days=3)
SYNC_MAX_PAGES = 5
#: Public checkout limits (Django cache): per client IP, and per invoice number across all IPs.
IP_LIMIT = (10, 600)
INVOICE_LIMIT = (20, 600)
CHECKOUT_ERRORS = ("not-found", "paid", "verification", "rate-limited", "unavailable")
LINKABLE_STATUSES = (InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID)

SETTINGS_FIELDS = (
    "legal_name",
    "company_number",
    "registered_address",
    "contact_email",
    "website",
    "vat_registered",
    "vat_number",
    "default_vat_rate",
    "payment_terms_days",
    "invoice_prefix",
    "bank_details",
    "footer_note",
)
INVOICE_FIELDS = (
    "bill_to_name",
    "bill_to_organisation",
    "bill_to_email",
    "bill_to_address",
    "notes",
    "opportunity",
)


class BillingError(Exception):
    """A refusal with a message that is safe to show to the signed-in owner."""


def _require(actor) -> None:
    if not selectors.can_access(actor):
        raise PermissionDenied


def site_url() -> str:
    return (getattr(settings, "BILLING_PUBLIC_SITE_URL", "") or "https://vitalos.co.uk").rstrip("/")


def thank_you_url(number: str) -> str:
    return f"{site_url()}/pay/thank-you?invoice={quote(number)}"


def generate_payment_code() -> str:
    return "".join(secrets.choice(PAYMENT_CODE_ALPHABET) for _ in range(PAYMENT_CODE_LENGTH))


def normalise_code(text) -> str:
    """``abcd-efgh`` / ``ABCD EFGH`` → ``ABCDEFGH``; anything else → ``""``."""
    value = "".join(ch for ch in str(text or "")[:40].upper() if ch not in " -\t")
    if len(value) != PAYMENT_CODE_LENGTH or any(ch not in PAYMENT_CODE_ALPHABET for ch in value):
        return ""
    return value


# --- Settings -------------------------------------------------------------------------------------


def update_settings(data: dict, actor, request=None) -> list[str]:
    _require(actor)
    with transaction.atomic():
        BillingSettings.load()
        current = BillingSettings.objects.select_for_update().get(pk=1)
        changed = [name for name in SETTINGS_FIELDS if name in data and getattr(current, name) != data[name]]
        for name in changed:
            setattr(current, name, data[name])
        if not current.vat_registered:
            current.vat_number = current.vat_number.strip()
        current.updated_by = actor
        current.full_clean()
        current.save()
        if changed:
            labels = ", ".join(str(BillingSettings._meta.get_field(name).verbose_name) for name in changed)
            record(
                "billing.settings_changed",
                request=request,
                actor=actor,
                entity=current,
                summary=f"Changed {labels}"[:300],
                fields=changed,
            )
    return changed


# --- Drafts ---------------------------------------------------------------------------------------


def draft_totals(invoice: Invoice, conf: BillingSettings | None = None) -> money.Totals:
    """Live totals for a draft (current VAT settings). Issued invoices use their stored snapshots."""
    conf = conf or BillingSettings.load()
    lines = [(line.quantity, line.unit_price_pence) for line in invoice.lines.all()]
    return money.compute_totals(lines, vat_registered=conf.vat_registered, vat_rate=conf.default_vat_rate)


def _replace_lines(invoice: Invoice, lines: list[dict]) -> None:
    if len(lines) > MAX_LINES:
        raise ValidationError(f"An invoice can have at most {MAX_LINES} lines.")
    invoice.lines.all().delete()
    for position, line in enumerate(lines):
        item = InvoiceLine(
            invoice=invoice,
            position=position,
            description=str(line["description"]).strip(),
            quantity=line["quantity"],
            unit_price_pence=int(line["unit_price_pence"]),
        )
        item.line_total_pence = money.line_total_pence(item.quantity, item.unit_price_pence)
        item.full_clean(exclude=["invoice"])
        item.save()


def _store_draft_totals(invoice: Invoice) -> None:
    conf = BillingSettings.load()
    totals = draft_totals(invoice, conf)
    invoice.vat_rate = totals.vat_rate
    invoice.subtotal_pence = totals.subtotal
    invoice.vat_pence = totals.vat
    invoice.total_pence = totals.total
    invoice.balance_due_pence = totals.total
    invoice.save(
        update_fields=[
            "vat_rate",
            "subtotal_pence",
            "vat_pence",
            "total_pence",
            "balance_due_pence",
            "updated_at",
        ]
    )


def create_invoice(data: dict, lines: list[dict], actor, request=None) -> Invoice:
    """A new draft. Nothing is numbered or sent to Stripe until it is issued."""
    _require(actor)
    values = {name: data[name] for name in INVOICE_FIELDS if name in data}
    with transaction.atomic():
        invoice = Invoice(created_by=actor, status=InvoiceStatus.DRAFT, **values)
        invoice.full_clean()
        invoice.save()
        _replace_lines(invoice, lines)
        _store_draft_totals(invoice)
        record(
            "billing.invoice_created",
            request=request,
            actor=actor,
            entity=invoice,
            summary=f"Created draft invoice {invoice.ref}",
        )
    return invoice


def create_from_opportunity(opportunity, actor, request=None) -> Invoice:
    """A draft billed to an AI & Data opportunity's organisation and contact. The price is left for a person."""
    _require(actor)
    name = opportunity.contact_name or opportunity.organisation or opportunity.title
    description = opportunity.get_offer_display() if opportunity.offer else opportunity.title
    data = {
        "bill_to_name": name[:200],
        "bill_to_organisation": opportunity.organisation if opportunity.contact_name else "",
        "bill_to_email": opportunity.contact_email,
        "opportunity": opportunity,
    }
    lines = [{"description": description[:500], "quantity": 1, "unit_price_pence": 0}]
    invoice = create_invoice(data, lines, actor, request=request)
    return invoice


def update_draft(invoice: Invoice, data: dict, lines: list[dict], actor, request=None) -> Invoice:
    _require(actor)
    with transaction.atomic():
        locked = Invoice.objects.select_for_update().get(pk=invoice.pk)
        if locked.status != InvoiceStatus.DRAFT:
            raise ValidationError("Only a draft invoice can be edited.")
        for name in INVOICE_FIELDS:
            if name in data:
                setattr(locked, name, data[name])
        locked.full_clean()
        locked.save()
        _replace_lines(locked, lines)
        _store_draft_totals(locked)
        record(
            "billing.invoice_updated",
            request=request,
            actor=actor,
            entity=locked,
            summary=f"Edited draft invoice {locked.ref}",
        )
    invoice.refresh_from_db()
    return invoice


# --- Issue and void -------------------------------------------------------------------------------


def _allocate_and_issue(invoice_pk: int, actor, today, request=None) -> Invoice:
    with transaction.atomic():
        BillingSettings.load()
        # Locking the settings row serialises number allocation across processes (PostgreSQL).
        conf = BillingSettings.objects.select_for_update().get(pk=1)
        invoice = Invoice.objects.select_for_update().get(pk=invoice_pk)
        if invoice.status != InvoiceStatus.DRAFT:
            raise ValidationError("This invoice has already been issued.")
        lines = list(invoice.lines.all())
        if not lines:
            raise ValidationError("Add at least one line before issuing.")
        totals = money.compute_totals(
            [(line.quantity, line.unit_price_pence) for line in lines],
            vat_registered=conf.vat_registered,
            vat_rate=conf.default_vat_rate,
        )
        if totals.total <= 0:
            raise ValidationError("The total must be more than £0.00 to issue an invoice.")
        if not invoice.bill_to_name.strip():
            raise ValidationError("Add who the invoice is billed to.")
        year = today.year
        highest = Invoice.objects.filter(number_year=year).aggregate(top=Max("number_sequence"))["top"] or 0
        sequence = highest + 1
        invoice.number = f"{conf.invoice_prefix}-{year}-{sequence:04d}"
        invoice.number_year = year
        invoice.number_sequence = sequence
        invoice.status = InvoiceStatus.ISSUED
        invoice.issue_date = today
        invoice.due_date = today + timedelta(days=conf.payment_terms_days)
        invoice.vat_rate = totals.vat_rate
        invoice.vat_number = conf.vat_number.strip() if conf.vat_registered else ""
        invoice.subtotal_pence = totals.subtotal
        invoice.vat_pence = totals.vat
        invoice.total_pence = totals.total
        invoice.amount_paid_pence = 0
        invoice.balance_due_pence = totals.total
        invoice.payment_code = generate_payment_code()
        invoice.issued_at = timezone.now()
        invoice.save()
        for line, line_total in zip(lines, totals.line_totals, strict=True):
            if line.line_total_pence != line_total:
                line.line_total_pence = line_total
                line.save(update_fields=["line_total_pence"])
        record(
            "billing.invoice_issued",
            request=request,
            actor=actor,
            entity=invoice,
            entity_id=invoice.number,
            summary=f"Issued invoice {invoice.number}",
        )
    return invoice


def issue_invoice(invoice: Invoice, actor, request=None, *, today=None) -> tuple[Invoice, str]:
    """Number, snapshot and issue a draft, then try to create its Stripe payment link.

    Returns the invoice and a note about the payment link ("" when it was created). The invoice is
    issued even when Stripe is not configured or fails.
    """
    _require(actor)
    today = today or timezone.localdate()
    issued = None
    for _attempt in range(3):
        try:
            issued = _allocate_and_issue(invoice.pk, actor, today, request=request)
            break
        except IntegrityError:
            # Another process took the same sequence number (only possible without row locks).
            continue
    if issued is None:
        raise ValidationError("Could not allocate an invoice number. Try again.")
    note = ""
    if stripe_client.is_configured():
        try:
            create_payment_link(issued)
        except (stripe_client.StripeError, BillingError) as exc:
            logger.warning(
                "Payment link not created at issue", extra={"invoice": issued.number, "error": str(exc)}
            )
            note = f"The payment link was not created: {exc} Use Create payment link to try again."
    else:
        note = "Stripe is not configured, so no payment link was created."
    invoice.refresh_from_db()
    return invoice, note


def void_invoice(invoice: Invoice, reason: str, actor, request=None) -> Invoice:
    _require(actor)
    reason = (reason or "").strip()
    if not reason:
        raise ValidationError("Give a reason for voiding the invoice.")
    with transaction.atomic():
        locked = Invoice.objects.select_for_update().get(pk=invoice.pk)
        if locked.status not in (InvoiceStatus.DRAFT, InvoiceStatus.ISSUED):
            raise ValidationError("Only a draft or issued invoice with no payments can be voided.")
        if locked.payments.exists():
            raise ValidationError("This invoice has payments. Unlink or refund them before voiding.")
        locked.status = InvoiceStatus.VOID
        locked.void_reason = reason[:2000]
        locked.voided_at = timezone.now()
        locked.save(update_fields=["status", "void_reason", "voided_at", "updated_at"])
        record(
            "billing.invoice_voided",
            request=request,
            actor=actor,
            entity=locked,
            entity_id=locked.ref,
            summary=f"Voided invoice {locked.ref}",
        )
    _deactivate_quietly(locked)
    invoice.refresh_from_db()
    return invoice


# --- Stripe payment links -------------------------------------------------------------------------


def create_payment_link(invoice: Invoice, actor=None, request=None) -> Invoice:
    """A single-use Stripe Payment Link for the invoice's current balance.

    Raises StripeNotConfigured, another StripeError or BillingError; the invoice is unchanged then.
    """
    if actor is not None:
        _require(actor)
    current = Invoice.objects.get(pk=invoice.pk)
    if current.status not in OPEN_STATUSES:
        raise BillingError("Payment links are only for issued invoices that still have a balance.")
    if current.balance_due_pence <= 0:
        raise BillingError("Nothing is due on this invoice.")
    if (
        current.stripe_payment_link_active
        and current.stripe_payment_link_amount_pence == current.balance_due_pence
    ):
        return current
    client = stripe_client.get_client()
    if current.stripe_payment_link_active:
        deactivate_payment_link(current)
        current.refresh_from_db()
    base = f"{current.pk}-{current.balance_due_pence}-{current.stripe_payment_link_id or 'first'}"
    price = client.create_price(
        name=f"Invoice {current.number}",
        unit_amount=current.balance_due_pence,
        currency="gbp",
        idempotency_key=f"vitalos-billing-price-{base}",
    )
    price_id = str(price.get("id") or "")
    if not price_id.startswith("price_"):
        raise stripe_client.StripeResponseInvalid("Stripe returned no price id.")
    link = client.create_payment_link(
        price_id=price_id,
        invoice_number=current.number,
        redirect_url=thank_you_url(current.number),
        idempotency_key=f"vitalos-billing-link-{base}",
    )
    link_id = str(link.get("id") or "")
    link_url = str(link.get("url") or "")
    if not link_id.startswith("plink_") or urlsplit(link_url).scheme != "https" or len(link_url) > 500:
        raise stripe_client.StripeResponseInvalid("Stripe returned no usable payment link.")
    Invoice.objects.filter(pk=current.pk).update(
        stripe_payment_link_id=link_id,
        stripe_payment_link_url=link_url,
        stripe_payment_link_amount_pence=current.balance_due_pence,
        stripe_payment_link_active=True,
        updated_at=timezone.now(),
    )
    record(
        "billing.payment_link_created",
        request=request,
        actor=actor,
        entity=current,
        entity_id=current.number,
        summary=f"Created a payment link for {current.number}",
    )
    current.refresh_from_db()
    return current


def deactivate_payment_link(invoice: Invoice, actor=None, request=None) -> bool:
    if actor is not None:
        _require(actor)
    if not (invoice.stripe_payment_link_id and invoice.stripe_payment_link_active):
        return False
    stripe_client.get_client().deactivate_payment_link(invoice.stripe_payment_link_id)
    Invoice.objects.filter(pk=invoice.pk).update(stripe_payment_link_active=False, updated_at=timezone.now())
    invoice.stripe_payment_link_active = False
    record(
        "billing.payment_link_deactivated",
        request=request,
        actor=actor,
        entity=invoice,
        entity_id=invoice.ref,
        summary=f"Deactivated the payment link for {invoice.ref}",
    )
    return True


def _deactivate_quietly(invoice: Invoice) -> None:
    try:
        deactivate_payment_link(invoice)
    except stripe_client.StripeError as exc:
        logger.warning("Payment link not deactivated", extra={"invoice": invoice.ref, "error": str(exc)})


# --- Payments -------------------------------------------------------------------------------------


def recompute(invoice: Invoice) -> Invoice:
    """Amount paid, balance and status from the invoice's payments. The one place status follows money."""
    with transaction.atomic():
        locked = Invoice.objects.select_for_update().get(pk=invoice.pk)
        if locked.status in (InvoiceStatus.DRAFT, InvoiceStatus.VOID):
            return locked
        paid = sum(payment.net_pence for payment in locked.payments.all())
        balance = locked.total_pence - paid
        if balance <= 0:
            status = InvoiceStatus.PAID
        elif paid > 0:
            status = InvoiceStatus.PARTIALLY_PAID
        else:
            status = InvoiceStatus.ISSUED
        locked.amount_paid_pence = paid
        locked.balance_due_pence = balance
        locked.status = status
        if status == InvoiceStatus.PAID:
            # Paid on the day the last payment arrived (a bank transfer may be recorded days later).
            latest = max((payment.received_at for payment in locked.payments.all()), default=None)
            locked.paid_at = locked.paid_at or latest or timezone.now()
        else:
            locked.paid_at = None
        locked.save(
            update_fields=["amount_paid_pence", "balance_due_pence", "status", "paid_at", "updated_at"]
        )
    # A link for a different amount (or for a paid invoice) must not be paid again.
    if locked.stripe_payment_link_active and (
        locked.balance_due_pence <= 0 or locked.stripe_payment_link_amount_pence != locked.balance_due_pence
    ):
        _deactivate_quietly(locked)
    invoice.refresh_from_db()
    return invoice


def _check_linkable(invoice: Invoice) -> None:
    if invoice.status not in LINKABLE_STATUSES:
        raise ValidationError("Payments can only be recorded against an issued invoice.")


def record_manual_payment(
    *,
    invoice: Invoice | None,
    amount_pence: int,
    method: str,
    received_at,
    actor,
    payer_email: str = "",
    note: str = "",
    request=None,
) -> Payment:
    """A bank transfer (or other payment) entered by a person, optionally against an invoice."""
    _require(actor)
    if method not in MANUAL_METHODS:
        raise ValidationError("Stripe payments are recorded from Stripe, not by hand.")
    if int(amount_pence) <= 0:
        raise ValidationError("The amount must be more than £0.00.")
    if invoice is not None:
        _check_linkable(invoice)
    payment = Payment(
        invoice=invoice,
        amount_pence=int(amount_pence),
        currency="GBP",
        method=method,
        status=PaymentStatus.SUCCEEDED,
        payer_email=payer_email,
        received_at=received_at,
        note=note,
        reference=invoice.number if invoice else "",
        created_by=actor,
    )
    payment.full_clean()
    payment.save()
    target = f"for {invoice.number}" if invoice else "(not yet linked to an invoice)"
    record(
        "billing.payment_recorded",
        request=request,
        actor=actor,
        entity=payment,
        summary=f"Recorded a {payment.get_method_display().lower()} payment {target}",
        invoice=invoice.number if invoice else "",
    )
    if invoice is not None:
        recompute(invoice)
    return payment


def link_payment(payment: Payment, invoice: Invoice, actor, request=None) -> Payment:
    _require(actor)
    _check_linkable(invoice)
    with transaction.atomic():
        locked = Payment.objects.select_for_update().get(pk=payment.pk)
        if locked.invoice_id is not None:
            raise ValidationError("This payment is already linked. Unlink it first.")
        locked.invoice = invoice
        locked.save(update_fields=["invoice", "updated_at"])
        record(
            "billing.payment_linked",
            request=request,
            actor=actor,
            entity=locked,
            summary=f"Linked payment {locked.pk} to {invoice.number}",
            invoice=invoice.number,
        )
    recompute(invoice)
    payment.refresh_from_db()
    return payment


def unlink_payment(payment: Payment, actor, request=None) -> Payment:
    _require(actor)
    with transaction.atomic():
        locked = Payment.objects.select_for_update().get(pk=payment.pk)
        previous = locked.invoice
        if previous is None:
            raise ValidationError("This payment is not linked to an invoice.")
        locked.invoice = None
        locked.save(update_fields=["invoice", "updated_at"])
        record(
            "billing.payment_unlinked",
            request=request,
            actor=actor,
            entity=locked,
            summary=f"Unlinked payment {locked.pk} from {previous.ref}",
            invoice=previous.ref,
        )
    recompute(previous)
    payment.refresh_from_db()
    return payment


# --- Stripe → payments ----------------------------------------------------------------------------


def _object_id(value) -> str:
    if isinstance(value, dict):
        value = value.get("id")
    return str(value or "")[:255]


def record_checkout_session(session: dict, *, source: str) -> tuple[Payment | None, bool]:
    """Record a paid Checkout Session once (idempotent by session id). Returns (payment, created)."""
    if not isinstance(session, dict):
        return None, False
    session_id = str(session.get("id") or "")
    if not session_id.startswith("cs_") or len(session_id) > 255:
        return None, False
    if session.get("payment_status") != "paid":
        return None, False
    existing = Payment.objects.filter(stripe_checkout_session_id=session_id).first()
    if existing is not None:
        return existing, False
    try:
        amount = int(session.get("amount_total") or 0)
    except (TypeError, ValueError):
        amount = 0
    if amount <= 0:
        return None, False
    metadata = session.get("metadata") if isinstance(session.get("metadata"), dict) else {}
    reference = str(metadata.get("vitalos_invoice") or session.get("client_reference_id") or "")[:60]
    currency = str(session.get("currency") or "gbp").upper()[:3]
    invoice = selectors.invoice_by_number(reference)
    if invoice is not None and (invoice.status not in LINKABLE_STATUSES or currency != "GBP"):
        invoice = None  # Paid against a draft, void or foreign-currency invoice: leave it for a person.
    details = session.get("customer_details") if isinstance(session.get("customer_details"), dict) else {}
    payer_email = str(details.get("email") or session.get("customer_email") or "")[:254]
    try:
        received_at = datetime.fromtimestamp(int(session.get("created")), tz=UTC)
    except (TypeError, ValueError, OverflowError, OSError):
        received_at = timezone.now()
    method = (
        PaymentMethod.STRIPE_PAYMENT_LINK if session.get("payment_link") else PaymentMethod.STRIPE_CHECKOUT
    )
    try:
        with transaction.atomic():
            payment = Payment.objects.create(
                invoice=invoice,
                amount_pence=amount,
                currency=currency,
                method=method,
                status=PaymentStatus.SUCCEEDED,
                stripe_checkout_session_id=session_id,
                stripe_payment_intent_id=_object_id(session.get("payment_intent")),
                reference=selectors.normalise_number(reference) or reference.strip()[:60],
                payer_email=payer_email,
                received_at=received_at,
            )
    except IntegrityError:
        return Payment.objects.filter(stripe_checkout_session_id=session_id).first(), False
    record(
        "billing.payment_recorded",
        entity=payment,
        summary=f"Stripe payment for {invoice.number}" if invoice else "Unmatched Stripe payment",
        invoice=invoice.number if invoice else "",
        source=source,
    )
    if invoice is not None:
        recompute(invoice)
    return payment, True


def record_charge_refund(charge: dict) -> Payment | None:
    """``charge.refunded``: store the refunded amount on the matching payment and recompute."""
    if not isinstance(charge, dict):
        return None
    intent = _object_id(charge.get("payment_intent"))
    if not intent:
        return None
    payment = Payment.objects.filter(stripe_payment_intent_id=intent).select_related("invoice").first()
    if payment is None:
        return None
    try:
        refunded = min(int(charge.get("amount_refunded") or 0), payment.amount_pence)
    except (TypeError, ValueError):
        return payment
    if refunded <= payment.amount_refunded_pence:
        return payment  # A repeat of an event already applied.
    payment.amount_refunded_pence = refunded
    payment.status = PaymentStatus.REFUNDED if refunded >= payment.amount_pence else PaymentStatus.SUCCEEDED
    payment.save(update_fields=["amount_refunded_pence", "status", "updated_at"])
    record(
        "billing.payment_refunded",
        entity=payment,
        summary=f"Stripe refund on payment {payment.pk}"
        + (f" for {payment.invoice.number}" if payment.invoice else ""),
        invoice=payment.invoice.number if payment.invoice else "",
    )
    if payment.invoice is not None:
        recompute(payment.invoice)
    return payment


CHECKOUT_EVENTS = ("checkout.session.completed", "checkout.session.async_payment_succeeded")


def handle_webhook_event(event: dict) -> str:
    """One verified Stripe event. Returns what happened: recorded, duplicate, refunded or ignored."""
    kind = str(event.get("type") or "")
    data = event.get("data") if isinstance(event.get("data"), dict) else {}
    obj = data.get("object") if isinstance(data.get("object"), dict) else {}
    if kind in CHECKOUT_EVENTS:
        payment, created = record_checkout_session(obj, source="webhook")
        if payment is None:
            return "ignored"
        return "recorded" if created else "duplicate"
    if kind == "charge.refunded":
        return "refunded" if record_charge_refund(obj) is not None else "ignored"
    return "ignored"


@dataclass(frozen=True)
class SyncResult:
    seen: int
    recorded: int
    pages: int


def sync_from_stripe(*, now=None, lookback=SYNC_LOOKBACK, max_pages=SYNC_MAX_PAGES, actor=None, request=None):
    """Record completed Checkout Sessions that name a Vitalos invoice (idempotent; bounded pages)."""
    if actor is not None:
        _require(actor)
    client = stripe_client.get_client()
    now = now or timezone.now()
    created_gte = int((now - lookback).timestamp())
    seen = recorded = pages = 0
    starting_after = ""
    while pages < max_pages:
        payload = client.list_checkout_sessions(created_gte=created_gte, starting_after=starting_after)
        pages += 1
        rows = payload.get("data") if isinstance(payload.get("data"), list) else []
        for session in rows:
            if not isinstance(session, dict):
                continue
            metadata = session.get("metadata") if isinstance(session.get("metadata"), dict) else {}
            if not metadata.get("vitalos_invoice"):
                continue
            seen += 1
            _payment, created = record_checkout_session(session, source="sync")
            recorded += int(created)
        if not payload.get("has_more") or not rows:
            break
        starting_after = _object_id(rows[-1])
        if not starting_after:
            break
    BillingSettings.load()
    BillingSettings.objects.filter(pk=1).update(last_stripe_sync_at=now)
    if actor is not None or recorded:
        record(
            "billing.stripe_synced",
            request=request,
            actor=actor,
            summary=f"Synced from Stripe: {recorded} new payment{'s' if recorded != 1 else ''}",
            seen=seen,
            recorded=recorded,
        )
    return SyncResult(seen=seen, recorded=recorded, pages=pages)


def tick_sync(now=None) -> int:
    """Called by the content tick: sync at most every 10 minutes, only with a key. Never raises."""
    if not stripe_client.is_configured():
        return 0
    now = now or timezone.now()
    try:
        conf = BillingSettings.load()
        last = conf.last_stripe_sync_at
        if last is not None and now - last < SYNC_INTERVAL:
            return 0
        claimed = BillingSettings.objects.filter(pk=conf.pk, last_stripe_sync_at=last).update(
            last_stripe_sync_at=now
        )
        if not claimed:
            return 0
        return sync_from_stripe(now=now, lookback=TICK_LOOKBACK).recorded
    except stripe_client.StripeError as exc:
        logger.warning("Billing Stripe sync failed", extra={"error": str(exc)})
    except Exception:  # noqa: BLE001 - billing must never stop the content tick
        logger.exception("Billing Stripe sync failed")
    return 0


# --- Public checkout (vitalos.co.uk/pay) ----------------------------------------------------------


class CheckoutRefused(Exception):
    def __init__(self, code: str):
        if code not in CHECKOUT_ERRORS:
            raise ValueError(f"Unknown checkout error {code!r}")
        super().__init__(code)
        self.code = code


def _over_limit(key: str, limit: int, window: int) -> bool:
    cache.add(key, 0, window)
    try:
        count = cache.incr(key)
    except ValueError:  # expired between add and incr
        cache.set(key, 1, window)
        count = 1
    return count > limit


def check_ip_limit(ip: str) -> None:
    if _over_limit(f"billing:pay:ip:{ip or 'unknown'}", *IP_LIMIT):
        raise CheckoutRefused("rate-limited")


def check_invoice_limit(number: str) -> None:
    """Attempts naming one invoice, from any IP: stops guessing a payment code from many addresses."""
    if number and _over_limit(f"billing:pay:invoice:{number}", *INVOICE_LIMIT):
        raise CheckoutRefused("rate-limited")


def is_stripe_checkout_url(url: str) -> bool:
    parts = urlsplit(str(url or ""))
    return parts.scheme == "https" and parts.hostname == "checkout.stripe.com" and not parts.username


def pay_page_url(number: str = "", **params) -> str:
    query = {"invoice": number} if number else {}
    query.update(params)
    return f"{site_url()}/pay" + (f"?{urlencode(query)}" if query else "")


def start_public_checkout(number: str, code: str, *, now=None) -> str:
    """Check the invoice number and payment code, then open a Stripe Checkout Session for the balance.

    Returns the session URL (on checkout.stripe.com) or raises CheckoutRefused with one of
    CHECKOUT_ERRORS. A wrong code, an unknown number, a draft and a void invoice all give the same
    ``not-found`` so nothing about which invoices exist can be learned.
    """
    invoice = selectors.invoice_by_number(number) if number else None
    if (
        invoice is None
        or invoice.status not in LINKABLE_STATUSES
        or not code
        or len(invoice.payment_code) != PAYMENT_CODE_LENGTH
        or not hmac.compare_digest(invoice.payment_code, code)
    ):
        raise CheckoutRefused("not-found")
    if invoice.status == InvoiceStatus.PAID or invoice.balance_due_pence <= 0:
        raise CheckoutRefused("paid")
    if not stripe_client.is_configured():
        raise CheckoutRefused("unavailable")
    now = now or timezone.now()
    # Same invoice, same balance, same 10 minutes: a double submit reuses one session.
    bucket = int(now.timestamp()) // 600
    try:
        session = stripe_client.get_client().create_checkout_session(
            invoice_number=invoice.number,
            amount=invoice.balance_due_pence,
            currency="gbp",
            customer_email=invoice.bill_to_email,
            success_url=thank_you_url(invoice.number),
            cancel_url=pay_page_url(invoice.number, cancelled="1"),
            idempotency_key=f"vitalos-billing-checkout-{invoice.pk}-{invoice.balance_due_pence}-{bucket}",
        )
    except stripe_client.StripeError as exc:
        logger.warning("Checkout session not created", extra={"invoice": invoice.number, "error": str(exc)})
        raise CheckoutRefused("unavailable") from None
    url = str(session.get("url") or "")
    if not is_stripe_checkout_url(url):
        logger.warning("Checkout session URL refused", extra={"invoice": invoice.number})
        raise CheckoutRefused("unavailable")
    record(
        "billing.checkout_started",
        entity=invoice,
        entity_id=invoice.number,
        summary=f"Opened a card payment for {invoice.number}",
    )
    return url
