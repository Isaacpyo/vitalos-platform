from decimal import Decimal

from django import forms
from django.utils import timezone

from apps.core.forms import StyledFormMixin

from . import money, selectors
from .models import MANUAL_METHODS, BillingSettings, Invoice, PaymentMethod

MAX_AMOUNT = Decimal("1000000")


class BillingSettingsForm(StyledFormMixin, forms.ModelForm):
    class Meta:
        model = BillingSettings
        fields = (
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
        labels = {"invoice_prefix": "Invoice number prefix", "footer_note": "Footer note"}
        help_texts = {
            "invoice_prefix": "Numbers look like INV-2026-0001. Changing it affects invoices issued from now on.",
            "footer_note": "Printed at the foot of every invoice.",
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["registered_address"].widget.attrs["rows"] = 5
        self.fields["bank_details"].widget.attrs["rows"] = 4
        self.fields["footer_note"].widget.attrs["rows"] = 2

    def clean(self):
        data = super().clean()
        if data.get("vat_registered") and not (data.get("vat_number") or "").strip():
            self.add_error("vat_number", "Enter the VAT number, or untick VAT registered.")
        return data


class InvoiceForm(StyledFormMixin, forms.ModelForm):
    class Meta:
        model = Invoice
        fields = (
            "bill_to_name",
            "bill_to_organisation",
            "bill_to_email",
            "bill_to_address",
            "notes",
        )
        labels = {
            "bill_to_name": "Bill to: name",
            "bill_to_organisation": "Organisation",
            "bill_to_email": "Email",
            "bill_to_address": "Postal address",
        }
        help_texts = {
            "bill_to_email": "Pre-fills the card payment form. Vitalos never emails the invoice for you."
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["bill_to_address"].widget.attrs["rows"] = 4
        self.fields["notes"].widget.attrs["rows"] = 3


class LineForm(StyledFormMixin, forms.Form):
    description = forms.CharField(max_length=500, required=False, widget=forms.Textarea)
    quantity = forms.DecimalField(
        max_digits=10, decimal_places=3, min_value=Decimal("0.001"), initial=Decimal("1"), required=False
    )
    unit_price = forms.DecimalField(
        label="Unit price (£)", max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["description"].widget.attrs.update(
            {"placeholder": "What was delivered (a second line prints as detail)", "rows": 2}
        )
        self.fields["quantity"].widget.attrs.update({"inputmode": "decimal", "step": "any"})
        self.fields["unit_price"].widget.attrs.update(
            {"inputmode": "decimal", "step": "0.01", "placeholder": "0.00"}
        )

    def clean(self):
        data = super().clean()
        if self.cleaned_data.get("DELETE"):
            return data
        description = (data.get("description") or "").strip()
        has_numbers = data.get("unit_price") is not None
        if not description and not has_numbers:
            return data  # An empty row: ignored.
        if not description:
            self.add_error("description", "Describe this line.")
        if data.get("unit_price") is None:
            self.add_error("unit_price", "Enter a unit price.")
        elif data["unit_price"] > MAX_AMOUNT:
            self.add_error("unit_price", "That is more than this form accepts.")
        if data.get("quantity") is None:
            data["quantity"] = Decimal("1")
        return data

    def line(self) -> dict | None:
        data = getattr(self, "cleaned_data", None) or {}
        if data.get("DELETE") or not (data.get("description") or "").strip():
            return None
        return {
            "description": data["description"].strip(),
            "quantity": data.get("quantity") or Decimal("1"),
            "unit_price_pence": money.pounds_to_pence(data["unit_price"]),
        }


class BaseLineFormSet(forms.BaseFormSet):
    def lines(self) -> list[dict]:
        return [line for form in self.forms if (line := form.line()) is not None]

    def clean(self):
        super().clean()
        if any(self.errors):
            return
        if not self.lines():
            raise forms.ValidationError("Add at least one line.")


LineFormSet = forms.formset_factory(
    LineForm, formset=BaseLineFormSet, extra=2, can_delete=True, max_num=50, validate_max=True
)


def initial_lines(invoice: Invoice) -> list[dict]:
    return [
        {
            "description": line.description,
            "quantity": money.format_quantity(line.quantity),
            "unit_price": money.pence_to_pounds(line.unit_price_pence),
        }
        for line in invoice.lines.all()
    ]


class VoidForm(StyledFormMixin, forms.Form):
    reason = forms.CharField(widget=forms.Textarea, max_length=2000, label="Reason for voiding")


class PaymentForm(StyledFormMixin, forms.Form):
    """A bank transfer (or other payment) recorded by hand."""

    invoice = forms.ModelChoiceField(
        queryset=Invoice.objects.none(), required=False, empty_label="Not linked yet"
    )
    amount = forms.DecimalField(
        label="Amount (£)", max_digits=12, decimal_places=2, min_value=Decimal("0.01"), max_value=MAX_AMOUNT
    )
    method = forms.ChoiceField(
        choices=[(value, label) for value, label in PaymentMethod.choices if value in MANUAL_METHODS],
        initial=PaymentMethod.BANK_TRANSFER,
    )
    received_on = forms.DateField(
        label="Received on", widget=forms.DateInput(format="%Y-%m-%d", attrs={"type": "date"})
    )
    payer_email = forms.EmailField(label="Payer email (optional)", required=False)
    note = forms.CharField(
        widget=forms.Textarea, required=False, max_length=2000, help_text="For example the bank reference."
    )

    def __init__(self, *args, invoice=None, **kwargs):
        kwargs.setdefault("initial", {})
        kwargs["initial"].setdefault("received_on", timezone.localdate())
        if invoice is not None:
            kwargs["initial"].setdefault("invoice", invoice.pk)
            kwargs["initial"].setdefault("amount", money.pence_to_pounds(max(invoice.balance_due_pence, 0)))
        super().__init__(*args, **kwargs)
        self.fields["invoice"].queryset = selectors.linkable_invoices()
        self.fields["invoice"].label_from_instance = lambda item: (
            f"{item.number} · {item.bill_to_organisation or item.bill_to_name} · "
            f"{money.format_gbp(item.balance_due_pence)} due"
        )
        self.fields["note"].widget.attrs["rows"] = 2

    def clean_received_on(self):
        value = self.cleaned_data["received_on"]
        if value > timezone.localdate():
            raise forms.ValidationError("A payment cannot be received in the future.")
        return value


class LinkPaymentForm(StyledFormMixin, forms.Form):
    invoice = forms.ModelChoiceField(queryset=Invoice.objects.none(), empty_label="Choose an invoice")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["invoice"].queryset = selectors.linkable_invoices()
        self.fields["invoice"].label_from_instance = lambda item: (
            f"{item.number} · {item.bill_to_organisation or item.bill_to_name}"
        )
