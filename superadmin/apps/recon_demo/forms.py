from django import forms

from apps.aicore.models import AiSettings

from . import samples

INPUT = (
    "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cobalt-600 "
    "focus:outline-none focus:ring-2 focus:ring-cobalt-600/30 dark:border-slate-700 dark:bg-slate-800"
)
MONO = INPUT + " font-mono text-xs leading-5"
CHECK = "mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-cobalt-600 focus:ring-cobalt-600"
# Generous form limit; the workflow itself rejects anything over 64 KB as UNSUPPORTED.
MAX_FIELD = 200_000


class NewRunForm(forms.Form):
    SOURCES = (("sample", "Built-in synthetic sample"), ("paste", "Paste text"))
    MODES = (
        ("off", "Rules only (deterministic parser)"),
        ("simulated", "Simulated model responses (built-in samples only)"),
        ("live", "Live model provider (when configured)"),
    )

    source = forms.ChoiceField(choices=SOURCES, initial="sample", widget=forms.RadioSelect)
    sample_key = forms.ChoiceField(
        required=False, choices=[("", "Choose a sample")] + [(s.key, s.title) for s in samples.SAMPLES]
    )
    statement = forms.CharField(
        required=False,
        max_length=MAX_FIELD,
        strip=False,
        widget=forms.Textarea(attrs={"rows": 12, "class": MONO, "spellcheck": "false"}),
    )
    ledger = forms.CharField(
        required=False,
        max_length=MAX_FIELD,
        strip=False,
        widget=forms.Textarea(attrs={"rows": 8, "class": MONO, "spellcheck": "false"}),
    )
    mode = forms.ChoiceField(choices=MODES, initial="off")
    synthetic_confirmed = forms.BooleanField(
        required=True,
        label="This is synthetic or explicitly authorised data",
        error_messages={"required": "Confirm that the data is synthetic or explicitly authorised."},
    )
    run_again = forms.BooleanField(required=False, widget=forms.HiddenInput)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["sample_key"].widget.attrs["class"] = INPUT
        self.fields["mode"].widget.attrs["class"] = INPUT
        self.fields["synthetic_confirmed"].widget.attrs["class"] = CHECK

    def clean(self):
        data = super().clean()
        if data.get("source") == "sample":
            sample = samples.get(data.get("sample_key") or "")
            if sample is None:
                self.add_error("sample_key", "Choose a sample.")
            elif data.get("mode") == "simulated" and not sample.has_script:
                self.add_error("mode", "This sample has no simulated model responses; choose Rules only.")
        elif data.get("mode") == "simulated":
            self.add_error("mode", "Simulated responses exist only for built-in samples.")
        return data


class ReviewDecisionForm(forms.Form):
    decision = forms.ChoiceField(choices=(("accept", "Accept"), ("correct", "Correct"), ("reject", "Reject")))
    note = forms.CharField(required=False, max_length=500)
    date = forms.CharField(required=False, max_length=20)
    reference = forms.CharField(required=False, max_length=64)
    type = forms.CharField(required=False, max_length=20)
    amount = forms.CharField(required=False, max_length=20)


class AiSettingsForm(forms.ModelForm):
    class Meta:
        model = AiSettings
        fields = ["enabled", "model_path_enabled", "daily_run_cap", "monthly_budget_gbp", "max_calls_per_run"]
        labels = {
            "enabled": "AI & Data enabled (kill switch)",
            "model_path_enabled": "Live model path",
            "daily_run_cap": "Daily model-run cap",
            "monthly_budget_gbp": "Monthly budget (GBP)",
            "max_calls_per_run": "Model calls per run",
        }
        help_texts = {"enabled": "Off blocks every demonstrator run and every model call."}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name in ("daily_run_cap", "monthly_budget_gbp", "max_calls_per_run"):
            self.fields[name].widget.attrs["class"] = INPUT
        for name in ("enabled", "model_path_enabled"):
            self.fields[name].widget.attrs["class"] = CHECK
