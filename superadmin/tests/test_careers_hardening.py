"""Security review fixes on the Careers side: deletion order and storage failures, a resilient daily
tick, single-line candidate fields, hashed audit ids, per-IP caps and the presigned PUT."""

import json
import uuid
from datetime import timedelta
from urllib.parse import parse_qsl, urlsplit

import pytest
from django.core import mail
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.careers import intake, retention
from apps.careers.models import Application, UploadTicket
from apps.content_sync import render
from apps.content_sync.models import TickState

from .content_helpers import WEB, configure, make_role, ok_render, open_site, pdf_bytes
from .test_careers_intake import TICKETS, _application, _put, _submit, _ticket, _uploaded

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _setup(settings, monkeypatch):
    configure(settings)
    settings.APP_BASE_URL = "https://admin.example.test"
    settings.CONTENT_IP_SALT = "example-salt-for-tests-" + "x" * 16
    monkeypatch.setattr(render, "render", ok_render)
    open_site()


@pytest.fixture
def role(superadmin):
    return make_role("Example role (fixture)", actor=superadmin)


class FailingStorage:
    """A storage whose deletes fail like botocore does (not an OSError)."""

    def __init__(self, real):
        self.real = real

    def delete(self, name):
        raise RuntimeError("botocore.exceptions.ClientError: example failure")

    def __getattr__(self, name):
        return getattr(self.real, name)


def _old_application(role, **fields):
    application = Application.objects.create(
        role=role,
        name="Example Candidate",
        email=f"{uuid.uuid4().hex[:8]}@example.test",
        right_to_work="yes",
        consent_at=timezone.now(),
        source="role_page",
        submission_id=uuid.uuid4(),
        stage="rejected",
        decided_at=timezone.now() - timedelta(days=400),
        **fields,
    )
    key = f"applications/{application.pk}/cv.pdf"
    storages["careers_cvs"].save(key, ContentFile(pdf_bytes()))
    Application.objects.filter(pk=application.pk).update(cv_path=key)
    return Application.objects.get(pk=application.pk)


# --- 1. Deletion order and storage failures ------------------------------------------------------


def test_storage_failure_keeps_the_row_and_the_loop_continues(superadmin, settings, monkeypatch):
    settings.RETENTION_ENFORCE = True
    role = make_role(actor=superadmin, status="closed")
    from apps.careers.models import Role

    Role.objects.filter(pk=role.pk).update(closed_at=timezone.now() - timedelta(days=400))
    first, second = _old_application(role), _old_application(role)
    real = storages["careers_cvs"]
    original_delete = real.delete
    calls = []

    def flaky_delete(name):
        calls.append(name)
        if name == first.cv_path:
            raise RuntimeError("example storage failure")
        return original_delete(name)

    monkeypatch.setattr(real, "delete", flaky_delete)
    assert retention.run() == 1
    assert Application.objects.filter(pk=first.pk).exists()  # row kept: the CV is never orphaned
    assert not Application.objects.filter(pk=second.pk).exists()
    assert len(calls) == 2


def test_a_missing_object_counts_as_deleted(superadmin):
    role = make_role(actor=superadmin)
    application = _old_application(role)
    storages["careers_cvs"].delete(application.cv_path)
    assert retention.delete_application(application) is True
    assert not Application.objects.filter(pk=application.pk).exists()


def test_admin_delete_shows_an_error_and_keeps_the_row(superadmin, client_for, monkeypatch):
    role = make_role(actor=superadmin)
    application = _old_application(role)
    monkeypatch.setitem(storages._storages, "careers_cvs", FailingStorage(storages["careers_cvs"]))
    response = client_for(superadmin).post(
        reverse("careers:application_action", args=[application.pk, "delete"]), follow=True
    )
    assert response.status_code == 200
    assert "could not be removed from storage" in response.content.decode()
    assert Application.objects.filter(pk=application.pk).exists()
    assert not AuditEvent.objects.filter(action="careers.application_deleted").exists()


def test_one_failing_daily_step_does_not_skip_the_other(superadmin, monkeypatch):
    from apps.careers import services
    from apps.content_sync import tick

    def broken(now=None):
        raise RuntimeError("example failure")

    purged = []
    monkeypatch.setattr(services, "run_retention", broken)
    monkeypatch.setattr(services, "purge_orphan_uploads", lambda now=None: purged.append(1) or 0)
    TickState.objects.filter(pk=1).update(last_daily_at=None)
    tick.run()
    state = TickState.load()
    assert purged == [1]
    assert state.last_result["retention"] == "error" and state.last_result["orphans"] == 0
    assert state.last_daily_at is None  # handed back, so the next tick retries
    monkeypatch.setattr(services, "run_retention", lambda now=None: 0)
    tick.run()
    assert TickState.load().last_daily_at is not None


def test_pending_uploads_are_purged_even_without_retention_enforce(superadmin, settings):
    assert settings.RETENTION_ENFORCE is False
    role = make_role(actor=superadmin)
    now = timezone.now()
    old = UploadTicket.objects.create(
        role=role,
        mode="fallback",
        mime="application/pdf",
        extension="pdf",
        size=8,
        filename="cv.pdf",
        key="pending/example-old.pdf",
        expires_at=now,
        created_at=now - timedelta(hours=25),
    )
    storages["careers_cvs"].save(old.key, ContentFile(b"%PDF-1.7"))
    assert retention.purge_uploads() == 1
    assert not UploadTicket.objects.exists() and not storages["careers_cvs"].exists(old.key)


def test_purge_keeps_a_ticket_whose_object_cannot_be_deleted(superadmin, monkeypatch):
    role = make_role(actor=superadmin)
    now = timezone.now()
    UploadTicket.objects.create(
        role=role,
        mode="fallback",
        mime="application/pdf",
        extension="pdf",
        size=8,
        filename="cv.pdf",
        key="pending/example-stuck.pdf",
        expires_at=now,
        created_at=now - timedelta(hours=25),
    )
    monkeypatch.setitem(storages._storages, "careers_cvs", FailingStorage(storages["careers_cvs"]))
    assert retention.purge_uploads() == 0
    assert UploadTicket.objects.count() == 1


# --- 3. Single-line candidate fields -------------------------------------------------------------


def test_header_and_line_injection_is_flattened(
    client: Client, role, settings, django_capture_on_commit_callbacks
):
    settings.EMAIL_TRANSPORT = "log"
    mail.outbox.clear()
    data = _application(
        role,
        _uploaded(client, role)["uploadId"],
        name="Example\r\nBcc: someone@example.test Candidate\x07",
        location="Example\nCity",
        phone="01\t23\x00",
        noticePeriod="One\r\nmonth",
        coverNote="Line one\r\nLine two\x07\x1b[31m",
    )
    with django_capture_on_commit_callbacks(execute=True):
        assert _submit(client, data).status_code == 201
    application = Application.objects.get()
    assert application.name == "Example Bcc: someone@example.test Candidate"
    assert application.location_text == "Example City" and application.phone == "01 23"
    assert application.notice_period == "One month"
    assert application.cover_note == "Line one\nLine two[31m"
    alert = [m for m in mail.outbox if "New application" in m.subject][0]
    assert "\nBcc:" not in alert.body and "Bcc" not in alert.subject


def test_single_line_helper():
    assert intake.single_line("a\r\n\tb c\x00 d") == "a b c d"
    assert intake.multi_line("a\r\nb\rc\x00") == "a\nb\nc"


# --- 6. Hashed application ids in audit rows -----------------------------------------------------


def test_no_audit_row_holds_a_raw_application_id(client: Client, role, superadmin, client_for):
    payload = json.loads(_submit(client, _application(role, _uploaded(client, role)["uploadId"])).content)
    application_id = payload["applicationId"]
    admin = client_for(superadmin)
    admin.post(reverse("careers:application_action", args=[application_id, "stage"]), {"stage": "reviewing"})
    admin.post(reverse("careers:application_action", args=[application_id, "note"]), {"body": "Example"})
    admin.get(reverse("careers:application_cv", args=[application_id]))
    rows = AuditEvent.objects.filter(action__startswith="careers.")
    assert rows.filter(entity_id=retention.hashed_id(application_id)).count() >= 4
    for row in rows:
        assert application_id not in json.dumps([row.entity_id, row.summary, row.metadata])


# --- 7. Per-IP caps ------------------------------------------------------------------------------


def _ticket_from(client, role, ip):
    body = json.dumps(
        {"roleSlug": role.published_slug, "filename": "cv.pdf", "size": 100, "mime": "application/pdf"}
    ).encode()
    from apps.content_sync import signing

    headers = signing.sign_headers("submit", "POST", TICKETS, body)
    extra = {f"HTTP_{k.upper().replace('-', '_')}": v for k, v in headers.items()}
    return client.post(
        TICKETS, data=body, content_type="application/json", HTTP_X_VITALOS_CLIENT_IP=ip, **extra
    )


def test_upload_tickets_are_capped_per_client_ip(client: Client, role):
    for _ in range(10):
        assert _ticket_from(client, role, "198.51.100.7").status_code == 201
    limited = _ticket_from(client, role, "198.51.100.7")
    assert limited.status_code == 429 and json.loads(limited.content) == {
        "errors": {"uploadId": "rate_limited"}
    }
    assert _ticket_from(client, role, "198.51.100.8").status_code == 201
    assert UploadTicket.objects.filter(ip_hash=intake.hash_ip("198.51.100.7")).count() == 10
    assert not UploadTicket.objects.filter(ip_hash="198.51.100.7").exists()
    assert _ticket(client, role).status_code == 201  # no header: no IP cap (the website always sends it)


def test_applications_are_capped_per_client_ip(client: Client, role):
    for index in range(5):
        data = _application(role, _uploaded(client, role)["uploadId"], email=f"example{index}@example.test")
        assert _submit(client, data).status_code == 201
    data = _application(role, _uploaded(client, role)["uploadId"], email="example9@example.test")
    limited = _submit(client, data)
    assert limited.status_code == 429 and json.loads(limited.content) == {"errors": {"email": "rate_limited"}}
    other = _application(role, data["uploadId"], email="example9@example.test", clientIp="203.0.113.99")
    assert _submit(client, other).status_code == 201


# --- 4. The presigned PUT binds the length and type ----------------------------------------------


def test_presigned_put_signs_content_length_and_type(monkeypatch):
    from storages.backends.s3 import S3Storage

    storage = S3Storage(
        bucket_name="example-cvs",
        endpoint_url="https://example-account.r2.cloudflarestorage.com",
        access_key="AKIAEXAMPLEEXAMPLE",
        secret_key="example-secret-key-not-real-example-secret",
        region_name="auto",
        signature_version="s3v4",
    )
    monkeypatch.setitem(storages._storages, "careers_cvs", storage)
    url = intake.presign_put("pending/example.pdf", "application/pdf", 12345)
    query = dict(parse_qsl(urlsplit(url).query))
    assert set(query["X-Amz-SignedHeaders"].split(";")) >= {"content-length", "content-type", "host"}
    assert query["X-Amz-Expires"] == "600"


def test_fallback_upload_still_requires_the_exact_size(client: Client, role):
    ticket = json.loads(_ticket(client, role, size=500).content)
    assert _put(client, ticket["uploadUrl"], pdf_bytes(499), origin=WEB).status_code == 400
