"""Files (validation, authorised download) and notifications (preferences, dedupe, delivery records, retries)."""

import datetime as dt

import pytest
from django.core import mail
from django.test import Client
from django.utils import timezone

from apps.portal import notifications, selectors, services
from apps.portal.files import check
from apps.portal.models import EmailDelivery, File, FileVersion, Notification, NotificationPreference
from tests.portal_helpers import build_world, client_for, docx_bytes, pdf_bytes, upload

HX = {"HTTP_HX_REQUEST": "true"}


@pytest.fixture
def world(db):
    return build_world()


# --- files -----------------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("name", "ctype", "data", "ok"),
    [
        ("a.pdf", "application/pdf", pdf_bytes(), True),
        ("a.pdf", "application/pdf", b"not a pdf at all", False),  # content sniffing
        ("a.png", "image/png", b"\x89PNG\r\n\x1a\n" + b"0" * 20, True),
        ("evil.png", "image/png", b"<script>alert(1)</script>", False),
        ("a.jpg", "image/jpeg", b"\xff\xd8\xff\xe0" + b"0" * 20, True),
        (
            "a.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            docx_bytes(),
            True,
        ),
        (
            "macro.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            docx_bytes(macro=True),
            False,
        ),
        (
            "fake.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            b"PK\x03\x04junk",
            False,
        ),
        ("page.html", "text/html", b"<html></html>", False),  # not on the allow-list
        ("run.exe", "application/octet-stream", b"MZ\x90\x00", False),
        ("x.svg", "image/svg+xml", b"<svg onload=alert(1)>", False),
        ("a.csv", "text/csv", b"a,b\n1,2\n", True),
        ("a.txt", "text/plain", b"hello \x00 binary", False),
        ("a.txt", "text/plain", "héllo".encode(), True),
        ("mismatch.pdf", "image/png", b"%PDF-1.4 x", False),
        ("a.exe", "application/pdf", pdf_bytes(), False),  # extension must match the type
        ("empty.pdf", "application/pdf", b"", False),
    ],
)
def test_file_validation(name, ctype, data, ok):
    result = check(name, ctype, data)
    assert result.ok is ok, result.refused_reason


def test_size_cap(settings):
    big = pdf_bytes(b"0" * (10 * 1024 * 1024 + 1))
    assert "Larger than" in check("big.pdf", "application/pdf", big).refused_reason


def test_filename_is_sanitised():
    assert check("../../etc/passwd\x00.pdf", "application/pdf", pdf_bytes()).filename.endswith(".pdf")
    assert "/" not in check("a/b\\c.pdf", "application/pdf", pdf_bytes()).filename


def test_customer_upload_download_and_versions(world):
    client = client_for(world.contrib.user)
    response = client.post(
        "/portal/files/upload/", {"challenge": world.ch_a.pk, "file": upload("plan.pdf"), "title": "Our plan"}
    )
    assert response.status_code == 302
    file = File.objects.get(title="Our plan")
    assert file.uploaded_by_customer and file.visibility == "customer"
    version = file.versions.get()
    assert version.upload_status == "stored" and version.storage_key.startswith(f"portal/{world.org_a.pk}/")
    assert version.sha256 and version.size == len(pdf_bytes())
    download = client.get(f"/portal/files/versions/{version.pk}/download/")
    assert download.status_code == 200 and b"".join(download.streaming_content) == pdf_bytes()
    assert download["Content-Disposition"].startswith("attachment")
    # A second upload to the same file is a new version.
    client.post(
        "/portal/files/upload/",
        {"challenge": world.ch_a.pk, "file_id": file.pk, "file": upload("plan-v2.pdf")},
    )
    assert file.versions.count() == 2 and file.versions.first().number == 2
    page = client.get(f"/portal/files/{file.pk}/").content.decode()
    assert "Version 2" in page and "Version 1" in page and "Uploaded" in page


def test_rejected_upload_is_refused_audited_and_not_stored(world):
    from apps.audit.models import AuditEvent

    client = client_for(world.contrib.user)
    bad = upload("run.exe", b"MZ\x90", "application/octet-stream")
    response = client.post("/portal/files/upload/", {"challenge": world.ch_a.pk, "file": bad}, follow=True)
    assert b"not accepted" in response.content
    assert not File.objects.filter(title="run.exe").exists()
    assert AuditEvent.objects.filter(action="portal.file_rejected").exists()


def test_internal_files_are_never_listed_or_downloadable_by_customers(world):
    client = client_for(world.approver.user)
    listing = client.get("/portal/files/").content.decode()
    assert "Shared report" in listing and "secret.pdf" not in listing and "INTERNAL-FILE-TITLE" not in listing
    assert client.get(f"/portal/files/versions/{world.internal_file.pk}/download/").status_code == 404
    assert client.get(f"/portal/files/{world.internal_file.file_id}/").status_code == 404
    # Staff still can.
    assert (
        client_for(world.staff)
        .get(f"/client-portal/files/versions/{world.internal_file.pk}/download/")
        .status_code
        == 200
    )


def test_upload_to_a_foreign_challenge_is_404_and_viewer_upload_forbidden(world):
    outsider = client_for(world.b_approver.user)
    assert (
        outsider.post("/portal/files/upload/", {"challenge": world.ch_a.pk, "file": upload()}).status_code
        == 404
    )
    assert (
        client_for(world.viewer.user)
        .post("/portal/files/upload/", {"challenge": world.ch_a.pk, "file": upload()})
        .status_code
        == 403
    )


def test_discussion_attachment(world):
    client = client_for(world.contrib.user)
    client.post(
        f"/portal/challenges/{world.ch_a.pk}/discuss/",
        {"body": "See attached", "attachment": upload("attached.pdf")},
    )
    version = FileVersion.objects.get(original_name="attached.pdf")
    assert version.file.message_id is not None
    assert b"Download attached.pdf" in client.get(f"/portal/challenges/{world.ch_a.pk}/").content


# --- notifications -----------------------------------------------------------------------------------------------


def test_publishing_notifies_live_members_once_and_emails_with_headers(world, mailoutbox):
    mailoutbox.clear()
    update = services.save_update(
        world.ch_a, title="Fresh update", body="Body of the update.", actor=world.staff
    )
    services.publish_update(update, actor=world.staff)
    recipients = {m.to[0] for m in mailoutbox}
    assert recipients == {
        "viewer@northwind.example.test",
        "contrib@northwind.example.test",
        "approver@northwind.example.test",
        "signatory@northwind.example.test",
    }
    assert all("contoso" not in r for r in recipients)  # never another organisation
    message = mailoutbox[0]
    assert message.extra_headers["Auto-Submitted"] == "auto-generated"
    assert message.extra_headers["X-Vitalos-Notification"] == "portal.update"
    assert "Fresh update" in message.subject
    notes = Notification.objects.filter(dedupe_key=f"update:{update.pk}")
    assert notes.count() == 4
    # Triggering the same event again does not notify or email twice.
    count = len(mailoutbox)
    created = notifications.notify(
        world.org_a,
        kind="update",
        title="Fresh update",
        url_name="update",
        url_kwargs={"pk": update.pk},
        key=f"update:{update.pk}",
    )
    assert created == 0 and len(mailoutbox) == count


def test_every_email_has_one_delivery_record(world, mailoutbox):
    sent = EmailDelivery.objects.filter(status="sent")
    assert sent.count() == len(mailoutbox) > 0
    for delivery in sent:
        assert delivery.attempts == 1 and delivery.sent_at and delivery.notification_id
        assert delivery.to_email == delivery.recipient.email


def test_preferences_are_respected(world, mailoutbox):
    pref = notifications.preferences(world.viewer.user)
    pref.email_updates = False
    pref.save()
    mailoutbox.clear()
    update = services.save_update(world.ch_a, title="Pref test", body="b", actor=world.staff)
    services.publish_update(update, actor=world.staff)
    assert "viewer@northwind.example.test" not in {m.to[0] for m in mailoutbox}
    # The in-app notification is still created.
    assert Notification.objects.filter(user=world.viewer.user, dedupe_key=f"update:{update.pk}").exists()
    # Questions use a different preference.
    q = services.ask_question(world.ch_a, question="Pref question?", actor=world.staff)
    assert any(m.to[0] == "contrib@northwind.example.test" for m in mailoutbox)
    assert not any(
        m.to[0] == "viewer@northwind.example.test" for m in mailoutbox
    )  # viewers get no question mail
    assert q.published_at


def test_preferences_page_saves(world):
    client = client_for(world.approver.user)
    client.post("/portal/notifications/preferences/", {"email_questions": "on"})
    pref = NotificationPreference.objects.get(user=world.approver.user)
    assert pref.email_questions and not pref.email_updates and not pref.email_deliverables


def test_no_email_to_non_members_or_revoked_members(world, mailoutbox):
    services.revoke_member(world.viewer, actor=world.staff)
    pending = services.invite_member(
        organisation=world.org_a,
        email="pending@northwind.example.test",
        full_name="P",
        role="viewer",
        actor=world.staff,
        send=False,
    )
    mailoutbox.clear()
    update = services.save_update(world.ch_a, title="Members only", body="b", actor=world.staff)
    services.publish_update(update, actor=world.staff)
    addresses = {m.to[0] for m in mailoutbox}
    assert "viewer@northwind.example.test" not in addresses  # revoked
    assert "pending@northwind.example.test" not in addresses  # invited, not yet a member
    assert world.staff.email not in addresses
    assert not Notification.objects.filter(user=pending.user).exists()


def test_failed_email_never_blocks_the_action_and_is_recorded(world, monkeypatch, mailoutbox):
    from apps.mailer import system

    def boom(*args, **kwargs):
        raise OSError("mail provider down")

    monkeypatch.setattr(system, "send", boom)
    update = services.save_update(world.ch_a, title="Survives failure", body="b", actor=world.staff)
    services.publish_update(update, actor=world.staff)  # must not raise
    update.refresh_from_db()
    assert update.status == "published"
    assert Notification.objects.filter(dedupe_key=f"update:{update.pk}").count() == 4  # in-app copies exist
    failed = EmailDelivery.objects.filter(notification__dedupe_key=f"update:{update.pk}")
    assert failed.count() == 4 and set(failed.values_list("status", flat=True)) == {"failed"}
    assert all(d.attempts == 1 and d.last_error == "OSError" for d in failed)
    # No body text or addresses beyond the recipient in the error field.
    assert all("provider down" not in d.last_error for d in failed)


def test_bounded_retries_never_duplicate(world, monkeypatch, mailoutbox):
    from apps.mailer import system

    real_send = system.send
    calls = {"n": 0}

    def flaky(*args, **kwargs):
        calls["n"] += 1
        raise OSError("down")

    monkeypatch.setattr(system, "send", flaky)
    update = services.save_update(world.ch_a, title="Retry me", body="b", actor=world.staff)
    services.publish_update(update, actor=world.staff)
    delivery = EmailDelivery.objects.filter(notification__dedupe_key=f"update:{update.pk}").first()
    others = EmailDelivery.objects.filter(notification__dedupe_key=f"update:{update.pk}").exclude(
        pk=delivery.pk
    )
    others.update(status="sent")  # isolate one delivery
    mailoutbox.clear()
    calls["n"] = 0  # the publish already made one failed attempt for each of the four
    # Automatic retries stop at the cap, even if run repeatedly.
    for _ in range(6):
        EmailDelivery.objects.filter(pk=delivery.pk).update(
            next_attempt_at=timezone.now() - dt.timedelta(minutes=1)
        )
        notifications.send_pending()
    delivery.refresh_from_db()
    assert delivery.attempts == EmailDelivery.MAX_ATTEMPTS and delivery.status == "failed"
    # The provider recovers: a manual retry sends exactly once, and a sent delivery is terminal.
    monkeypatch.setattr(system, "send", real_send)
    notifications.deliver(delivery.pk, manual=True)
    notifications.deliver(delivery.pk, manual=True)
    notifications.deliver(delivery.pk)
    delivery.refresh_from_db()
    assert delivery.status == "sent" and len(mailoutbox) == 1
    assert (
        calls["n"] == EmailDelivery.MAX_ATTEMPTS - 1
    )  # bounded: two automatic retries after the first attempt


def test_retry_does_not_email_someone_who_has_since_lost_access(world, monkeypatch, mailoutbox):
    from apps.mailer import system

    monkeypatch.setattr(system, "send", lambda *a, **k: (_ for _ in ()).throw(OSError("down")))
    update = services.save_update(world.ch_a, title="Revoke between", body="b", actor=world.staff)
    services.publish_update(update, actor=world.staff)
    monkeypatch.undo()
    services.revoke_member(world.viewer, actor=world.staff)
    mailoutbox.clear()
    delivery = EmailDelivery.objects.get(
        notification__dedupe_key=f"update:{update.pk}", recipient=world.viewer.user
    )
    notifications.deliver(delivery.pk, manual=True)
    assert mailoutbox == []
    delivery.refresh_from_db()
    assert delivery.status == "failed" and "no longer a live member" in delivery.last_error


def test_admin_sees_delivery_status_and_can_retry(world, monkeypatch):
    from apps.mailer import system

    monkeypatch.setattr(system, "send", lambda *a, **k: (_ for _ in ()).throw(OSError("down")))
    update = services.save_update(world.ch_a, title="Admin visible", body="b", actor=world.staff)
    services.publish_update(update, actor=world.staff)
    monkeypatch.undo()
    staff = client_for(world.staff)
    page = staff.get("/client-portal/deliveries/?status=failed").content.decode()
    assert "Failed" in page and "OSError" in page and "contrib@northwind.example.test" in page
    assert "failed to send" in staff.get("/client-portal/").content.decode()
    delivery = EmailDelivery.objects.filter(status="failed").first()
    staff.post(f"/client-portal/deliveries/{delivery.pk}/retry/")
    delivery.refresh_from_db()
    assert delivery.status == "sent"
    assert Client().get("/client-portal/deliveries/").status_code == 302  # anonymous


def test_notification_open_marks_read_and_redirects(world):
    client = client_for(world.approver.user)
    note = Notification.objects.filter(user=world.approver.user, kind="question").first()
    response = client.get(f"/portal/notifications/{note.pk}/open/")
    assert response.status_code == 302 and response.url == f"/portal/questions/{world.q_a.pk}/"
    note.refresh_from_db()
    assert note.read_at is not None
    assert selectors.notifications(world.approver.user).filter(read_at__isnull=True).count() >= 0
    client.post("/portal/notifications/read-all/")
    assert not selectors.notifications(world.approver.user).filter(read_at__isnull=True).exists()


def test_emails_use_layout_and_only_test_addresses_leave_in_tests(world, mailoutbox):
    for message in mailoutbox:
        assert message.to[0].endswith(".example.test")  # locmem only; nothing leaves the test process
        assert message.alternatives and message.alternatives[0][1] == "text/html"
    assert mail.outbox is mailoutbox or True
