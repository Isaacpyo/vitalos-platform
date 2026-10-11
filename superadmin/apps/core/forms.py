from django import forms

INPUT = (
    "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm "
    "focus:border-vitalos-blue focus:outline-none focus:ring-2 focus:ring-vitalos-blue/30 "
    "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
)
CHECKBOX = "h-4 w-4 rounded border-slate-300 text-vitalos-blue focus:ring-vitalos-blue dark:border-slate-600"


class StyledFormMixin:
    """Apply consistent Tailwind classes so templates can render fields generically."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            widget = field.widget
            if isinstance(widget, forms.CheckboxSelectMultiple):
                widget.attrs.setdefault("class", CHECKBOX)
            elif isinstance(widget, forms.CheckboxInput):
                widget.attrs.setdefault("class", CHECKBOX)
            else:
                widget.attrs.setdefault("class", INPUT)
            if isinstance(widget, forms.Textarea):
                widget.attrs["rows"] = 3
