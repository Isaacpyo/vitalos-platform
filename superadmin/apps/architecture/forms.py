from django import forms
from django.contrib.auth import get_user_model

from apps.core.forms import StyledFormMixin
from apps.core.models import BusinessMode

from .models import (
    KPI,
    Company,
    Decision,
    KPIValue,
    Offer,
    Practice,
    Project,
    ServiceLine,
    Solution,
    TeamMember,
)


class BusinessModesField(forms.MultipleChoiceField):
    widget = forms.CheckboxSelectMultiple

    def __init__(self, **kwargs):
        super().__init__(choices=BusinessMode.choices, required=False, **kwargs)


class DateInput(forms.DateInput):
    input_type = "date"

    def __init__(self, **kwargs):
        super().__init__(format="%Y-%m-%d", **kwargs)


class CompanyForm(StyledFormMixin, forms.ModelForm):
    business_modes = BusinessModesField()

    class Meta:
        model = Company
        fields = ["name", "tagline", "vision", "mission", "business_modes", "classification"]


class ServiceLineForm(StyledFormMixin, forms.ModelForm):
    business_modes = BusinessModesField()
    colour = forms.CharField(widget=forms.TextInput(attrs={"type": "color"}), initial="#2457FF")

    class Meta:
        model = ServiceLine
        fields = ["name", "slug", "tagline", "business_modes", "colour", "icon", "owner", "classification"]
        help_texts = {"slug": "Used in the dashboard URL, e.g. /s/consulting/."}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["owner"].queryset = get_user_model().objects.filter(is_active=True)
        self.fields["slug"].required = False

    def clean_colour(self):
        return self.cleaned_data["colour"].upper()


class OfferingForm(StyledFormMixin, forms.ModelForm):
    class Meta:
        fields = ["name", "slug", "summary", "status", "maturity", "order", "classification"]
        help_texts = {"slug": "Leave blank to generate from the name."}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["slug"].required = False


class PracticeForm(OfferingForm):
    class Meta(OfferingForm.Meta):
        model = Practice


class SolutionForm(OfferingForm):
    class Meta(OfferingForm.Meta):
        model = Solution
        fields = ["practice", *OfferingForm.Meta.fields]

    def __init__(self, *args, service_line=None, **kwargs):
        super().__init__(*args, **kwargs)
        if service_line is not None:
            self.fields["practice"].queryset = service_line.practices.active()


class OfferForm(OfferingForm):
    class Meta(OfferingForm.Meta):
        model = Offer
        fields = ["solution", *OfferingForm.Meta.fields]

    def __init__(self, *args, service_line=None, **kwargs):
        super().__init__(*args, **kwargs)
        if service_line is not None:
            self.fields["solution"].queryset = Solution.objects.active().filter(
                practice__service_line=service_line
            )


class TeamMemberForm(StyledFormMixin, forms.ModelForm):
    class Meta:
        model = TeamMember
        fields = ["name", "role_title", "email", "user", "service_lines", "classification"]
        widgets = {"service_lines": forms.CheckboxSelectMultiple}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["service_lines"].queryset = ServiceLine.objects.active()
        self.fields["user"].queryset = get_user_model().objects.filter(is_active=True)
        self.fields[
            "user"
        ].help_text = "Link to a login so the person can lead projects and edit their lines."


class ProjectForm(StyledFormMixin, forms.ModelForm):
    class Meta:
        model = Project
        fields = ["name", "client", "status", "start_date", "end_date", "lead", "value", "classification"]
        widgets = {"start_date": DateInput(), "end_date": DateInput()}

    def __init__(self, *args, service_line=None, **kwargs):
        super().__init__(*args, **kwargs)
        members = TeamMember.objects.active()
        if service_line is not None:
            members = members.filter(service_lines=service_line)
        self.fields["lead"].queryset = members


class ProjectStatusForm(forms.Form):
    status = forms.ChoiceField(choices=Project.Status.choices)


class KPIForm(StyledFormMixin, forms.ModelForm):
    class Meta:
        model = KPI
        fields = ["name", "unit", "target", "direction", "is_headline", "order", "classification"]

    def __init__(self, *args, service_line=None, **kwargs):
        self.service_line = service_line
        super().__init__(*args, **kwargs)

    def clean_name(self):
        name = self.cleaned_data["name"]
        line = self.service_line or getattr(self.instance, "service_line", None)
        clash = KPI.objects.filter(service_line=line, name__iexact=name).exclude(pk=self.instance.pk)
        if line is not None and clash.exists():
            raise forms.ValidationError("This service line already has a KPI with that name.")
        return name


class KPIValueForm(StyledFormMixin, forms.ModelForm):
    class Meta:
        model = KPIValue
        fields = ["date", "value"]
        widgets = {"date": DateInput()}


class DecisionForm(StyledFormMixin, forms.ModelForm):
    notion_url = forms.URLField(label="Notion URL", required=False, assume_scheme="https")

    class Meta:
        model = Decision
        fields = ["title", "date", "rationale", "notion_url", "classification"]
        widgets = {"date": DateInput()}


class CsvImportForm(StyledFormMixin, forms.Form):
    resource = forms.ChoiceField(label="Data set")
    file = forms.FileField(label="CSV file")
    dry_run = forms.BooleanField(
        label="Dry run (validate only, change nothing)", required=False, initial=True
    )

    def __init__(self, *args, resources=(), **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["resource"].choices = resources

    def clean_file(self):
        from django.conf import settings

        upload = self.cleaned_data["file"]
        if upload.size > settings.CSV_IMPORT_MAX_BYTES:
            raise forms.ValidationError("CSV files are limited to 2 MB.")
        if not upload.name.lower().endswith(".csv"):
            raise forms.ValidationError("Upload a .csv file.")
        return upload
