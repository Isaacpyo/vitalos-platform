from django import forms

from apps.core.forms import StyledFormMixin

from . import selectors
from .models import BudgetSettings, CostEntry, OfferPrice, Opportunity, Stage
from .scoring import CRITERIA, MAX_CRITERION

DATE = {"type": "date"}


def date_input() -> forms.DateInput:
    """A native date picker. It only shows values in ISO format, whatever the locale's input format."""
    return forms.DateInput(format="%Y-%m-%d", attrs=DATE)


class OpportunityForm(StyledFormMixin, forms.ModelForm):
    """The details an owner edits. Stage, scores and the signed-scope reference have their own forms."""

    class Meta:
        model = Opportunity
        fields = (
            "title",
            "organisation",
            "sector",
            "source",
            "offer",
            "owner",
            "contact_name",
            "contact_email",
            "contact_role",
            "website_reference",
            "next_action",
            "next_action_due",
            "discovery_date",
            "decision_due",
            "timeframe",
            "budget_band",
            "estimated_value",
            "problem_summary",
            "current_tools",
            "desired_outcome",
            "customer_summary",
            "internal_notes",
        )
        labels = {
            "estimated_value": "Estimated value (GBP, estimate)",
            "next_action_due": "Next action due",
            "website_reference": "Website reference",
            "customer_summary": "Customer-visible summary",
            "internal_notes": "Internal notes",
            "budget_band": "Budget band (enquirer's estimate)",
        }
        help_texts = {
            "estimated_value": "An internal estimate, not a quote. Left blank, it takes the offer's proposed price.",
            "customer_summary": "May be shared with the customer. Keep internal views out of it.",
            "internal_notes": "Internal only. Never shared with the customer.",
            "website_reference": "The VIT-… reference from the website, if any.",
        }
        widgets = {
            "next_action_due": date_input(),
            "discovery_date": date_input(),
            "decision_due": date_input(),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["owner"].queryset = selectors.owners()
        self.fields["owner"].label_from_instance = lambda user: user.email
        self.fields["owner"].empty_label = "No owner"
        for name in (
            "problem_summary",
            "current_tools",
            "desired_outcome",
            "customer_summary",
            "internal_notes",
        ):
            if name in self.fields:
                self.fields[name].widget.attrs["rows"] = 4


class NewOpportunityForm(OpportunityForm):
    class Meta(OpportunityForm.Meta):
        fields = (
            "title",
            "organisation",
            "sector",
            "source",
            "offer",
            "owner",
            "estimated_value",
            "contact_name",
            "contact_role",
            "contact_email",
            "next_action",
            "next_action_due",
            "problem_summary",
        )


SCORE_CHOICES = [("", "Not scored"), *[(str(n), str(n)) for n in range(MAX_CRITERION + 1)]]


def _score_field(criterion) -> forms.TypedChoiceField:
    return forms.TypedChoiceField(
        choices=SCORE_CHOICES,
        coerce=int,
        empty_value=None,
        required=False,
        label=f"{criterion.label} ({criterion.weight}%)",
    )


# The six criteria as declared fields, in scorecard order.
_ScoreFields = type("_ScoreFields", (forms.Form,), {c.field: _score_field(c) for c in CRITERIA})


class ScorecardForm(StyledFormMixin, _ScoreFields):
    risk_override = forms.BooleanField(required=False, label="Risk override: blocked whatever the score")
    risk_reason = forms.CharField(
        required=False, label="Risk reason", max_length=2000, widget=forms.Textarea(attrs={"rows": 2})
    )

    def clean(self):
        data = super().clean()
        if data.get("risk_override") and not (data.get("risk_reason") or "").strip():
            self.add_error("risk_reason", "Give the reason for the risk override.")
        return data

    def scores(self) -> dict:
        return {criterion.field: self.cleaned_data.get(criterion.field) for criterion in CRITERIA}


class StageForm(StyledFormMixin, forms.Form):
    stage = forms.ChoiceField(choices=Stage.choices, label="Move to")
    reason = forms.CharField(
        required=False,
        max_length=2000,
        label="Reason",
        help_text="Required for Won, Lost, On hold and reopening.",
        widget=forms.Textarea(attrs={"rows": 2}),
    )
    signed_scope_reference = forms.CharField(
        required=False,
        max_length=200,
        label="Signed scope reference",
        help_text="Required for Won. Type the reference of the signed scope; it is never filled in for you.",
    )

    def __init__(self, *args, allowed=(), **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["stage"].choices = [(value, label) for value, label in Stage.choices if value in allowed]


class NoteForm(StyledFormMixin, forms.Form):
    body = forms.CharField(
        label="Internal note",
        max_length=10_000,
        widget=forms.Textarea(attrs={"rows": 3}),
        help_text="Internal only. Never shared with the customer.",
    )


class OfferPriceForm(StyledFormMixin, forms.ModelForm):
    class Meta:
        model = OfferPrice
        fields = ("name", "price", "basis", "status", "notes")
        labels = {"price": "Proposed price (GBP)"}


class BudgetSettingsForm(StyledFormMixin, forms.ModelForm):
    class Meta:
        model = BudgetSettings
        fields = (
            "overall_ceiling",
            "ceiling_outreach",
            "ceiling_ai_api",
            "ceiling_infrastructure",
            "ceiling_website",
            "ceiling_contracts",
            "ceiling_contingency",
        )
        labels = {
            "overall_ceiling": "Overall ceiling (GBP)",
            "ceiling_outreach": "Outreach and acquisition",
            "ceiling_ai_api": "AI API and prototyping",
            "ceiling_infrastructure": "Infrastructure and engineering",
            "ceiling_website": "Website and presence",
            "ceiling_contracts": "Contracts and admin",
            "ceiling_contingency": "Contingency",
        }


class CostEntryForm(StyledFormMixin, forms.ModelForm):
    class Meta:
        model = CostEntry
        fields = (
            "date",
            "category",
            "supplier",
            "description",
            "amount",
            "kind",
            "recurrence",
            "owner",
            "evidence_link",
        )
        labels = {"amount": "Amount (GBP)", "evidence_link": "Evidence link (optional)"}
        help_texts = {
            "amount": "For a recurring commitment, the amount per period. It counts for 12 months.",
            "evidence_link": "An invoice or receipt in a private store. Never paste card details.",
        }
        widgets = {"date": date_input()}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["owner"].queryset = selectors.owners()
        self.fields["owner"].label_from_instance = lambda user: user.email
        self.fields["owner"].empty_label = "No owner"
