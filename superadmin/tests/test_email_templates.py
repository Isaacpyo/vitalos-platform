"""Mail > Email templates: seeds, access, editor, preview, versions, send test and unsubscribe."""

import io
import re

import pytest
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command

from apps.accounts.roles import SUPERADMIN
from apps.architecture.models import Company
from apps.audit.models import AuditEvent
from apps.email_templates import services
from apps.email_templates.models import Category, EmailSuppression, EmailTemplate, Kind, Status
from apps.email_templates.rendering import read_unsubscribe_token, render_content, unsubscribe_url
from apps.email_templates.variables import VARIABLES, merge, validate
from apps.enquiries.models import Enquiry
from apps.mailer.backends import ResendEmailBackend

from .conftest import HX


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()


@pytest.fixture
def library(db, seeded):
    call_command("seed_email_templates", stdout=io.StringIO())
    return EmailTemplate.objects.all()


@pytest.fixture
def owner(make_user):
    """A SuperAdmin with a Vitalos address, who may receive test emails."""
    return make_user(SUPERADMIN, email="owner@vitalos.co.uk", full_name="Temitope Agbola")


def _template(key="proposal-sent"):
    return EmailTemplate.objects.get(key=key)


def _form_data(template, **overrides):
    data = {
        "name": template.name,
        "category": template.category,
        "kind": template.kind,
        "status": "draft",
        "description": template.description,
        "header_label": template.header_label,
        "subject": template.subject,
        "preheader": template.preheader,
        "reason": template.reason,
        "footer_notice": template.footer_notice,
        "block-count": "2",
        "block-0-type": "heading",
        "block-0-text": "Hi {{first_name}},",
        "block-1-type": "signature",
        "op": "save",
    }
    data.update(overrides)
    return data


# --- Seed data -------------------------------------------------------------------------------------


def test_seed_files_are_valid_and_complete():
    items = services.load_seed()
    assert services.seed_problems(items) == []
    assert len(items) == 81
    assert {item["category"] for item in items} == set(Category.values)
    for item in items:
        if item["kind"] in (Kind.OUTREACH, Kind.MARKETING):
            assert item["reason"], item["key"]
        if item["kind"] != Kind.INTERNAL:
            assert item["blocks"][-1]["type"] == "signature", item["key"]


def test_every_seed_renders_with_fallbacks_and_no_unknown_variables(library):
    for template in library:
        content = template.content()
        assert validate(content, {}).unknown == [], template.key
        rendered = render_content(content, {}, key=template.key)
        assert "{{" not in rendered.email.text, template.key
        assert "{{" not in rendered.subject, template.key


def test_seed_command_is_idempotent_and_never_overwrites(library, owner):
    assert library.count() == 81
    assert set(library.values_list("status", flat=True)) == {Status.DRAFT}
    template = _template()
    assert template.version == 1 and template.versions.get().note == "Seeded from the repository"
    services.update_template(
        template, content={**template.content(), "subject": "Edited"}, status="active", user=owner
    )
    call_command("seed_email_templates", stdout=io.StringIO())
    assert EmailTemplate.objects.count() == 81
    assert _template().subject == "Edited"


def test_enquiry_notification_is_marked_as_sent_by_the_website(library):
    template = _template("enquiry-received")
    assert template.managed_by == "website" and template.kind == Kind.INTERNAL
    assert "this email is not the record" in template.footer_notice


# --- Access and navigation ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "/mail/templates/",
        "/mail/templates/new/",
        "/mail/templates/{pk}/",
        "/mail/templates/{pk}/versions/",
        "/mail/templates/frame/{pk}/",
    ],
)
def test_only_superadmins_can_open_the_library(client_for, superadmin, lead, viewer, library, path):
    path = path.format(pk=_template().pk)
    assert client_for(superadmin).get(path).status_code == 200
    assert client_for(lead).get(path).status_code == 403
    assert client_for(viewer).get(path).status_code == 403


@pytest.mark.parametrize("action", ["duplicate", "archive", "send-test", "versions/1/restore", "preview"])
def test_writes_are_superadmin_only(client_for, lead, library, action):
    pk = _template().pk
    assert client_for(lead).post(f"/mail/templates/{pk}/{action}/").status_code == 403


def test_breadcrumb_names_the_mail_dropdown(client_for, superadmin, library):
    body = client_for(superadmin).get("/mail/templates/").content.decode()
    assert '<li class="muted hidden sm:block">Mail</li>' in body


def test_anonymous_users_are_sent_to_sign_in(client, library):
    response = client.get("/mail/templates/")
    assert response.status_code == 302 and "/login/" in response["Location"]


def test_mail_dropdown_groups_enquiries_and_templates(client_for, superadmin, lead, viewer, library):
    body = client_for(superadmin).get("/mail/templates/").content.decode()
    assert 'data-nav-parent="mail"' in body
    assert re.findall(r'aria-current="page" data-nav="([a-z_]+)"', body) == ["email_templates"]
    assert 'data-nav="enquiries"' in body
    lead_body = client_for(lead).get("/enquiries/").content.decode()
    assert 'data-nav="enquiries"' in lead_body and 'data-nav="email_templates"' not in lead_body
    viewer_body = client_for(viewer).get("/").content.decode()
    assert 'data-nav-parent="mail"' not in viewer_body


# --- List ------------------------------------------------------------------------------------------


def test_list_search_and_filters(client_for, superadmin, library):
    client = client_for(superadmin)
    body = client.get("/mail/templates/").content.decode()
    assert "81 of 81 templates" in body and "Last edited" in body and "Edited by" in body
    body = client.get("/mail/templates/?q=proposal&category=sales", **HX).content.decode()
    assert 'data-template="proposal-sent"' in body and 'data-template="invoice-sent"' not in body
    services.set_archived(_template(), True, user=superadmin)
    assert 'data-template="proposal-sent"' not in client.get("/mail/templates/?q=proposal").content.decode()
    assert (
        'data-template="proposal-sent"'
        in client.get("/mail/templates/?q=proposal&status=archived").content.decode()
    )


# --- Editor and preview ------------------------------------------------------------------------------


def test_editor_shows_blocks_variables_and_a_sandboxed_preview(client_for, superadmin, library):
    body = client_for(superadmin).get(f"/mail/templates/{_template().pk}/").content.decode()
    assert 'data-block="button"' in body and "data-insert-variable" in body
    assert 'data-testid="preview-frame"' in body and "sandbox" in body
    assert "Send test" in body


def test_block_operations_do_not_save(client_for, superadmin, library):
    template = _template()
    data = _form_data(template, op="add:button")
    response = client_for(superadmin).post(f"/mail/templates/{template.pk}/", data, **HX)
    body = response.content.decode()
    assert response.status_code == 200 and 'data-testid="unsaved"' in body
    assert body.count('data-block="button"') == 1 and response["HX-Trigger"] == "vsa-preview"
    assert _template().version == 1


def test_saving_creates_a_version_and_an_audit_event(client_for, superadmin, library):
    template = _template()
    data = _form_data(template, subject="Our proposal ({{reference}})", status="active")
    response = client_for(superadmin).post(f"/mail/templates/{template.pk}/", data)
    assert response.status_code == 302
    template.refresh_from_db()
    assert template.version == 2 and template.status == Status.ACTIVE
    assert template.versions.count() == 2 and template.updated_by == superadmin
    assert AuditEvent.objects.filter(action="email_templates.updated").exists()


def test_outreach_needs_a_reason_for_contact(client_for, superadmin, library):
    template = _template("outreach-cold-introduction")
    data = _form_data(template, reason="")
    response = client_for(superadmin).post(f"/mail/templates/{template.pk}/", data)
    assert response.status_code == 200 and "needs a reason for contact" in response.content.decode()
    assert _template("outreach-cold-introduction").version == 1


def test_create_a_new_template(client_for, superadmin, library):
    data = _form_data(_template(), name="Workshop follow-up", subject="Thanks for the workshop")
    response = client_for(superadmin).post("/mail/templates/new/", data)
    assert response.status_code == 302
    created = EmailTemplate.objects.get(name="Workshop follow-up")
    assert created.key == "workshop-follow-up" and created.status == Status.DRAFT


def test_preview_warns_on_unknown_variables_and_shows_fallbacks(client_for, superadmin, library):
    template = _template()
    data = _form_data(
        template, subject="Hello {{mystery}}", **{"block-0-text": "Hi {{first_name}} at {{organisation}}"}
    )
    body = client_for(superadmin).post(f"/mail/templates/{template.pk}/preview/", data, **HX).content.decode()
    assert 'data-testid="unknown-variables"' in body and "{{mystery}}" in body
    assert 'data-testid="fallback-variables"' in body and "organisation → “your organisation”" in body


def test_preview_uses_a_real_enquiry_as_sample_data(client_for, superadmin, library):
    Enquiry.objects.create(
        number=7, subject="Website enquiry", from_name="Jane Doe", from_email="jane@example.test"
    )
    template = _template()
    body = client_for(superadmin).post(f"/mail/templates/{template.pk}/preview/", _form_data(template), **HX)
    assert "Enquiry VIT-0007 from Jane Doe" in body.content.decode()


def test_preview_frame_is_isolated_and_can_force_dark_mode(client_for, superadmin, library):
    pk = _template().pk
    response = client_for(superadmin).get(f"/mail/templates/frame/{pk}/?theme=dark")
    csp = response["Content-Security-Policy"]
    assert "sandbox" in csp and "default-src 'none'" in csp and "script-src" not in csp
    assert response["X-Frame-Options"] == "SAMEORIGIN"
    html = response.content.decode()
    assert "@media all{" in html and "data:image/png;base64," in html and "cid:" not in html
    assert "Vitalos Technologies Limited, company number 16696895" in html


def test_plain_text_view(client_for, superadmin, library):
    template = _template()
    data = {**_form_data(template), "preview_view": "text"}
    body = client_for(superadmin).post(f"/mail/templates/{template.pk}/preview/", data, **HX).content.decode()
    assert 'data-testid="preview-text"' in body and "VITALOS · PROPOSAL" in body.upper()


# --- History, duplicate, archive ----------------------------------------------------------------------


def test_restore_duplicate_and_archive(client_for, superadmin, library):
    client = client_for(superadmin)
    template = _template()
    original_subject = template.subject
    services.update_template(
        template, content={**template.content(), "subject": "Changed"}, status="draft", user=superadmin
    )
    assert client.post(f"/mail/templates/{template.pk}/versions/1/restore/").status_code == 302
    template.refresh_from_db()
    assert template.subject == original_subject and template.version == 3
    assert template.versions.first().note == "Restored from v1"

    client.post(f"/mail/templates/{template.pk}/duplicate/")
    copy = EmailTemplate.objects.get(name=f"Copy of {template.name}")
    assert copy.status == Status.DRAFT and copy.key == "copy-of-proposal-sent"

    client.post(f"/mail/templates/{template.pk}/archive/", {"archived": "1"})
    assert _template().status == Status.ARCHIVED
    client.post(f"/mail/templates/{template.pk}/archive/", {"archived": "0"})
    assert _template().status == Status.DRAFT
    assert EmailTemplate.objects.filter(pk=template.pk).exists()  # never deleted


# --- Send test ---------------------------------------------------------------------------------------


def test_send_test_refuses_non_vitalos_addresses(client_for, superadmin, library):
    response = client_for(superadmin).post(f"/mail/templates/{_template().pk}/send-test/", follow=True)
    assert "only to your own @vitalos.co.uk address" in response.content.decode()
    assert mail.outbox == []


def test_send_test_goes_to_the_admin_only_with_inline_images(client_for, owner, library):
    template = _template()
    client_for(owner).post(f"/mail/templates/{template.pk}/send-test/")
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == ["owner@vitalos.co.uk"] and not message.cc and not message.bcc
    assert message.subject.startswith("[Test] Our proposal for")
    html = message.alternatives[0][0]
    assert 'src="cid:vitalos-logo"' in html and "Temitope Agbola" in html
    content_ids = [part["Content-ID"] for part in message.attachments]
    assert "<vitalos-logo>" in content_ids and "<social-linkedin>" in content_ids
    assert "List-Unsubscribe" not in message.extra_headers  # transactional
    assert AuditEvent.objects.filter(action="email_templates.test_sent").exists()


def test_marketing_test_carries_one_click_unsubscribe(client_for, owner, library, settings):
    settings.APP_BASE_URL = "https://admin.vitalos.co.uk"
    client_for(owner).post(f"/mail/templates/{_template('marketing-newsletter').pk}/send-test/")
    message = mail.outbox[0]
    assert message.extra_headers["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert "/mail/unsubscribe/" in message.extra_headers["List-Unsubscribe"]
    assert ">Unsubscribe</a>" in message.alternatives[0][0]
    assert "Unsubscribe: https://admin.vitalos.co.uk/mail/unsubscribe/" in message.body


def test_send_test_is_rate_limited(client_for, owner, library):
    client = client_for(owner)
    pk = _template().pk
    for _ in range(services.TEST_SENDS_PER_HOUR + 1):
        client.post(f"/mail/templates/{pk}/send-test/")
    assert len(mail.outbox) == services.TEST_SENDS_PER_HOUR


def test_resend_backend_sends_inline_images_by_content_id(settings, owner, library):
    settings.RESEND_API_KEY = "re_test_not_real"
    template = _template()
    rendered = render_content(template.content(), {}, key=template.key)
    from apps.mailer.messages import build_message

    message = build_message(
        rendered.email, subject="Hi", to=["owner@vitalos.co.uk"], from_email="a@vitalos.co.uk"
    )
    payload = ResendEmailBackend()._payload(message)
    assert payload["html"] == rendered.email.html
    by_id = {item.get("content_id"): item for item in payload["attachments"]}
    assert by_id["vitalos-logo"]["content_type"] == "image/png" and by_id["vitalos-logo"]["content"]


# --- Unsubscribe -------------------------------------------------------------------------------------


def test_unsubscribe_confirms_then_records(client, library):
    url = unsubscribe_url("Someone@Example.test", "marketing-newsletter").split("localhost:8000")[-1]
    page = client.get(url)
    assert page.status_code == 200 and 'data-testid="confirm-unsubscribe"' in page.content.decode()
    assert not EmailSuppression.objects.exists()
    done = client.post(url)
    assert 'data-testid="unsubscribed"' in done.content.decode()
    assert services.is_suppressed("someone@example.test")


def test_one_click_unsubscribe_needs_no_session_or_csrf(db, library):
    from django.test import Client

    url = unsubscribe_url("a@example.test", "marketing-newsletter").split("localhost:8000")[-1]
    response = Client(enforce_csrf_checks=True).post(url, {"List-Unsubscribe": "One-Click"})
    assert response.status_code == 200 and services.is_suppressed("a@example.test")


def test_a_tampered_unsubscribe_link_is_refused(client, library):
    url = unsubscribe_url("a@example.test", "x").split("localhost:8000")[-1]
    assert client.post(url[:-3] + "abc/").status_code == 400
    assert not EmailSuppression.objects.exists()


# --- Footer facts and variables -----------------------------------------------------------------------


def test_footer_reads_company_settings_and_shows_placeholders_when_missing(library):
    template = _template()
    html = render_content(template.content(), {}, key=template.key).email.html
    assert "114 High Street, Bentley, Doncaster" in html and "social-instagram" in html
    company = Company.load()
    company.company_number = ""
    company.instagram_url = ""
    company.save()
    html = render_content(template.content(), {}, key=template.key).email.html
    assert "[Company number]" in html and "social-instagram" not in html


def test_merge_uses_fallbacks_and_leaves_unknown_names():
    assert merge("Hi {{ first_name }}, {{nope}}", {}) == "Hi there, {{nope}}"
    assert merge("{{organisation}}", {"organisation": "Rttg"}) == "Rttg"
    for name in (
        "first_name",
        "organisation",
        "reference",
        "proposal_link",
        "invoice_number",
        "amount",
        "due_date",
        "sender_name",
        "unsubscribe_link",
    ):
        assert name in VARIABLES


# --- Use a template ----------------------------------------------------------------------------------


def _use_url(template, name=""):
    return f"/mail/templates/{template.pk}/use/{name}"


def _use_post(client, template, name, **data):
    return client.post(_use_url(template, name), data)


def _parse(response):
    import email
    from email import policy

    return email.message_from_bytes(response.content, policy=policy.default)


def test_use_page_is_superadmin_only(client_for, viewer, lead, library):
    template = _template()
    for user in (viewer, lead):
        client = client_for(user)
        assert client.get(_use_url(template)).status_code == 403
        for name in ("preview/", "prefill/", "payload/", "eml/"):
            assert _use_post(client, template, name, action="copy_email").status_code == 403
        assert client.get(_use_url(template, "frame/")).status_code == 403
    assert not AuditEvent.objects.filter(action="email_templates.used").exists()


def test_use_page_lists_the_variables_the_template_uses(client_for, owner, library):
    template = _template()
    html = client_for(owner).get(_use_url(template)).content.decode()
    assert "Draft, wording not yet approved" in html
    assert 'name="var-first_name"' in html and 'name="recipient"' in html
    assert 'data-testid="empty-variables"' in html
    assert 'name="var-unsubscribe_link"' not in html


def test_entry_points_on_the_list_and_the_editor_hide_for_archived(client_for, owner, library):
    template = _template()
    client = client_for(owner)
    assert _use_url(template) in client.get("/mail/templates/?q=proposal-sent").content.decode()
    assert _use_url(template) in client.get(f"/mail/templates/{template.pk}/").content.decode()
    services.set_archived(template, True, user=owner)
    assert _use_url(template) not in client.get(f"/mail/templates/{template.pk}/").content.decode()
    assert (
        _use_url(template) not in client.get("/mail/templates/?status=all&q=proposal-sent").content.decode()
    )


def test_archived_templates_cannot_be_used(client_for, owner, library):
    template = _template()
    services.set_archived(template, True, user=owner)
    client = client_for(owner)
    assert client.get(_use_url(template)).status_code == 302
    for name in ("preview/", "prefill/", "payload/", "eml/"):
        assert _use_post(client, template, name, action="copy_email").status_code == 409
    assert client.get(_use_url(template, "frame/")).status_code == 404
    assert not AuditEvent.objects.filter(action="email_templates.used").exists()


def test_preview_substitutes_values_and_flags_the_empty_ones(client_for, owner, library):
    template = _template("invoice-sent")
    client = client_for(owner)
    names = [v.name for v in services.use_variables(template)]
    data = {"var-first_name": "Ada", "preview_view": "text"}
    if "invoice_number" in names:
        data["var-invoice_number"] = "INV-42"
    html = _use_post(client, template, "preview/", **data).content.decode()
    assert "Hi Ada" in html
    assert 'data-testid="empty-variables"' in html and "Not ready to send" in html
    assert "fallbacks such as" in html
    frame = client.get(_use_url(template, "frame/")).content.decode()
    assert "Ada" in frame


def test_preview_frame_is_isolated(client_for, owner, library):
    template = _template("invoice-sent")
    client = client_for(owner)
    _use_post(client, template, "preview/", **{"var-first_name": "Ada"})
    response = client.get(_use_url(template, "frame/") + "?theme=dark")
    assert "sandbox" in response["Content-Security-Policy"] and "Ada" in response.content.decode()


def test_preview_is_ready_when_everything_is_filled(client_for, owner, library):
    template = _template("invoice-sent")
    data = {f"var-{v.name}": f"{v.name} value" for v in services.use_variables(template)}
    html = _use_post(client_for(owner), template, "preview/", **data).content.decode()
    assert 'data-testid="ready"' in html and 'data-testid="empty-variables"' not in html


def test_values_are_escaped(client_for, owner, library):
    template = _template("invoice-sent")
    payload = _use_post(
        client_for(owner),
        template,
        "payload/",
        action="copy_email",
        **{"var-first_name": "<script>alert(1)</script>"},
    ).json()
    assert "<script>alert(1)</script>" not in payload["html"]
    assert "&lt;script&gt;" in payload["html"]


def test_prefill_from_an_enquiry_fills_the_fields_and_recipient(client_for, owner, library):
    enquiry = Enquiry.objects.create(
        number=1, from_name="Ada Lovelace", from_email="ada@example.test", subject="Hi"
    )
    spam = Enquiry.objects.create(
        number=2, from_name="Spammer", from_email="spam@example.test", status="spam"
    )
    client = client_for(owner)
    template = _template()
    page = client.get(_use_url(template)).content.decode()
    assert enquiry.ref in page and spam.ref not in page
    response = _use_post(client, template, "prefill/", enquiry=str(enquiry.pk))
    html = response.content.decode()
    assert 'value="Ada"' in html and 'value="ada@example.test"' in html
    assert response["HX-Trigger-After-Swap"] == "vsa-use-preview"
    # A spam enquiry cannot be used to prefill.
    assert "Spammer" not in _use_post(client, template, "prefill/", enquiry=str(spam.pk)).content.decode()


def test_copy_payload_is_audited_without_the_recipient(client_for, owner, library):
    template = _template("invoice-sent")
    response = _use_post(
        client_for(owner),
        template,
        "payload/",
        action="copy_email",
        recipient="Client@Example.test",
        **{"var-first_name": "Ada"},
    )
    assert response.status_code == 200 and response["Cache-Control"].startswith("private")
    body = response.json()
    assert "Ada" in body["html"] and "Hi Ada" in body["text"] and body["subject"]
    assert "cid:" not in body["html"] and "data:image/png;base64," in body["html"]
    event = AuditEvent.objects.get(action="email_templates.used")
    assert template.name in event.summary and "copy_email" in event.summary
    dump = " ".join(str(v) for v in (event.summary, event.metadata, event.entity_id, event.actor_email))
    assert "client@example.test" not in dump.lower()


def test_unknown_copy_action_is_refused(client_for, owner, library):
    response = _use_post(client_for(owner), _template(), "payload/", action="something-else")
    assert response.status_code == 400
    assert not AuditEvent.objects.filter(action="email_templates.used").exists()


def test_eml_download_is_an_unsent_draft_with_both_parts(client_for, owner, library):
    template = _template("invoice-sent")
    response = _use_post(
        client_for(owner), template, "eml/", recipient="ada@example.test", **{"var-first_name": "Ada"}
    )
    assert response.status_code == 200
    assert response["Content-Type"] == "message/rfc822"
    assert response["Content-Disposition"] == f'attachment; filename="{template.key}.eml"'
    message = _parse(response)
    assert message["X-Unsent"] == "1"
    assert message["To"] == "ada@example.test"
    assert message["From"] == "Temitope Agbola <owner@vitalos.co.uk>"
    assert message["Subject"] and message["Date"]
    assert message.get_content_type() == "multipart/related"
    assert message.get_body(("plain",)).get_content().strip()
    assert "Ada" in message.get_body(("html",)).get_content()
    assert any(part["Content-ID"] == "<vitalos-logo>" for part in message.iter_attachments())
    assert "List-Unsubscribe" not in message  # transactional
    event = AuditEvent.objects.get(action="email_templates.used")
    assert "download_eml" in event.summary and "ada@example.test" not in str(event.summary)


def test_eml_without_a_recipient_has_no_to_line_for_transactional_email(client_for, owner, library):
    response = _use_post(client_for(owner), _template("invoice-sent"), "eml/")
    message = _parse(response)
    assert response.status_code == 200 and message["To"] is None and message["X-Unsent"] == "1"


def test_outreach_needs_a_recipient_for_copy_and_download(client_for, owner, library):
    template = _template("outreach-cold-introduction")
    client = client_for(owner)
    page = _use_post(client, template, "preview/").content.decode()
    assert 'data-testid="needs-recipient"' in page and page.count(" disabled") >= 4
    payload = _use_post(client, template, "payload/", action="copy_email")
    assert payload.status_code == 400 and "needs a recipient" in payload.json()["error"]
    eml = _use_post(client, template, "eml/")
    assert eml.status_code == 400 and "needs a recipient" in eml.content.decode()
    assert not AuditEvent.objects.filter(action="email_templates.used").exists()


def test_outreach_carries_the_real_signed_unsubscribe_link_for_the_recipient(
    client_for, owner, library, settings
):
    settings.APP_BASE_URL = "https://admin.vitalos.co.uk"
    template = _template("outreach-cold-introduction")
    client = client_for(owner)
    payload = _use_post(
        client, template, "payload/", action="copy_email", recipient="Ada@Example.test"
    ).json()
    link = re.search(r"https://admin\.vitalos\.co\.uk/mail/unsubscribe/([^\"<>\s]+?)/", payload["html"])
    assert link, payload["html"][-800:]
    assert read_unsubscribe_token(link.group(1)) == {"e": "ada@example.test", "k": template.key}
    message = _parse(_use_post(client, template, "eml/", recipient="ada@example.test"))
    assert "/mail/unsubscribe/" in message["List-Unsubscribe"]
    assert message["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert message["To"] == "ada@example.test"


def test_suppressed_recipients_are_refused(client_for, owner, library):
    EmailSuppression.objects.create(email="gone@example.test")
    template = _template("outreach-cold-introduction")
    client = client_for(owner)
    payload = _use_post(client, template, "payload/", action="copy_email", recipient="Gone@Example.test")
    assert payload.status_code == 400 and "unsubscribed" in payload.json()["error"]
    eml = _use_post(client, template, "eml/", recipient="gone@example.test")
    assert eml.status_code == 400 and "unsubscribed" in eml.content.decode()
    assert not AuditEvent.objects.filter(action="email_templates.used").exists()


def test_an_invalid_recipient_is_refused(client_for, owner, library):
    payload = _use_post(
        client_for(owner), _template(), "payload/", action="copy_text", recipient="not an email"
    )
    assert payload.status_code == 400 and "valid recipient" in payload.json()["error"]


def test_use_endpoints_only_accept_post(client_for, owner, library):
    client = client_for(owner)
    template = _template()
    for name in ("preview/", "prefill/", "payload/", "eml/"):
        assert client.get(_use_url(template, name)).status_code == 405


# --- Line endings from the editor ---------------------------------------------------------------------


def _browser_post(template, **overrides):
    """The editor's POST as a browser sends it: textarea line breaks are CRLF."""
    from apps.email_templates.forms import block_rows

    rows = block_rows(template.blocks)
    data = _form_data(template, **overrides)
    for key in ("name", "description", "header_label", "subject", "preheader", "reason", "footer_notice"):
        data[key] = data[key].replace("\n", "\r\n")
    for key in [key for key in data if key.startswith("block-")]:
        del data[key]
    data["block-count"] = str(len(rows))
    for row in rows:
        prefix = f"block-{row['index']}-"
        data[prefix + "type"] = row["type"]
        for field in ("text", "label", "url", "items", "rows"):
            if row[field]:
                data[prefix + field] = row[field].replace("\n", "\r\n")
        if row["muted"]:
            data[prefix + "muted"] = "on"
    return data


def test_a_status_only_save_with_crlf_text_does_not_bump_the_version(client_for, superadmin, library):
    template = _template()
    blocks = [dict(block) for block in template.blocks]
    next(block for block in blocks if block["type"] == "text")["text"] = (
        "First line\n\nSecond paragraph\nthird"
    )
    services.update_template(
        template, content={**template.content(), "blocks": blocks}, status=Status.DRAFT, user=superadmin
    )
    template.refresh_from_db()
    version = template.version
    response = client_for(superadmin).post(
        f"/mail/templates/{template.pk}/", _browser_post(template, status="active")
    )
    assert response.status_code == 302
    template.refresh_from_db()
    assert template.status == Status.ACTIVE
    assert template.version == version
    assert template.versions.count() == version


def test_crlf_is_stored_as_lf(client_for, superadmin, library):
    template = _template()
    data = _browser_post(template)
    index = next(i for i, block in enumerate(template.blocks) if block["type"] == "text")
    data[f"block-{index}-text"] = "One\r\nTwo\rThree"
    data["description"] = "Used when\r\nsomething happens"
    assert client_for(superadmin).post(f"/mail/templates/{template.pk}/", data).status_code == 302
    template.refresh_from_db()
    assert template.blocks[index]["text"] == "One\nTwo\nThree"
    assert template.description == "Used when\nsomething happens"
    assert "\r" not in str(template.content())
    assert "\r" not in str(template.versions.first().content)


# --- New blocks: code, steps, items and figures -----------------------------------------------------


def test_new_blocks_round_trip_through_the_editor_and_render(client_for, superadmin, library):
    template = _template()
    data = _form_data(
        template,
        **{
            "block-count": "5",
            "block-0-type": "code",
            "block-0-code": "{{reference}}",
            "block-0-expiry": "The code expires in 10 minutes.",
            "block-1-type": "steps",
            "block-1-title": "What happens next",
            "block-1-items": "We read it.\r\nWe reply.",
            "block-2-type": "items",
            "block-2-items": "New | Example Care Group | A new site | 26 Oct | https://vitalos.co.uk/x\r\n | Only a title",
            "block-3-type": "stats",
            "block-3-items": "3 | New\r\nOverdue | Status",
            "block-4-type": "signature",
        },
    )
    response = client_for(superadmin).post(f"/mail/templates/{template.pk}/", data)
    assert response.status_code == 302, response.content.decode()[:2000]
    blocks = _template().blocks
    assert blocks[0] == {"type": "code", "code": "{{reference}}", "expiry": "The code expires in 10 minutes."}
    assert blocks[1] == {"type": "steps", "title": "What happens next", "items": ["We read it.", "We reply."]}
    assert blocks[2]["items"] == [
        {
            "tag": "New",
            "title": "Example Care Group",
            "summary": "A new site",
            "meta": "26 Oct",
            "href": "https://vitalos.co.uk/x",
        },
        {"title": "Only a title"},
    ]
    assert blocks[3]["items"] == [{"value": "3", "label": "New"}, {"value": "Overdue", "label": "Status"}]
    rendered = render_content(_template().content(), {"reference": "VIT-EXAMPLE-01"}, key=template.key)
    assert "VIT-EXAMPLE-01" in rendered.email.text and "1. We read it." in rendered.email.text
    assert "[New] Example Care Group" in rendered.email.text and "Status: Overdue" in rendered.email.text
    editor = client_for(superadmin).get(f"/mail/templates/{template.pk}/").content.decode()
    assert "New | Example Care Group | A new site | 26 Oct | https://vitalos.co.uk/x" in editor
    assert "3 | New" in editor


@pytest.mark.parametrize(
    ("block", "message"),
    [
        ({"type": "code", "code": ""}, "needs a code"),
        ({"type": "code", "code": "{{reference}}"}, "must not appear in the subject"),
        ({"type": "steps", "items": ["1", "2", "3", "4", "5"]}, "1 to 4 steps"),
        ({"type": "steps", "items": []}, "1 to 4 steps"),
        ({"type": "items", "items": [{"title": ""}]}, "each with a title"),
        ({"type": "stats", "items": [{"value": "1", "label": "One"}]}, "2 to 4 figures"),
        ({"type": "stats", "items": [{"value": "1", "label": ""}, {"value": "2", "label": "x"}]}, "2 to 4"),
    ],
)
def test_new_block_validation(block, message):
    content = {
        "category": "enquiries",
        "kind": "transactional",
        "subject": "Your reference {{reference}}",
        "blocks": [block],
    }
    assert any(message in error for error in services.content_errors(content))


def test_every_block_type_is_in_the_palette():
    from apps.email_templates.forms import BLOCK_LABELS, new_block

    assert set(BLOCK_LABELS) == set(services.BLOCK_TYPES)
    assert all(new_block(kind)["type"] == kind for kind in BLOCK_LABELS)


# --- Review rules (docs/email/REVIEW.md) ------------------------------------------------------------


def test_review_rules_flag_each_problem(db):
    from apps.email_templates.review import review_problems

    item = {
        "key": "example",
        "category": "outreach",
        "kind": "outreach",
        "header_label": "A Very Long Label",
        "subject": "An Unusually Capitalised Subject Line That Is Far Too Long For Any Inbox Today",
        "preheader": "Short",
        "reason": "",
        "blocks": [
            {"type": "text", "text": "Hello Temitope! A magic {{nope}} offer."},
            {"type": "button", "label": "One", "url": "http://example.test"},
            {"type": "button", "label": "Two", "url": "{{meeting_link}}"},
        ],
    }
    found = "\n".join(review_problems(item))
    for expected in (
        "subject is",
        "not sentence case",
        "preheader is 5 characters",
        "header label has 4 words",
        "2 buttons",
        "button 'One' has no https",
        "without a reason line",
        "exclamation mark",
        "banned words ['magic']",
        "hard-coded person",
        "unknown variables ['nope']",
    ):
        assert expected in found, expected


def test_review_command_reports_the_library(library):
    out = io.StringIO()
    call_command("review_email_templates", stdout=out)
    assert "81 templates, 0 seed problems" in out.getvalue()


def test_email_gallery_renders_every_email_without_storing_anything(library, tmp_path):
    from apps.enquiries.models import Enquiry

    out = io.StringIO()
    call_command("email_gallery", "--out", str(tmp_path), stdout=out)
    manifest = __import__("json").loads((tmp_path / "manifest.json").read_text())
    slugs = {entry["slug"] for entry in manifest}
    assert {"enquiry-alert-single", "enquiry-digest", "inbox-reply", "account-password-link"} <= slugs
    assert {"careers-hiring-alert", "relay-digest", "library-client-welcome"} <= slugs
    assert all(entry["state"] == "layout" for entry in manifest)
    assert not Enquiry.objects.exists()  # fixtures were rolled back
    page = (tmp_path / "emails" / "enquiry-alert-single.html").read_text()
    assert "cid:" not in page and "../assets/vitalos-logo-white.png" in page
    assert "@media all{" in (tmp_path / "emails" / "enquiry-alert-single.dark.html").read_text()
    assert 'data-filter="repo"' in (tmp_path / "index.html").read_text()


# --- Reviewed seed content reaches existing templates (update_seeded_templates) ----------------------


def _seed_with(monkeypatch, key, **changes):
    items = services.load_seed()
    for item in items:
        if item["key"] == key:
            item.update(changes)
    monkeypatch.setattr(services, "load_seed", lambda: items)
    return items


def test_seed_hash_is_set_when_seeding(library):
    from apps.email_templates.models import content_hash

    template = _template()
    assert template.seed_hash and template.seed_hash == content_hash(template.content())


def test_unedited_templates_are_updated_with_a_version_and_keep_their_status(library, monkeypatch):
    template = _template()
    template.status = Status.ACTIVE
    template.save()
    _seed_with(monkeypatch, "proposal-sent", subject="Your proposal for {{project_name}} is ready")
    out = io.StringIO()
    call_command("update_seeded_templates", stdout=out)
    assert "update 1, create 0, 80 unchanged, 0 skipped" in out.getvalue()
    template = _template()
    assert template.subject == "Your proposal for {{project_name}} is ready"
    assert template.status == Status.ACTIVE and template.version == 2
    assert template.versions.first().note == "Updated from the repository (email review, Oct 2026)"
    assert AuditEvent.objects.filter(action="email_templates.seed_updated").exists()
    # Idempotent: a second run changes nothing.
    out = io.StringIO()
    call_command("update_seeded_templates", stdout=out)
    assert "update 0, create 0, 81 unchanged" in out.getvalue() and _template().version == 2


def test_templates_edited_in_the_admin_are_skipped_and_listed(library, monkeypatch, superadmin):
    template = _template()
    services.update_template(
        template,
        content={**template.content(), "subject": "Edited by a person"},
        status="draft",
        user=superadmin,
    )
    _seed_with(monkeypatch, "proposal-sent", subject="Reviewed in the repository")
    out = io.StringIO()
    call_command("update_seeded_templates", stdout=out)
    assert "update 0, create 0, 80 unchanged, 1 skipped" in out.getvalue()
    assert "skipped: proposal-sent" in out.getvalue()
    assert _template().subject == "Edited by a person"


def test_new_seed_templates_are_created_and_dry_run_writes_nothing(library, monkeypatch):
    items = _seed_with(monkeypatch, "proposal-sent", subject="Reviewed in the repository")
    items.append({**items[0], "key": "brand-new-template", "name": "Brand new"})
    out = io.StringIO()
    call_command("update_seeded_templates", "--dry-run", stdout=out)
    assert "Dry run: would update 1, Dry run: would create 1" in out.getvalue()
    assert not EmailTemplate.objects.filter(key="brand-new-template").exists()
    assert _template().version == 1
    call_command("update_seeded_templates", stdout=io.StringIO())
    created = EmailTemplate.objects.get(key="brand-new-template")
    assert created.seeded and created.status == Status.DRAFT and created.seed_hash


def test_seed_hash_backfill_reads_the_seeded_snapshot(library):
    import importlib

    from django.apps import apps as django_apps

    migration = importlib.import_module("apps.email_templates.migrations.0002_seed_hash")
    EmailTemplate.objects.update(seed_hash="")
    edited = _template()
    edited.subject = "Edited later"
    edited.save()
    migration.backfill(django_apps, None)
    from apps.email_templates.models import content_hash

    edited = _template()
    assert edited.seed_hash == content_hash(edited.versions.get(number=1).content)
    assert edited.seed_hash != content_hash(edited.content())  # so the update command will skip it
