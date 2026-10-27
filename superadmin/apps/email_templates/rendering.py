"""Turn a template into a branded email: merge variables, then render with the shared layout (ADR-030)."""

from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings
from django.core import signing
from django.urls import reverse
from django.utils import timezone
from django.utils.dateformat import format as date_format

from apps.architecture.models import Company
from apps.mailer import layout

from .models import OPT_OUT_KINDS
from .variables import merge, validate

UNSUBSCRIBE_SALT = "email-templates.unsubscribe"

SOCIAL = (
    ("LinkedIn", "linkedin_url", "social-linkedin"),
    ("X", "x_url", "social-x"),
    ("Instagram", "instagram_url", "social-instagram"),
    ("Facebook", "facebook_url", "social-facebook"),
)


def company_footer() -> tuple[dict, list[dict]]:
    """Company facts and social links from Settings > Company; missing facts show placeholders."""
    company = Company.load()
    if company is None:
        return {}, []
    facts = {
        "legalName": company.legal_name,
        "companyNumber": company.company_number,
        "registeredOffice": company.registered_office,
        "website": company.website,
        "supportEmail": company.support_email,
    }
    social = [
        {"label": label, "url": getattr(company, field), "contentId": content_id}
        for label, field, content_id in SOCIAL
        if getattr(company, field)
    ]
    return facts, social


def unsubscribe_url(email: str, template_key: str) -> str:
    token = signing.dumps({"e": email.strip().lower(), "k": template_key}, salt=UNSUBSCRIBE_SALT)
    return settings.APP_BASE_URL + reverse("email_templates:unsubscribe", args=[token])


def read_unsubscribe_token(token: str) -> dict | None:
    try:
        data = signing.loads(token, salt=UNSUBSCRIBE_SALT)
    except signing.BadSignature:
        return None
    return data if isinstance(data, dict) and data.get("e") else None


def sample_values(user=None, enquiry=None) -> dict[str, str]:
    """Preview data: the sender is the signed-in admin, the recipient comes from a real enquiry."""
    values: dict[str, str] = {}
    if user is not None and getattr(user, "is_authenticated", False):
        values["sender_name"] = user.get_full_name() or ""
        values["sender_email"] = user.email
        member = getattr(user, "team_member", None)
        values["sender_title"] = getattr(member, "role_title", "") or ""
    if enquiry is not None:
        name = (enquiry.from_name or "").strip()
        first, _, last = name.partition(" ")
        values.update(
            {
                "full_name": name,
                "first_name": first,
                "last_name": last.strip(),
                "email": enquiry.from_email,
                "reference": enquiry.ref,
                "goal": enquiry.snippet,
                "received_at": date_format(timezone.localtime(enquiry.created_at), "D j M Y, H:i"),
            }
        )
        if enquiry.source == "web_form":
            values["source_page"] = "https://vitalos.co.uk/contact"
    return values


def _layout_block(block: dict, values: dict[str, str]) -> dict:
    kind = block.get("type")
    if kind in ("heading", "section", "quote"):
        return {"type": kind, "text": merge(block.get("text", ""), values)}
    if kind == "text":
        out = {"type": "text", "text": merge(block.get("text", ""), values)}
        if block.get("tone") == "muted":
            out["tone"] = "muted"
        return out
    if kind == "button":
        return {
            "type": "button",
            "label": merge(block.get("label", ""), values),
            "url": merge(block.get("url", ""), values),
        }
    if kind == "badge":
        return {"type": "badge", "items": [merge(item, values) for item in block.get("items", [])]}
    if kind == "details":
        rows = []
        for row in block.get("rows", []):
            label, value = (row.get("label", ""), row.get("value", "")) if isinstance(row, dict) else row
            merged = merge(value, values)
            item = {"label": merge(label, values), "value": merged}
            if layout.is_safe_url(layout.clean_line(merged)):
                item["href"] = merged
            rows.append(item)
        return {"type": "details", "rows": rows}
    if kind == "code":
        out = {"type": "code", "code": merge(block.get("code", ""), values)}
        if block.get("expiry"):
            out["expiry"] = merge(block["expiry"], values)
        return out
    if kind == "steps":
        out = {"type": "steps", "items": [merge(item, values) for item in block.get("items", [])]}
        if block.get("title"):
            out["title"] = merge(block["title"], values)
        return out
    if kind == "items":
        return {
            "type": "items",
            "items": [
                {key: merge(value, values) for key, value in item.items()} for item in block.get("items", [])
            ],
        }
    if kind == "stats":
        return {
            "type": "stats",
            "items": [
                {"value": merge(item.get("value", ""), values), "label": merge(item.get("label", ""), values)}
                for item in block.get("items", [])
            ],
        }
    if kind == "divider":
        return {"type": "divider"}
    if kind == "signature":
        return {
            "type": "signature",
            "name": merge("{{sender_name}}", values),
            "title": values.get("sender_title", ""),
        }
    raise ValueError(f"Unknown block type: {kind!r}")


@dataclass(frozen=True)
class RenderedTemplate:
    subject: str
    preheader: str
    email: layout.RenderedEmail
    document: dict


def render_content(
    content: dict, values: dict[str, str], *, key: str, recipient: str = ""
) -> RenderedTemplate:
    """Render template content (a dict of the template's content fields) with merge values."""
    facts, social = company_footer()
    footer: dict = {"social": social, "company": facts}
    notice = merge(content.get("footer_notice", ""), values)
    if notice:
        footer["notice"] = notice
    if content.get("kind") in OPT_OUT_KINDS:
        address = recipient or values.get("email") or "name@example.com"
        footer["unsubscribe"] = {
            "reason": merge(content.get("reason", ""), values),
            "url": unsubscribe_url(address, key),
        }
    subject = layout.clean_line(merge(content.get("subject", ""), values))
    preheader = merge(content.get("preheader", ""), values)
    document = {
        "title": subject,
        "preheader": preheader,
        "headerLabel": merge(content.get("header_label", ""), values) or "Vitalos",
        "blocks": [_layout_block(block, values) for block in content.get("blocks", [])],
        "footer": footer,
    }
    return RenderedTemplate(subject, preheader, layout.render_email(document), document)


def check_content(content: dict, values: dict[str, str]):
    return validate(
        {k: content.get(k) for k in ("subject", "preheader", "reason", "footer_notice", "blocks")}, values
    )


def preview_html(rendered: RenderedTemplate, theme: str = "system") -> str:
    """The HTML for the in-app preview: inline images as data URIs, theme forced if asked."""
    html = rendered.email.html
    for img in rendered.email.inline_images:
        html = html.replace(f"cid:{img['contentId']}", f"data:{img['contentType']};base64,{img['base64']}")
    return layout.force_theme(html, theme)
