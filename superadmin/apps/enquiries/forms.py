from django import forms

from apps.core.forms import INPUT, StyledFormMixin

from .models import CannedResponse, Enquiry, InboxSettings, NotificationPreference


class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True


class MultipleFileField(forms.FileField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("widget", MultipleFileInput())
        super().__init__(*args, **kwargs)

    def clean(self, data, initial=None):
        single = super().clean
        if isinstance(data, list | tuple):
            return [single(item, initial) for item in data]
        return [single(data, initial)] if data else []


class ReplyForm(StyledFormMixin, forms.Form):
    body_text = forms.CharField(
        label="Reply",
        max_length=20000,
        widget=forms.Textarea(attrs={"rows": 6, "data-composer-body": True}),
    )
    files = MultipleFileField(label="Attachments", required=False, help_text="Up to 25 MB in total.")
    resolve = forms.BooleanField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["body_text"].widget.attrs["rows"] = 6


class NoteForm(StyledFormMixin, forms.Form):
    body = forms.CharField(
        label="Internal note",
        max_length=10000,
        widget=forms.Textarea(attrs={"rows": 4, "data-composer-body": True}),
        help_text="Only the team sees notes. They are never emailed.",
    )


class StatusForm(forms.Form):
    status = forms.ChoiceField(choices=Enquiry.Status.choices)


class PriorityForm(forms.Form):
    priority = forms.ChoiceField(choices=Enquiry.Priority.choices)


class TagsForm(forms.Form):
    tags = forms.CharField(required=False, max_length=500)

    def clean_tags(self):
        names = [name.strip().lower() for name in self.cleaned_data["tags"].split(",")]
        return [name[:40] for name in names if name][:10]


class InboxSettingsForm(StyledFormMixin, forms.ModelForm):
    class Meta:
        model = InboxSettings
        fields = [
            "sla_first_response_hours",
            "signature",
            "retention_months",
            "spam_retention_days",
            "automated_senders",
        ]
        labels = {
            "sla_first_response_hours": "First-response target (working hours)",
            "retention_months": "Keep resolved enquiries for (months)",
            "spam_retention_days": "Keep spam for (days)",
            "automated_senders": "Booking and notification senders",
        }
        widgets = {
            "signature": forms.Textarea(attrs={"rows": 4}),
            "automated_senders": forms.Textarea(attrs={"rows": 4}),
        }


class CannedResponseForm(StyledFormMixin, forms.ModelForm):
    class Meta:
        model = CannedResponse
        fields = ["title", "body_text"]
        labels = {"body_text": "Text"}
        widgets = {"body_text": forms.Textarea(attrs={"rows": 5})}


class NotificationPreferencesForm(forms.Form):
    def __init__(self, *args, initial_modes=None, **kwargs):
        super().__init__(*args, **kwargs)
        for event, label in NotificationPreference.Event.choices:
            self.fields[event] = forms.ChoiceField(
                label=label,
                choices=NotificationPreference.Mode.choices,
                initial=(initial_modes or {}).get(event, NotificationPreference.Mode.INSTANT),
                widget=forms.Select(attrs={"class": INPUT}),
            )
