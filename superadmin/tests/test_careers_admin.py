"""Careers admin (brief 7.4 to 7.6): roles, applications and settings, with permissions on every view."""

import re
import uuid

import pytest
from django.contrib.auth.models import Permission
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.careers import public
from apps.careers.models import Application, ApplicationEvent, Role, RoleStatus
from apps.careers.retention import hashed_id
from apps.content_sync import render
from apps.content_sync.models import SiteSection, SyncEvent

from .conftest import HX
from .content_helpers import configure, make_role, ok_render, open_site, pdf_bytes

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _setup(settings, monkeypatch):
    configure(settings, targets=())
    monkeypatch.setattr(render, "render", ok_render)
    open_site()


def make_application(role, **fields):
    application = Application.objects.create(
        role=role,
        name=fields.pop("name", "Example Candidate"),
        email=fields.pop("email", "candidate@example.test"),
        right_to_work="yes",
        consent_at=timezone.now(),
        source="role_page",
        submission_id=uuid.uuid4(),
        cover_note=fields.pop("cover_note", "Example note (fixture) <b>bold</b>"),
        **fields,
    )
    key = f"applications/{application.pk}/cv.pdf"
    storages["careers_cvs"].save(key, ContentFile(pdf_bytes()))
    Application.objects.filter(pk=application.pk).update(
        cv_path=key, cv_filename="Example CV.pdf", cv_mime="application/pdf", cv_size=2048
    )
    return Application.objects.get(pk=application.pk)


@pytest.fixture
def world(superadmin):
    role = make_role("Example role (fixture)", actor=superadmin)
    draft = make_role("Example draft role (fixture)", status="draft")
    application = make_application(role)
    return {"role": role, "draft": draft, "application": application}


def _gets(w):
    role, application = w["role"], w["application"]
    return [
        reverse("careers:root"),
        reverse("careers:roles"),
        reverse("careers:roles") + "?tab=drafts",
        reverse("careers:role", args=[role.pk]),
        reverse("careers:role_sync", args=[role.pk]),
        reverse("careers:role_preview_panel", args=[role.pk]),
        reverse("careers:role_preview_frame", args=[role.pk]),
        reverse("careers:settings"),
        reverse("careers:email_preview", args=["receipt"]),
    ], [
        reverse("careers:applications"),
        reverse("careers:application", args=[application.pk]),
    ]


def _posts(w):
    role, draft, application = w["role"], w["draft"], w["application"]
    return [
        (reverse("careers:role_new"), {"title": "Example new role (fixture)"}),
        (
            reverse("careers:role", args=[draft.pk]),
            {
                "title": "x",
                "slug": draft.slug,
                "sponsorship": "not_stated",
                "salary_currency": "GBP",
                "salary_period": "year",
                "apply_mode": "form",
            },
        ),
        (reverse("careers:role_action", args=[draft.pk, "open"]), {}),
        (reverse("careers:role_action", args=[role.pk, "pause"]), {}),
        (reverse("careers:role_action", args=[role.pk, "close"]), {}),
        (reverse("careers:role_action", args=[role.pk, "archive"]), {}),
        (reverse("careers:role_action", args=[role.pk, "duplicate"]), {}),
        (reverse("careers:settings"), {"action": "emails"}),
    ], [
        (reverse("careers:application_action", args=[application.pk, "stage"]), {"stage": "reviewing"}),
        (reverse("careers:application_action", args=[application.pk, "note"]), {"body": "x"}),
        (reverse("careers:application_action", args=[application.pk, "delete"]), {}),
    ]


def test_anonymous_visitors_are_sent_to_sign_in(world, client: Client):
    role_gets, app_gets = _gets(world)
    role_posts, app_posts = _posts(world)
    for url in role_gets + app_gets + [reverse("careers:application_cv", args=[world["application"].pk])]:
        response = client.get(url)
        assert response.status_code == 302 and "/login/" in response["Location"], url
    for url, data in role_posts + app_posts:
        response = client.post(url, data)
        assert response.status_code == 302 and "/login/" in response["Location"], url


def test_viewer_reads_roles_but_not_applications_and_changes_nothing(world, viewer, client_for):
    client = client_for(viewer)
    role_gets, app_gets = _gets(world)
    role_posts, app_posts = _posts(world)
    for url in role_gets:
        assert client.get(url).status_code in (200, 302), url
    for url in app_gets + [reverse("careers:application_cv", args=[world["application"].pk])]:
        assert client.get(url).status_code == 403, url
    for url, data in role_posts + app_posts:
        assert client.post(url, data).status_code == 403, url
    assert client.get(reverse("careers:badge")).content == b""
    assert Role.objects.get(pk=world["role"].pk).status == RoleStatus.OPEN


def test_superadmin_sees_every_page(world, superadmin, client_for):
    client = client_for(superadmin)
    role_gets, app_gets = _gets(world)
    for url in role_gets + app_gets + [reverse("careers:role_new")]:
        assert client.get(url, follow=True).status_code == 200, url
    body = client.get(reverse("careers:roles")).content.decode()
    assert re.findall(r'aria-current="page" data-nav="([a-z_]+)"', body) == ["careers"]
    assert "1 / 1" in body  # new / total applications


def test_application_permissions_are_separate(world, viewer, client_for):
    viewer.user_permissions.add(Permission.objects.get(codename="view_application"))
    client = client_for(viewer)
    application = world["application"]
    assert client.get(reverse("careers:application", args=[application.pk])).status_code == 200
    assert client.get(reverse("careers:application_cv", args=[application.pk])).status_code == 403
    assert (
        client.post(reverse("careers:application_action", args=[application.pk, "delete"])).status_code == 403
    )
    body = client.get(reverse("careers:application", args=[application.pk])).content.decode()
    assert "Download CV" not in body and "You do not have permission to download CVs." in body


def _role_form(role, **changes):
    data = {
        "title": role.title,
        "slug": role.slug,
        "practice": "engineering",
        "level": "l3_senior",
        "show_level": "on",
        "summary": "Example summary (fixture).",
        "location_text": "Example City",
        "work_model": "hybrid",
        "employment_type": "permanent_full_time",
        "sponsorship": "not_stated",
        "salary_currency": "GBP",
        "salary_period": "year",
        "about_md": "Example about (fixture).",
        "requirements_md": "- Example requirement",
        "apply_mode": "form",
        "updated_at": role.updated_at.isoformat(),
    }
    data.update(changes)
    return data


def test_role_lifecycle_through_the_admin_and_the_read_api(superadmin, client_for):
    client = client_for(superadmin)
    client.post(reverse("careers:role_new"), {"title": "Example engineer (fixture)"})
    role = Role.objects.get(title="Example engineer (fixture)")
    body = client.get(reverse("careers:role", args=[role.pk])).content.decode()
    assert 'data-testid="role-problems"' in body and "Check whether salary information is required" in body
    response = client.post(
        reverse("careers:role", args=[role.pk]),
        _role_form(role, show_salary="on", salary_min="200", salary_max="100"),
    )
    assert response.status_code == 400
    response = client.post(
        reverse("careers:role", args=[role.pk]),
        _role_form(role, external_apply_url="http://example.test", apply_mode="external"),
    )
    assert response.status_code == 400
    assert client.post(reverse("careers:role", args=[role.pk]), _role_form(role)).status_code == 302
    client.post(reverse("careers:role_action", args=[role.pk, "open"]))
    role.refresh_from_db()
    assert role.status == RoleStatus.OPEN and role.published_snapshot["title"] == "Example engineer (fixture)"
    assert public.careers_page()["total"] == 1
    assert SyncEvent.objects.filter(entity_id=str(role.pk), action="role.opened").exists()
    # Edits stay private until Publish changes.
    client.post(
        reverse("careers:role", args=[role.pk]), _role_form(role, title="Example engineer, renamed (fixture)")
    )
    assert public.role_detail(role.published_slug)["title"] == "Example engineer (fixture)"
    client.post(reverse("careers:role_action", args=[role.pk, "publish"]))
    assert public.role_detail(role.published_slug)["title"] == "Example engineer, renamed (fixture)"
    client.post(reverse("careers:role_action", args=[role.pk, "pause"]))
    assert public.role_detail(role.published_slug) is None
    assert SyncEvent.objects.filter(entity_id=str(role.pk), action="role.paused", kind="remove").exists()
    client.post(reverse("careers:role_action", args=[role.pk, "reopen"]))
    client.post(reverse("careers:role_action", args=[role.pk, "close"]))
    closed = public.role_detail(role.published_slug)
    assert closed["state"] == "closed"
    assert public.careers_page()["total"] == 0
    client.post(reverse("careers:role_action", args=[role.pk, "archive"]))
    assert public.role_detail(role.published_slug) is None
    actions = set(AuditEvent.objects.filter(entity_id=str(role.pk)).values_list("action", flat=True))
    assert {
        "careers.role_opened",
        "careers.role_changes_published",
        "careers.role_paused",
        "careers.role_reopened",
        "careers.role_closed",
        "careers.role_archived",
    } <= actions


def test_render_warnings_block_opening(superadmin, monkeypatch):
    from apps.careers import services

    role = make_role("Example role (fixture)", status="draft")
    warning = {"code": "h1_in_body", "message": "The body has an H1 heading.", "blocking": True}
    monkeypatch.setattr(
        render, "render", lambda md, context="post": render.RenderResult(True, "<p>x</p>", [], 0, [warning])
    )
    with pytest.raises(Exception, match="H1"):
        services.open_role(role, superadmin)
    monkeypatch.setattr(
        render, "render", lambda md, context="post": render.RenderResult.unavailable("timeout")
    )
    with pytest.raises(Exception, match="unavailable"):
        services.open_role(role, superadmin)


def test_role_preview_panel_and_frame(world, superadmin, client_for):
    client = client_for(superadmin)
    panel = client.get(reverse("careers:role_preview_panel", args=[world["role"].pk])).content.decode()
    assert "sandbox" in panel
    frame = client.get(reverse("careers:role_preview_frame", args=[world["role"].pk]))
    assert (
        "sandbox" in frame["Content-Security-Policy"] and "script-src" not in frame["Content-Security-Policy"]
    )
    assert "<script" not in frame.content.decode() and "About the role" in frame.content.decode()


def test_application_detail_marks_seen_and_escapes_the_cover_note(world, superadmin, client_for):
    client = client_for(superadmin)
    application = world["application"]
    assert client.get(reverse("careers:badge")).content.decode().count("careers-badge") == 1
    body = client.get(reverse("careers:application", args=[application.pk])).content.decode()
    assert "&lt;b&gt;bold&lt;/b&gt;" in body and "<b>bold</b>" not in body
    assert (
        "Candidate emails are off. Reply from your own mailbox." in body
        and "mailto:candidate@example.test" in body
    )
    application.refresh_from_db()
    assert application.seen_at is not None
    assert "careers-badge" not in client.get(reverse("careers:badge")).content.decode()


def test_stage_notes_assignment_and_cv_download(world, superadmin, client_for):
    client = client_for(superadmin)
    application = world["application"]
    client.post(reverse("careers:application_action", args=[application.pk, "stage"]), {"stage": "rejected"})
    application.refresh_from_db()
    assert application.stage == "rejected" and application.decided_at is not None
    client.post(reverse("careers:application_action", args=[application.pk, "stage"]), {"stage": "interview"})
    application.refresh_from_db()
    assert application.decided_at is None
    client.post(
        reverse("careers:application_action", args=[application.pk, "note"]),
        {"body": "Example note (fixture)"},
    )
    client.post(
        reverse("careers:application_action", args=[application.pk, "assign"]),
        {"assignee": str(superadmin.pk)},
    )
    application.refresh_from_db()
    assert application.notes.count() == 1 and application.assigned_admin == superadmin
    response = client.get(reverse("careers:application_cv", args=[application.pk]))
    assert response.status_code == 200
    assert (
        response["Content-Disposition"].startswith("attachment;")
        and "Example CV.pdf" in response["Content-Disposition"]
    )
    assert b"".join(response.streaming_content).startswith(b"%PDF-")
    types = list(ApplicationEvent.objects.filter(application=application).values_list("type", flat=True))
    assert (
        types.count("cv_viewed") == 1
        and "stage_changed" in types
        and "note_added" in types
        and "assigned" in types
    )


def test_cv_download_on_object_storage_is_a_short_signed_url(world, superadmin, client_for, monkeypatch):
    calls = {}

    class FakeS3:
        querystring_auth = True

        def url(self, name, parameters=None, expire=None):
            calls.update(name=name, parameters=parameters, expire=expire)
            return "https://r2.example.test/signed-cv"

    monkeypatch.setitem(storages._storages, "careers_cvs", FakeS3())
    response = client_for(superadmin).get(reverse("careers:application_cv", args=[world["application"].pk]))
    assert response.status_code == 302 and response["Location"] == "https://r2.example.test/signed-cv"
    assert calls["expire"] == 60 and calls["parameters"]["ResponseContentDisposition"].startswith(
        "attachment;"
    )


def test_delete_removes_the_row_and_the_cv_and_audits_a_hashed_id(world, superadmin, client_for):
    application = world["application"]
    key = application.cv_path
    client_for(superadmin).post(reverse("careers:application_action", args=[application.pk, "delete"]))
    assert not Application.objects.filter(pk=application.pk).exists()
    assert not storages["careers_cvs"].exists(key)
    event = AuditEvent.objects.get(action="careers.application_deleted")
    assert event.entity_id == hashed_id(application.pk) and str(application.pk) not in event.entity_id


def test_application_list_filters_and_neighbours(world, superadmin, client_for):
    role = world["role"]
    second = make_application(role, name="Example Second", email="second@example.test")
    Application.objects.filter(pk=second.pk).update(duplicate_of=world["application"])
    client = client_for(superadmin)
    body = client.get(reverse("careers:applications") + "?q=second").content.decode()
    assert "Example Second" in body and "Example Candidate" not in body and "Duplicate" in body
    body = client.get(reverse("careers:applications") + f"?tab=all&role={role.pk}").content.decode()
    assert "Example Second" in body and "Example Candidate" in body
    detail = client.get(reverse("careers:application", args=[second.pk]) + "?tab=all").content.decode()
    assert 'rel="next"' in detail


def test_settings_page_saves_and_emits(world, superadmin, client_for):
    client = client_for(superadmin)
    response = client.post(
        reverse("careers:settings"),
        {
            "action": "settings",
            "heading": "Example heading.",
            "intro": "Example intro.",
            "values": "One\nTwo",
            "statements": "Example statement.",
            "empty_state": "Example empty.",
            "associates_line": "Example associates.",
            "retention_months": "6",
            "privacy_notice_url": "/legal/privacy",
            "notification_recipients": [str(superadmin.pk)],
        },
    )
    assert response.status_code == 302
    page = public.careers_page()
    assert page["copy"]["heading"] == "Example heading." and page["copy"]["values"] == ["One", "Two"]
    assert page["copy"]["privacyNoticeUrl"] == "/legal/privacy"
    assert SyncEvent.objects.filter(action="careers_settings.updated").exists()
    assert AuditEvent.objects.filter(action="careers.settings_updated").exists()
    response = client.post(
        reverse("careers:settings"),
        {
            "action": "section",
            "enabled": "on",
            "heading": "Example H.",
            "intro": "Example I.",
            "count": "2",
            "when_no_roles": "show_message",
        },
    )
    assert response.status_code == 302
    assert SiteSection.objects.get(key="home_careers").config["count"] == 2
    assert SyncEvent.objects.filter(action="home_section.updated").exists()
    bad = client.post(
        reverse("careers:settings"),
        {
            "action": "settings",
            "heading": "",
            "intro": "x",
            "empty_state": "x",
            "associates_line": "x",
            "retention_months": "99",
        },
    )
    assert bad.status_code == 400
    client.post(
        reverse("careers:settings"),
        {
            "action": "emails",
            "email_receipt_subject": "Example receipt for {role}",
            "email_receipt_body": "Hello {name}.",
            "email_rejection_subject": "x",
            "email_rejection_body": "x",
            "email_invitation_subject": "x",
            "email_invitation_body": "x",
        },
    )
    preview = client.get(reverse("careers:email_preview", args=["receipt"]))
    assert "Example receipt for Example role (fixture)" in preview.content.decode()
    assert "sandbox" in preview["Content-Security-Policy"]
    live = client.post(
        reverse("careers:settings_preview"),
        {
            "enabled": "on",
            "heading": "Live careers heading",
            "intro": "i",
            "count": "3",
            "when_no_roles": "hide",
        },
        **HX,
    )
    assert (
        "Live careers heading" in live.content.decode() and "Example role (fixture)" in live.content.decode()
    )


def test_new_pages_have_unique_ids_and_labelled_controls(world, superadmin, client_for):
    """A cheap guard for the axe run in CI (e2e/a11y.py): no duplicate ids, every control labelled."""
    from collections import Counter

    from apps.insights.models import Post

    from .content_helpers import make_post

    post = make_post("Example post (fixture)", superadmin)
    client = client_for(superadmin)
    pages = [
        "/insights/posts/",
        "/insights/authors/",
        "/insights/topics/",
        "/insights/settings/",
        f"/insights/posts/{post.pk}/",
        "/careers/roles/",
        f"/careers/roles/{world['role'].pk}/",
        "/careers/applications/",
        f"/careers/applications/{world['application'].pk}/",
        "/careers/settings/",
        "/content/sync/",
        "/settings/content/",
    ]
    for url in pages:
        html = client.get(url).content.decode()
        ids = re.findall(r'\sid="([^"]+)"', html)
        duplicates = [value for value, count in Counter(ids).items() if count > 1]
        assert duplicates == [], (url, duplicates)
        labelled = set(re.findall(r'<label[^>]*for="([^"]+)"', html))
        for tag in re.findall(r"<(?:input|select|textarea)\b[^>]*>", html):
            if re.search(r'type="(hidden|submit|checkbox|radio)"', tag) or "aria-label" in tag:
                continue
            control_id = re.search(r'\sid="([^"]+)"', tag)
            assert control_id and control_id.group(1) in labelled, (url, tag[:120])
    assert Post.objects.count() == 1


@pytest.mark.django_db
def test_careers_settings_point_at_the_published_candidate_privacy_notice():
    """Migration 0004: the owner approved the candidate notice on 16 Oct 2026."""
    from apps.careers import config as careers_config

    config = careers_config.load()
    assert config["privacy_notice_url"] == "/legal/candidate-privacy"
    assert config["privacy_notice_version"] == "2026-10-careers"


@pytest.mark.django_db
def test_the_approved_equal_opportunities_statement_is_seeded_and_served():
    """Migration 0005 (owner approval, 16 Oct 2026); role pages show it (brief 6.2)."""
    from apps.careers import config as careers_config

    statement = careers_config.load()["equal_opportunities"]
    assert statement.startswith("Vitalos welcomes applications from everyone.")
    assert "Equality Act 2010" in statement and "support@vitalos.co.uk" in statement
