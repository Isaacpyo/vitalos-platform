from datetime import datetime

from django import forms
from django.contrib.auth import get_user_model
from django.utils.dateparse import parse_datetime

from apps.content_sync import formatting
from apps.content_sync.choices import Practice
from apps.core.forms import INPUT, StyledFormMixin

from . import access
from .models import (
    ApplicationStage,
    ApplyMode,
    EmploymentType,
    Level,
    Role,
    SalaryPeriod,
    Sponsorship,
    WorkModel,
)
from .services import CURRENCIES

MD = {"rows": 6, "class": INPUT + " font-mono text-[13px] leading-6"}


def _local_input(value) -> str:
    return formatting.london(value).strftime("%Y-%m-%dT%H:%M") if value else ""


class NewRoleForm(StyledFormMixin, forms.Form):
    title = forms.CharField(max_length=200)


class RoleForm(StyledFormMixin, forms.Form):
    """The role working copy, in the brief's sections (7.4)."""

    title = forms.CharField(max_length=200, required=False)
    slug = forms.CharField(max_length=80, required=False)
    practice = forms.ChoiceField(choices=[("", "Choose")] + Practice.choices, required=False)
    level = forms.ChoiceField(choices=[("", "Not set")] + Level.choices, required=False)
    show_level = forms.BooleanField(label="Show the level on the website", required=False)
    summary = forms.CharField(
        max_length=220, required=False, widget=forms.Textarea(attrs={"rows": 3, "maxlength": 220})
    )
    location_text = forms.CharField(label="Location", max_length=120, required=False)
    work_model = forms.ChoiceField(
        label="Work model", choices=[("", "Choose")] + WorkModel.choices, required=False
    )
    employment_type = forms.ChoiceField(
        label="Employment type", choices=[("", "Choose")] + EmploymentType.choices, required=False
    )
    sponsorship = forms.ChoiceField(label="Visa sponsorship", choices=Sponsorship.choices)
    show_salary = forms.BooleanField(label="Show the salary on the website", required=False)
    salary_min = forms.IntegerField(label="Minimum", min_value=0, required=False)
    salary_max = forms.IntegerField(label="Maximum", min_value=0, required=False)
    salary_currency = forms.ChoiceField(label="Currency", choices=[(c, c) for c in CURRENCIES])
    salary_period = forms.ChoiceField(label="Per", choices=SalaryPeriod.choices)
    about_md = forms.CharField(
        label="About the role", required=False, max_length=20000, widget=forms.Textarea(attrs=MD)
    )
    responsibilities_md = forms.CharField(
        label="What you'll do", required=False, max_length=20000, widget=forms.Textarea(attrs=MD)
    )
    requirements_md = forms.CharField(
        label="What you'll bring", required=False, max_length=20000, widget=forms.Textarea(attrs=MD)
    )
    nice_to_have_md = forms.CharField(
        label="Nice to have", required=False, max_length=20000, widget=forms.Textarea(attrs=MD)
    )
    process_md = forms.CharField(
        label="How we hire (empty uses the careers default)",
        required=False,
        max_length=20000,
        widget=forms.Textarea(attrs=MD),
    )
    apply_mode = forms.ChoiceField(label="Applications", choices=ApplyMode.choices)
    external_apply_url = forms.CharField(label="External application URL", max_length=500, required=False)
    closes_at = forms.CharField(
        label="Closing date and time (Europe/London)",
        required=False,
        widget=forms.DateTimeInput(attrs={"type": "datetime-local"}),
    )
    show_on_home = forms.BooleanField(label="Show on the homepage first", required=False)
    sort = forms.IntegerField(label="Sort order", required=False, initial=0)
    hiring_manager = forms.ModelChoiceField(
        label="Hiring manager", queryset=None, required=False, empty_label="Not set"
    )
    updated_at = forms.CharField(required=False, widget=forms.HiddenInput)

    def __init__(self, *args, role: Role, **kwargs):
        super().__init__(*args, **kwargs)
        self.role = role
        users = get_user_model().objects.filter(is_active=True).order_by("email")
        self.fields["hiring_manager"].queryset = users
        self.fields["hiring_manager"].widget.attrs.setdefault("class", INPUT)
        for name in ("about_md", "responsibilities_md", "requirements_md", "nice_to_have_md", "process_md"):
            self.fields[name].widget.attrs.update(MD)
        if not self.is_bound:
            self.initial.update({name: getattr(role, name) for name in self.fields if hasattr(role, name)})
            self.initial["hiring_manager"] = role.hiring_manager_id
            self.initial["closes_at"] = _local_input(role.closes_at)
            self.initial["updated_at"] = role.updated_at.isoformat()

    def clean_closes_at(self):
        value = (self.cleaned_data.get("closes_at") or "").strip()
        if not value:
            return None
        try:
            naive = datetime.strptime(value, "%Y-%m-%dT%H:%M")
        except ValueError:
            raise forms.ValidationError("Enter a date and time.") from None
        return naive.replace(tzinfo=formatting.LONDON)

    def working_data(self) -> dict:
        data = dict(self.cleaned_data)
        data.pop("updated_at", None)
        for name in ("title", "slug", "summary", "location_text", "external_apply_url"):
            data[name] = (data.get(name) or "").strip()
        data["sort"] = data.get("sort") or 0
        return data

    def expected_updated_at(self):
        return parse_datetime(self.cleaned_data.get("updated_at") or "")


class StageForm(forms.Form):
    stage = forms.ChoiceField(choices=ApplicationStage.choices)


class NoteForm(StyledFormMixin, forms.Form):
    body = forms.CharField(label="Internal note", max_length=5000, widget=forms.Textarea(attrs={"rows": 3}))


def recipient_choices():
    users = get_user_model().objects.filter(is_active=True).order_by("email")
    return [
        (str(user.pk), f"{user.display_label} ({user.email})")
        for user in users
        if access.can_view_applications(user)
    ]


class CareersSettingsForm(StyledFormMixin, forms.Form):
    heading = forms.CharField(max_length=200)
    intro = forms.CharField(max_length=1000, widget=forms.Textarea())
    values = forms.CharField(label="Values (one per line)", required=False, widget=forms.Textarea())
    statements = forms.CharField(
        label="How we work statements (one per line)", required=False, widget=forms.Textarea()
    )
    benefits = forms.CharField(
        label="Benefits (Markdown; hidden when empty)",
        required=False,
        max_length=20000,
        widget=forms.Textarea(),
    )
    process = forms.CharField(
        label="Default hiring process (Markdown; hidden when empty)",
        required=False,
        max_length=20000,
        widget=forms.Textarea(),
    )
    salary_policy = forms.CharField(
        label="Salary policy (Markdown; hidden when empty)",
        required=False,
        max_length=20000,
        widget=forms.Textarea(),
    )
    equal_opportunities = forms.CharField(
        label="Equal opportunities statement (hidden when empty; needs owner approval)",
        required=False,
        max_length=20000,
        widget=forms.Textarea(),
    )
    empty_state = forms.CharField(label="No open roles message", max_length=500, widget=forms.Textarea())
    associates_line = forms.CharField(label="Associates line", max_length=500, widget=forms.Textarea())
    associates_line_enabled = forms.BooleanField(
        label="Show the associates line (needs CAR-01 confirmation)", required=False
    )
    speculative_applications_enabled = forms.BooleanField(
        label="Accept speculative applications (needs CAR-01 confirmation)", required=False
    )
    notification_recipients = forms.MultipleChoiceField(
        label="Who hears about new applications (none chosen: every super admin)",
        required=False,
        widget=forms.CheckboxSelectMultiple,
    )
    retention_months = forms.IntegerField(
        label="Retention (months after the decision or closing)", min_value=1, max_value=36
    )
    privacy_notice_url = forms.CharField(label="Candidate privacy notice URL", required=False, max_length=300)
    privacy_notice_version = forms.CharField(label="Privacy notice version", required=False, max_length=40)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["notification_recipients"].choices = recipient_choices()
        for name in ("values", "statements"):
            self.fields[name].widget.attrs["rows"] = 6

    @staticmethod
    def initial_from(config: dict) -> dict:
        data = dict(config)
        data["values"] = "\n".join(config["values"])
        data["statements"] = "\n".join(config["statements"])
        data["notification_recipients"] = [str(pk) for pk in config["notification_recipients"]]
        return data


class CandidateEmailsForm(StyledFormMixin, forms.Form):
    email_receipt_subject = forms.CharField(label="Receipt: subject", max_length=200)
    email_receipt_body = forms.CharField(label="Receipt: text", max_length=5000, widget=forms.Textarea())
    email_rejection_subject = forms.CharField(label="Rejection: subject", max_length=200)
    email_rejection_body = forms.CharField(label="Rejection: text", max_length=5000, widget=forms.Textarea())
    email_invitation_subject = forms.CharField(label="Invitation to talk: subject", max_length=200)
    email_invitation_body = forms.CharField(
        label="Invitation to talk: text", max_length=5000, widget=forms.Textarea()
    )


class HomeCareersForm(StyledFormMixin, forms.Form):
    enabled = forms.BooleanField(label="Show the Careers section on the homepage", required=False)
    heading = forms.CharField(max_length=200)
    intro = forms.CharField(max_length=500, widget=forms.Textarea())
    count = forms.TypedChoiceField(
        label="Roles shown", choices=[(n, str(n)) for n in range(1, 6)], coerce=int
    )
    when_no_roles = forms.ChoiceField(
        label="When no roles are open",
        choices=[("hide", "Hide the section"), ("show_message", "Show the no open roles message")],
    )
