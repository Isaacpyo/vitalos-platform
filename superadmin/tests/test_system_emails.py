"""Super Admin system emails on the shared layout: password link and careers hiring alerts (docs/email)."""

import pytest
from django.test import RequestFactory

from apps.accounts import services as accounts


@pytest.fixture
def reset_ready(settings):
    settings.APP_BASE_URL = "https://admin.example.test"
    settings.PASSWORD_RESET_ENABLED = True


def test_password_email_is_on_the_layout(make_user, mailoutbox, reset_ready):
    user = make_user(email="alex@example.test")
    assert accounts.request_password_reset("alex@example.test", RequestFactory().post("/"))
    sent = mailoutbox[0]
    assert sent.subject == "Set your Vitalos Super Admin password" and sent.to == [user.email]
    assert sent.extra_headers["Auto-Submitted"] == "auto-generated"
    assert sent.extra_headers["X-Vitalos-Notification"] == "accounts.password-link"
    html = sent.alternatives[0][0]
    assert "Set your password</h1>" in html and ">Set a new password</a>" in html
    assert "30 minutes, works once" in html and "If this was not you" in html
    link = next(line for line in sent.body.splitlines() if line.startswith("Set a new password: "))
    assert link.startswith("Set a new password: https://admin.example.test/account/set-password/")
    assert "If the button does not work, open this link: https://admin.example.test/" in sent.body
    assert all(part.get_content_disposition() == "inline" for part in sent.attachments)


def test_password_email_never_goes_to_unknown_addresses(db, mailoutbox, reset_ready):
    assert not accounts.request_password_reset("nobody@example.test", RequestFactory().post("/"))
    assert mailoutbox == []


def test_careers_alert_lists_each_application_and_flags_duplicates(db, settings):
    import uuid
    from types import SimpleNamespace

    from django.utils import timezone

    from apps.careers.alerts import alert_email
    from apps.mailer import layout

    settings.APP_BASE_URL = "https://admin.example.test"
    rows = [
        SimpleNamespace(
            pk=uuid.uuid4(), name="Alex Example", created_at=timezone.now(), duplicate_of_id=None
        ),
        SimpleNamespace(pk=uuid.uuid4(), name="Sam Example", created_at=timezone.now(), duplicate_of_id=1),
    ]
    subject, doc = alert_email(rows, "Example role")
    assert subject == "2 new applications: Example role"
    text = layout.render_email(doc).text
    assert "Alex Example\nReceived " in text and "[Possible duplicate] Sam Example" in text
    assert f"https://admin.example.test/careers/applications/{rows[0].pk}/" in text
    assert "Open applications: https://admin.example.test/careers/applications/" in text


def test_inline_images_and_files_nest_as_mixed_related_alternative(db):
    from apps.mailer import layout
    from apps.mailer.messages import build_message

    doc = {
        "title": "T",
        "preheader": "P",
        "headerLabel": "Test",
        "blocks": [],
        "footer": {"social": [], "company": {}},
    }
    mime = build_message(
        layout.render_email(doc),
        subject="T",
        to=["alex@example.test"],
        from_email="Vitalos <notifications@vitalos.co.uk>",
        attachments=[("note.txt", b"hello", "text/plain")],
    ).message()
    assert mime.get_content_type() == "multipart/mixed"
    related, note = list(mime.iter_parts())
    assert related.get_content_type() == "multipart/related" and note.get_filename() == "note.txt"
    alternative, logo = list(related.iter_parts())
    assert [p.get_content_type() for p in alternative.iter_parts()] == ["text/plain", "text/html"]
    assert logo["Content-ID"] == "<vitalos-logo>" and logo.get_content_disposition() == "inline"
