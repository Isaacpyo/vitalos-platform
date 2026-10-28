"""Vitalos billing: invoices, their lines, payments and the billing settings singleton.

Money is integer pence everywhere it is stored (no floats). Currency is GBP. Business rules live in
services.py (writes), selectors.py (reads) and money.py (arithmetic); Stripe calls in stripe_client.py.
"""

from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.urls import reverse
from django.utils import timezone

#: Public company details (packages/cms/src/repo/legal.ts); the same values seed migration 0002.
SEED_DEFAULTS = {
    "legal_name": "Vitalos Technologies Limited",
    "company_number": "16696895",
    "registered_address": "114 High Street\nBentley\nDoncaster\nEngland\nDN5 0AT",
    "contact_email": "support@vitalos.co.uk",
    "website": "vitalos.co.uk",
    "footer_note": "Questions about this invoice? Email support@vitalos.co.uk and quote the invoice number.",
}
PREFIX_VALIDATOR = RegexValidator(r"^[A-Z]{2,8}$", "Use 2 to 8 capital letters, for example INV.")


class BillingSettings(models.Model):
    """Singleton (pk=1): who issues the invoices and how they are numbered and paid."""

    legal_name = models.CharField(max_length=200)
    company_number = models.CharField(max_length=40, blank=True)
    registered_address = models.TextField(blank=True)
    contact_email = models.EmailField(blank=True)
    website = models.CharField(max_length=200, blank=True)
    vat_registered = models.BooleanField(
        "VAT registered",
        default=False,
        help_text="Only when Vitalos is registered for VAT. Unregistered invoices show no VAT and make no VAT claim.",
    )
    vat_number = models.CharField("VAT number", max_length=40, blank=True)
    default_vat_rate = models.DecimalField(
        "Default VAT rate (%)",
        max_digits=5,
        decimal_places=2,
        default=Decimal("20.00"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
        help_text="Used only when VAT registered.",
    )
    payment_terms_days = models.PositiveSmallIntegerField(
        default=14, validators=[MaxValueValidator(365)], help_text="Due date = issue date + this many days."
    )
    invoice_prefix = models.CharField(max_length=8, default="INV", validators=[PREFIX_VALIDATOR])
    bank_details = models.TextField(
        "Bank transfer details",
        blank=True,
        help_text="Optional. Printed on invoices only when set. Enter the real account details yourself.",
    )
    footer_note = models.TextField(blank=True)
    # When billing last read completed Checkout Sessions from Stripe (the content tick runs it every 10 min).
    last_stripe_sync_at = models.DateTimeField(null=True, blank=True, editable=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "billing settings"

    def __str__(self):
        return "Billing settings"

    @classmethod
    def load(cls) -> "BillingSettings":
        obj, _ = cls.objects.get_or_create(pk=1, defaults=SEED_DEFAULTS)
        return obj


class InvoiceStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    ISSUED = "issued", "Issued"
    PARTIALLY_PAID = "partially_paid", "Partially paid"
    PAID = "paid", "Paid"
    VOID = "void", "Void"


#: Statuses a customer can still pay against.
OPEN_STATUSES = (InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID)


class Invoice(models.Model):
    # Allocated atomically when the invoice is issued (PREFIX-YEAR-SEQUENCE); drafts have none.
    number = models.CharField(max_length=40, unique=True, null=True, blank=True, editable=False)
    number_year = models.PositiveSmallIntegerField(null=True, blank=True, editable=False)
    number_sequence = models.PositiveIntegerField(null=True, blank=True, editable=False)
    status = models.CharField(
        max_length=20, choices=InvoiceStatus.choices, default=InvoiceStatus.DRAFT, db_index=True
    )
    bill_to_name = models.CharField("Name", max_length=200)
    bill_to_organisation = models.CharField("Organisation", max_length=200, blank=True)
    bill_to_email = models.EmailField("Email", blank=True)
    bill_to_address = models.TextField("Address", blank=True)
    opportunity = models.ForeignKey(
        "aidata.Opportunity", null=True, blank=True, on_delete=models.SET_NULL, related_name="invoices"
    )
    issue_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True, db_index=True)
    currency = models.CharField(max_length=3, default="GBP", editable=False)
    notes = models.TextField(
        "Notes and terms", blank=True, help_text="Printed on the invoice, under the totals."
    )
    # Snapshots taken at issue. Drafts compute them live from the lines and the settings.
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"), editable=False)
    # The seller's VAT number at issue; blank when Vitalos was not VAT registered (no VAT line, no VAT claim).
    vat_number = models.CharField(max_length=40, blank=True, editable=False)
    subtotal_pence = models.BigIntegerField(default=0, editable=False)
    vat_pence = models.BigIntegerField(default=0, editable=False)
    total_pence = models.BigIntegerField(default=0, editable=False)
    amount_paid_pence = models.BigIntegerField(default=0, editable=False)
    balance_due_pence = models.BigIntegerField(default=0, editable=False)
    # Customer-facing proof of possession for vitalos.co.uk/pay (8 characters, no 0/O/1/I/L).
    payment_code = models.CharField(max_length=8, blank=True, editable=False)
    stripe_payment_link_id = models.CharField(max_length=255, blank=True, editable=False)
    stripe_payment_link_url = models.URLField(max_length=500, blank=True, editable=False)
    stripe_payment_link_amount_pence = models.BigIntegerField(null=True, blank=True, editable=False)
    stripe_payment_link_active = models.BooleanField(default=False, editable=False)
    issued_at = models.DateTimeField(null=True, blank=True, editable=False)
    paid_at = models.DateTimeField(null=True, blank=True, editable=False)
    voided_at = models.DateTimeField(null=True, blank=True, editable=False)
    void_reason = models.TextField(blank=True, editable=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["number_year", "number_sequence"], name="billing_invoice_year_sequence_unique"
            ),
        ]

    def __str__(self):
        return self.display_number

    def get_absolute_url(self):
        return reverse("billing:invoice", args=[self.ref])

    @property
    def ref(self) -> str:
        """URL reference: the number once issued, ``draft-<id>`` before."""
        return self.number or f"draft-{self.pk}"

    @property
    def display_number(self) -> str:
        return self.number or "Draft"

    @property
    def is_draft(self) -> bool:
        return self.status == InvoiceStatus.DRAFT

    @property
    def is_open(self) -> bool:
        return self.status in OPEN_STATUSES

    @property
    def payment_code_display(self) -> str:
        code = self.payment_code
        return f"{code[:4]}-{code[4:]}" if len(code) == 8 else code

    @property
    def is_overdue(self) -> bool:
        return self.is_open and self.due_date is not None and self.due_date < timezone.localdate()


class InvoiceLine(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    position = models.PositiveSmallIntegerField(default=0)
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=Decimal("1"),
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    unit_price_pence = models.BigIntegerField(validators=[MinValueValidator(0)])
    # quantity × unit price, ROUND_HALF_UP to the penny (money.line_total_pence).
    line_total_pence = models.BigIntegerField(default=0, editable=False)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return self.description[:60]


class PaymentMethod(models.TextChoices):
    STRIPE_PAYMENT_LINK = "stripe_payment_link", "Stripe payment link"
    STRIPE_CHECKOUT = "stripe_checkout", "Stripe Checkout (vitalos.co.uk/pay)"
    BANK_TRANSFER = "bank_transfer", "Bank transfer"
    OTHER = "other", "Other"


#: Methods a person may record by hand. Stripe payments arrive only from Stripe.
MANUAL_METHODS = (PaymentMethod.BANK_TRANSFER, PaymentMethod.OTHER)


class PaymentStatus(models.TextChoices):
    SUCCEEDED = "succeeded", "Succeeded"
    REFUNDED = "refunded", "Refunded"


class Payment(models.Model):
    # Null while unmatched: a Stripe payment that names no known invoice waits for manual linking.
    invoice = models.ForeignKey(
        Invoice, null=True, blank=True, on_delete=models.SET_NULL, related_name="payments"
    )
    amount_pence = models.BigIntegerField(validators=[MinValueValidator(1)])
    amount_refunded_pence = models.BigIntegerField(default=0)
    currency = models.CharField(max_length=3, default="GBP")
    method = models.CharField(max_length=24, choices=PaymentMethod.choices)
    status = models.CharField(max_length=12, choices=PaymentStatus.choices, default=PaymentStatus.SUCCEEDED)
    stripe_checkout_session_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, db_index=True)
    # The invoice number Stripe reported (metadata), kept even when it matched nothing.
    reference = models.CharField(max_length=60, blank=True)
    payer_email = models.EmailField(blank=True)
    received_at = models.DateTimeField(default=timezone.now)
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-received_at", "-id"]

    def __str__(self):
        return f"Payment {self.pk}"

    @property
    def net_pence(self) -> int:
        return max(0, self.amount_pence - self.amount_refunded_pence)

    @property
    def is_stripe(self) -> bool:
        return self.method in (PaymentMethod.STRIPE_PAYMENT_LINK, PaymentMethod.STRIPE_CHECKOUT)
