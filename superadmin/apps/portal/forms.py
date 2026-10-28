"""Forms. Customer forms carry the portal's own classes; staff forms reuse the Super Admin's styling."""

from __future__ import annotations

from django import forms
from django.contrib.auth import authenticate
from django.contrib.auth.forms import SetPasswordForm

from apps.accounts.roles import user_roles
from apps.core.forms import StyledFormMixin

from .models import (
    ItemKind,
    Journey,
    MilestoneStatus,
    Organisation,
    Party,
    ProjectStatus,
    Role,
    ServiceStatusReport,
)

# ---------------------------------------------------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------------------------------------------------


class PortalFormMixin:
    """Portal field classes (the portal stylesheet styles .p-input, .p-textarea, .p-check)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            widget = field.widget
            if isinstance(widget, forms.CheckboxInput):
                widget.attrs.setdefault("class", "p-check")
            elif isinstance(widget, forms.Textarea):
                widget.attrs.setdefault("class", "p-input p-textarea")
                widget.attrs.setdefault("rows", 4)
            elif isinstance(widget, forms.ClearableFileInput):
                widget.attrs.setdefault("class", "p-file")
            else:
                widget.attrs.setdefault("class", "p-input")


class PortalLoginForm(PortalFormMixin, forms.Form):
    email = forms.EmailField(widget=forms.EmailInput(attrs={"autocomplete": "username", "autofocus": True}))
    password = forms.CharField(
        strip=False, widget=forms.PasswordInput(attrs={"autocomplete": "current-password"})
    )

    invalid = "That email and password combination is not recognised."

    def __init__(self, request, *args, **kwargs):
        self.request = request
        self.user = None
        super().__init__(*args, **kwargs)

    def clean(self):
        email = (self.cleaned_data.get("email") or "").lower()
        password = self.cleaned_data.get("password")
        if email and password:
            # Passing the request lets django-axes count failures and enforce lockouts.
            user = authenticate(self.request, email=email, password=password)
            # Staff sign in through the Super Admin: answer exactly as for a wrong password.
            if user is None or not user.is_active or user_roles(user):
                raise forms.ValidationError(self.invalid, code="invalid_login")
            self.user = user
        return self.cleaned_data


class PortalSetPasswordForm(PortalFormMixin, SetPasswordForm):
    pass


class ConfirmExistingPasswordForm(PortalFormMixin, forms.Form):
    password = forms.CharField(
        label="Your current password",
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "current-password"}),
    )


class ForgotForm(PortalFormMixin, forms.Form):
    email = forms.EmailField(widget=forms.EmailInput(attrs={"autocomplete": "username", "autofocus": True}))


class OTPForm(PortalFormMixin, forms.Form):
    token = forms.CharField(
        label="6-digit code",
        max_length=8,
        widget=forms.TextInput(
            attrs={
                "autocomplete": "one-time-code",
                "inputmode": "numeric",
                "autofocus": True,
                "pattern": "[0-9 ]*",
            }
        ),
    )


class MessageForm(PortalFormMixin, forms.Form):
    body = forms.CharField(label="Your message", max_length=4000, widget=forms.Textarea(attrs={"rows": 4}))
    attachment = forms.FileField(label="Attach a file (optional)", required=False)


class AnswerForm(PortalFormMixin, forms.Form):
    body = forms.CharField(label="Your answer", max_length=4000, widget=forms.Textarea(attrs={"rows": 5}))


class CommentForm(PortalFormMixin, forms.Form):
    comment = forms.CharField(
        label="Comment", max_length=2000, required=False, widget=forms.Textarea(attrs={"rows": 3})
    )


class RequiredCommentForm(PortalFormMixin, forms.Form):
    comment = forms.CharField(
        label="What needs to change?", max_length=2000, widget=forms.Textarea(attrs={"rows": 4})
    )


class AcceptContractForm(PortalFormMixin, forms.Form):
    confirm = forms.BooleanField(label="I confirm the statement above", required=True)


class ChangeRequestForm(PortalFormMixin, forms.Form):
    title = forms.CharField(label="What would you like to change?", max_length=200)
    affects = forms.ChoiceField(
        label="What does it affect?",
        choices=[
            ("scope", "Scope (what is included)"),
            ("cost", "Cost"),
            ("dates", "Dates"),
            ("other", "Something else"),
        ],
    )
    description = forms.CharField(label="Details", max_length=4000, widget=forms.Textarea(attrs={"rows": 6}))


class UploadForm(PortalFormMixin, forms.Form):
    file = forms.FileField(label="File")
    title = forms.CharField(label="Title (optional)", max_length=200, required=False)
    challenge = forms.IntegerField(widget=forms.HiddenInput)
    project = forms.IntegerField(widget=forms.HiddenInput, required=False)
    file_id = forms.IntegerField(widget=forms.HiddenInput, required=False)


class PreferencesForm(PortalFormMixin, forms.Form):
    email_updates = forms.BooleanField(label="Published updates, messages and decisions", required=False)
    email_questions = forms.BooleanField(label="Questions for me", required=False)
    email_deliverables = forms.BooleanField(label="New deliverables", required=False)
    email_approvals = forms.BooleanField(label="Approval requests", required=False)


# ---------------------------------------------------------------------------------------------------------------------
# Staff (Super Admin)
# ---------------------------------------------------------------------------------------------------------------------


class OrganisationForm(StyledFormMixin, forms.Form):
    name = forms.CharField(max_length=200)
    is_synthetic = forms.BooleanField(required=False, label="Synthetic (made-up demonstration data)")


class InviteForm(StyledFormMixin, forms.Form):
    email = forms.EmailField()
    full_name = forms.CharField(max_length=150, required=False)
    role = forms.ChoiceField(choices=Role.choices, initial=Role.CONTRIBUTOR)


class RoleForm(StyledFormMixin, forms.Form):
    role = forms.ChoiceField(choices=Role.choices)


class LinkChallengeForm(StyledFormMixin, forms.Form):
    organisation = forms.ModelChoiceField(queryset=Organisation.objects.filter(is_active=True))
    title = forms.CharField(
        max_length=200,
        required=False,
        help_text="Shown to the customer. Leave blank to use the opportunity's title.",
    )


class ChallengeForm(StyledFormMixin, forms.Form):
    title = forms.CharField(max_length=200)
    submitted_problem = forms.CharField(
        label="The problem, as shown to the customer",
        required=False,
        widget=forms.Textarea(attrs={"rows": 5}),
    )
    submitted_outcome = forms.CharField(
        label="Desired outcome, as shown to the customer",
        required=False,
        widget=forms.Textarea(attrs={"rows": 4}),
    )
    journey_stage = forms.ChoiceField(choices=Journey.choices)
    status_note = forms.CharField(max_length=300, required=False, label="One-line status (customer-visible)")
    internal_notes = forms.CharField(
        required=False, widget=forms.Textarea(attrs={"rows": 3}), label="Internal notes (never shown)"
    )


class BriefForm(StyledFormMixin, forms.Form):
    summary = forms.CharField(max_length=300, required=False)
    change_note = forms.CharField(max_length=300, required=False, label="What changed since the last version")
    segments = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 10}),
        help_text="One segment per line, starting with its provenance: customer: (the customer's words), "
        "fact: (agreed fact) or ai: (an AI suggestion a person has reviewed).",
    )

    def clean_segments(self):
        out = []
        tags = {"customer": "customer_statement", "fact": "agreed_fact", "ai": "ai_suggestion"}
        for number, raw in enumerate(self.cleaned_data["segments"].splitlines(), start=1):
            line = raw.strip()
            if not line:
                continue
            tag, _, text = line.partition(":")
            if tag.strip().lower() not in tags or not text.strip():
                raise forms.ValidationError(
                    f"Line {number} must start with customer:, fact: or ai: and have text."
                )
            out.append(
                {"id": f"s{len(out) + 1}", "text": text.strip(), "provenance": tags[tag.strip().lower()]}
            )
        if not out:
            raise forms.ValidationError("Add at least one segment.")
        return out

    @staticmethod
    def initial_text(segments) -> str:
        short = {"customer_statement": "customer", "agreed_fact": "fact", "ai_suggestion": "ai"}
        return "\n".join(f"{short.get(s['provenance'], 'customer')}: {s['text']}" for s in segments)


class ProjectForm(StyledFormMixin, forms.Form):
    name = forms.CharField(max_length=200)
    summary = forms.CharField(required=False, widget=forms.Textarea(attrs={"rows": 3}))
    agreed_scope = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 5}),
        help_text="Change this only through the agreed change process. The customer cannot edit it.",
    )
    status = forms.ChoiceField(choices=ProjectStatus.choices)
    target_date = forms.DateField(required=False, widget=forms.DateInput(attrs={"type": "date"}))
    internal_notes = forms.CharField(
        required=False, widget=forms.Textarea(attrs={"rows": 3}), label="Internal notes (never shown)"
    )


class MilestoneForm(StyledFormMixin, forms.Form):
    title = forms.CharField(max_length=200)
    description = forms.CharField(max_length=500, required=False)
    status = forms.ChoiceField(choices=MilestoneStatus.choices)
    target_date = forms.DateField(required=False, widget=forms.DateInput(attrs={"type": "date"}))
    position = forms.IntegerField(min_value=0, initial=0)
    internal_notes = forms.CharField(
        required=False, widget=forms.Textarea(attrs={"rows": 2}), label="Internal notes (never shown)"
    )


class ItemForm(StyledFormMixin, forms.Form):
    kind = forms.ChoiceField(choices=ItemKind.choices)
    party = forms.ChoiceField(choices=Party.choices, label="Responsible")
    text = forms.CharField(max_length=500)
    due_date = forms.DateField(required=False, widget=forms.DateInput(attrs={"type": "date"}))
    is_done = forms.BooleanField(required=False)
    internal_notes = forms.CharField(
        required=False, widget=forms.Textarea(attrs={"rows": 2}), label="Internal notes (never shown)"
    )


class DeliverableForm(StyledFormMixin, forms.Form):
    title = forms.CharField(max_length=200)
    description = forms.CharField(max_length=500, required=False)
    milestone = forms.ModelChoiceField(queryset=None, required=False)
    internal_notes = forms.CharField(
        required=False, widget=forms.Textarea(attrs={"rows": 2}), label="Internal notes (never shown)"
    )

    def __init__(self, *args, project=None, **kwargs):
        super().__init__(*args, **kwargs)
        from .models import Milestone

        self.fields["milestone"].queryset = (
            Milestone.objects.filter(project=project) if project else Milestone.objects.none()
        )


class VersionForm(StyledFormMixin, forms.Form):
    summary = forms.CharField(max_length=300, required=False)
    body = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 8}),
        label="Preview text (shown to the customer once shared)",
    )
    file = forms.FileField(required=False, label="Attach a file (optional)")
    requires_approval = forms.BooleanField(required=False, initial=True)
    is_contractual = forms.BooleanField(
        required=False, label="Contractual document (an authorised signatory records acceptance)"
    )
    internal_notes = forms.CharField(
        required=False, widget=forms.Textarea(attrs={"rows": 2}), label="Internal notes (never shown)"
    )


class UpdateForm(StyledFormMixin, forms.Form):
    title = forms.CharField(max_length=200)
    body = forms.CharField(widget=forms.Textarea(attrs={"rows": 8}), max_length=8000)
    project = forms.ModelChoiceField(queryset=None, required=False, label="About project")
    internal_notes = forms.CharField(
        required=False, widget=forms.Textarea(attrs={"rows": 2}), label="Internal notes (never shown)"
    )

    def __init__(self, *args, challenge=None, **kwargs):
        super().__init__(*args, **kwargs)
        from .models import Project

        self.fields["project"].queryset = (
            Project.objects.filter(challenge=challenge) if challenge else Project.objects.none()
        )


class QuestionForm(StyledFormMixin, forms.Form):
    question = forms.CharField(max_length=400)
    detail = forms.CharField(required=False, widget=forms.Textarea(attrs={"rows": 3}))
    due_date = forms.DateField(required=False, widget=forms.DateInput(attrs={"type": "date"}))
    assigned_to = forms.ModelChoiceField(queryset=None, required=False, label="Customer owner (optional)")
    project = forms.ModelChoiceField(queryset=None, required=False)

    def __init__(self, *args, challenge=None, **kwargs):
        super().__init__(*args, **kwargs)
        from .models import Membership, Project

        members = Membership.objects.filter(
            organisation=challenge.organisation, is_active=True, accepted_at__isnull=False
        )
        self.fields["assigned_to"].queryset = members.select_related("user")
        self.fields["assigned_to"].label_from_instance = lambda m: f"{m.name} ({m.get_role_display()})"
        self.fields["project"].queryset = Project.objects.filter(challenge=challenge)


class StaffMessageForm(StyledFormMixin, forms.Form):
    body = forms.CharField(widget=forms.Textarea(attrs={"rows": 3}), max_length=4000)
    internal = forms.BooleanField(required=False, label="Internal note (never shown to the customer)")


class ChangeReviewForm(StyledFormMixin, forms.Form):
    to_status = forms.ChoiceField(
        choices=[("under_review", "Under review"), ("accepted", "Accepted"), ("declined", "Declined")]
    )
    response = forms.CharField(
        required=False, widget=forms.Textarea(attrs={"rows": 3}), label="Response the customer will see"
    )
    note = forms.CharField(
        required=False, widget=forms.Textarea(attrs={"rows": 2}), label="Internal note (never shown)"
    )


class ServiceForm(StyledFormMixin, forms.Form):
    name = forms.CharField(max_length=200)
    description = forms.CharField(max_length=500, required=False)
    project = forms.ModelChoiceField(queryset=None, required=False)
    internal_notes = forms.CharField(
        required=False, widget=forms.Textarea(attrs={"rows": 2}), label="Internal notes (never shown)"
    )

    def __init__(self, *args, organisation=None, **kwargs):
        super().__init__(*args, **kwargs)
        from .models import Project

        self.fields["project"].queryset = Project.objects.filter(challenge__organisation=organisation)


class StatusReportForm(StyledFormMixin, forms.Form):
    status = forms.ChoiceField(choices=ServiceStatusReport.Status.choices)
    summary = forms.CharField(max_length=500, required=False)


class StaffFileForm(StyledFormMixin, forms.Form):
    file = forms.FileField()
    title = forms.CharField(max_length=200, required=False)
    visibility = forms.ChoiceField(
        choices=[("internal", "Internal only"), ("customer", "Visible to the customer")], initial="internal"
    )
    retention_note = forms.CharField(max_length=300, required=False)
    project = forms.ModelChoiceField(queryset=None, required=False)

    def __init__(self, *args, challenge=None, **kwargs):
        super().__init__(*args, **kwargs)
        from .models import Project

        self.fields["project"].queryset = (
            Project.objects.filter(challenge=challenge) if challenge else Project.objects.none()
        )
