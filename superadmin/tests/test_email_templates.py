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
from apps.email_templates.rendering import render_content, unsubscribe_url
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
