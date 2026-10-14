"""The template editor form. Blocks are posted as indexed fields (``block-0-type`` and so on)."""

from __future__ import annotations

from django import forms

from apps.core.forms import StyledFormMixin

from .models import Category, Kind, Status

BLOCK_CHOICES = (
    ("heading", "Heading"),
    ("text", "Text"),
    ("button", "Button"),
    ("badge", "Badges"),
    ("quote", "Quote"),
    ("details", "Details"),
    ("section", "Section title"),
    ("divider", "Divider"),
    ("signature", "Signature"),
)
BLOCK_LABELS = dict(BLOCK_CHOICES)
MAX_BLOCKS = 40


class TemplateForm(StyledFormMixin, forms.Form):
    name = forms.CharField(max_length=120)
    category = forms.ChoiceField(choices=Category.choices)
    kind = forms.ChoiceField(
        choices=Kind.choices,
        help_text="Outreach and marketing email gets a reason line and an unsubscribe link in the footer.",
    )
    status = forms.ChoiceField(choices=[(Status.DRAFT, "Draft"), (Status.ACTIVE, "Active")])
    description = forms.CharField(max_length=300, required=False, help_text="When to use this template.")
    header_label = forms.CharField(max_length=40, help_text="1 to 3 words in the header, e.g. Proposal.")
    subject = forms.CharField(max_length=200)
    preheader = forms.CharField(
        max_length=200, required=False, help_text="Inbox preview text. Add to the subject; do not repeat it."
    )
    reason = forms.CharField(
        label="Reason for contact",
        max_length=300,
        required=False,
        help_text="Required for outreach and marketing: why the recipient is getting this email.",
    )
    footer_notice = forms.CharField(
        max_length=300, required=False, help_text="Optional line at the top of the footer."
    )

    def clean(self):
        cleaned = super().clean()
        if cleaned.get("kind") in (Kind.OUTREACH, Kind.MARKETING) and not cleaned.get("reason", "").strip():
            self.add_error("reason", "Outreach and marketing email needs a reason for contact.")
        return cleaned


def _lines(value: str) -> list[str]:
    return [line.strip() for line in (value or "").replace("\r", "").split("\n") if line.strip()]


def _rows(value: str) -> list[list[str]]:
    rows = []
    for line in _lines(value):
        label, _, cell = line.partition("|")
        rows.append([label.strip(), cell.strip()])
    return rows


class _LF:
    """A POST view whose text always uses LF line breaks (browsers send CRLF)."""

    def __init__(self, data):
        self._data = data

    def get(self, key, default=None):
        value = self._data.get(key, default)
        if isinstance(value, str):
            return value.replace("\r\n", "\n").replace("\r", "\n")
        return value


def blocks_from_post(data) -> list[dict]:
    """Reads ``block-N-*`` fields back into block dicts, in order."""
    data = _LF(data)
    try:
        count = min(int(data.get("block-count", 0)), MAX_BLOCKS)
    except (TypeError, ValueError):
        count = 0
    blocks = []
    for i in range(count):
        kind = data.get(f"block-{i}-type", "")
        prefix = f"block-{i}-"
        if kind in ("heading", "section", "quote"):
            blocks.append({"type": kind, "text": data.get(prefix + "text", "")})
        elif kind == "text":
            block = {"type": "text", "text": data.get(prefix + "text", "")}
            if data.get(prefix + "muted"):
                block["tone"] = "muted"
            blocks.append(block)
        elif kind == "button":
            blocks.append(
                {
                    "type": "button",
                    "label": data.get(prefix + "label", ""),
                    "url": data.get(prefix + "url", ""),
                }
            )
        elif kind == "badge":
            blocks.append({"type": "badge", "items": _lines(data.get(prefix + "items", ""))[:3]})
        elif kind == "details":
            blocks.append({"type": "details", "rows": _rows(data.get(prefix + "rows", ""))})
        elif kind in ("divider", "signature"):
            blocks.append({"type": kind})
    return blocks


def new_block(kind: str) -> dict | None:
    if kind not in BLOCK_LABELS:
        return None
    return {
        "heading": {"type": "heading", "text": ""},
        "section": {"type": "section", "text": ""},
        "text": {"type": "text", "text": ""},
        "quote": {"type": "quote", "text": ""},
        "button": {"type": "button", "label": "", "url": ""},
        "badge": {"type": "badge", "items": []},
        "details": {"type": "details", "rows": []},
        "divider": {"type": "divider"},
        "signature": {"type": "signature"},
    }[kind]


def apply_op(blocks: list[dict], op: str) -> list[dict]:
    """Editor operations: ``add:<type>``, ``up:<i>``, ``down:<i>``, ``remove:<i>``."""
    action, _, arg = (op or "").partition(":")
    blocks = list(blocks)
    if action == "add" and len(blocks) < MAX_BLOCKS:
        block = new_block(arg)
        if block:
            # A new block goes before the signature, so the sign-off stays last.
            at = next((i for i, b in enumerate(blocks) if b.get("type") == "signature"), len(blocks))
            blocks.insert(at, block)
        return blocks
    if not arg.isdigit() or int(arg) >= len(blocks):
        return blocks
    i = int(arg)
    if action == "remove":
        blocks.pop(i)
    elif action == "up" and i > 0:
        blocks[i - 1], blocks[i] = blocks[i], blocks[i - 1]
    elif action == "down" and i < len(blocks) - 1:
        blocks[i + 1], blocks[i] = blocks[i], blocks[i + 1]
    return blocks


def block_rows(blocks: list[dict]) -> list[dict]:
    """Blocks as editor rows: text fields ready for the template (items and rows one per line)."""
    out = []
    for i, block in enumerate(blocks):
        rows = block.get("rows", [])
        out.append(
            {
                "index": i,
                "type": block.get("type", ""),
                "label_text": BLOCK_LABELS.get(block.get("type", ""), "Block"),
                "text": block.get("text", ""),
                "muted": block.get("tone") == "muted",
                "label": block.get("label", ""),
                "url": block.get("url", ""),
                "items": "\n".join(block.get("items", [])),
                "rows": "\n".join(
                    f"{r.get('label', '')} | {r.get('value', '')}"
                    if isinstance(r, dict)
                    else f"{r[0]} | {r[1]}"
                    for r in rows
                ),
                "first": i == 0,
                "last": i == len(blocks) - 1,
            }
        )
    return out
