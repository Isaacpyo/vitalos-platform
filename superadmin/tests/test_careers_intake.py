"""Application intake (amendment A9, ADR-041): upload tickets, the fallback upload target and applications,
plus the hiring-team alerts and candidate emails they trigger. Every candidate here is fictional."""

import json
import uuid
from datetime import timedelta

import pytest
from django.core import mail
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.test import Client
from django.utils import timezone

from apps.careers import alerts, intake
from apps.careers.models import Application, CareersAlertEmail, Role, UploadTicket
from apps.content_sync import render
from apps.notifications.models import Notification

from .content_helpers import (
    DOCX_MIME,
    PDF_MIME,
    WEB,
    Contract,
    configure,
    docx_bytes,
    make_role,
    ok_render,
    open_site,
    pdf_bytes,
    signed_post,
    zip_bytes,
)

pytestmark = pytest.mark.django_db
TICKETS = "/api/careers/v1/upload-tickets"
APPLICATIONS = "/api/careers/v1/applications"


@pytest.fixture(autouse=True)
def _setup(settings, monkeypatch):
    configure(settings)
    settings.APP_BASE_URL = "https://admin.example.test"
    settings.CONTENT_IP_SALT = "example-salt-for-tests"
    monkeypatch.setattr(render, "render", ok_render)
    open_site()


@pytest.fixture
def role(superadmin):
    return make_role("Example role (fixture)", actor=superadmin)


@pytest.fixture
def contract():
    return Contract()


def _ticket(client, role, *, mime=PDF_MIME, size=2048, filename="Example CV.pdf"):
    body = json.dumps(
        {"roleSlug": role.published_slug, "filename": filename, "size": size, "mime": mime}
    ).encode()
    return signed_post(client, TICKETS, body, scope="submit")


def _put(client, url, data, *, mime=PDF_MIME, origin=WEB, **extra):
    path = url.replace("https://admin.example.test", "")
    headers = {"HTTP_ORIGIN": origin} if origin else {}
    return client.put(path, data=data, content_type=mime, **headers, **extra)


def _uploaded(client, role, data=None, mime=PDF_MIME, filename="Example CV.pdf"):
    data = data if data is not None else pdf_bytes()
    ticket = json.loads(_ticket(client, role, mime=mime, size=len(data), filename=filename).content)
    assert _put(client, ticket["uploadUrl"], data, mime=mime).status_code == 204
    return ticket


def _application(role, upload_id, **changes):
    data = {
        "submissionId": str(uuid.uuid4()),
        "roleSlug": role.published_slug,
        "uploadId": upload_id,
        "name": "Example Candidate",
        "email": "candidate@example.test",
        "phone": "",
        "location": "Example City",
        "linkedinUrl": "https://www.linkedin.com/in/example",
        "portfolioUrl": "",
        "rightToWork": "yes",
        "noticePeriod": "One month",
        "coverNote": "Example cover note (fixture). <script>alert(1)</script>",
        "consent": True,
        "noticeVersion": "2026-10",
        "source": "role_page",
        "clientIp": "203.0.113.7",
        "userAgent": "Example browser",
    }
    data.update(changes)
    return data


def _submit(client, data):
    return signed_post(client, APPLICATIONS, json.dumps(data).encode(), scope="submit")


# --- Upload tickets ------------------------------------------------------------------------------


def test_fallback_ticket(client: Client, role, contract):
    response = _ticket(client, role)
    assert response.status_code == 201 and response["Cache-Control"] == "no-store"
    data = json.loads(response.content)
    assert contract.errors(contract.component("UploadTicket"), data) == []
    assert data["uploadUrl"].startswith(
        f"https://admin.example.test/api/careers/v1/uploads/{data['uploadId']}?token="
    )
    assert data["method"] == "PUT" and data["headers"] == {"Content-Type": PDF_MIME}
    ticket = UploadTicket.objects.get(pk=data["uploadId"])
    assert ticket.key == f"pending/{ticket.pk}.pdf" and ticket.filename == "Example CV.pdf"
    token = data["uploadUrl"].split("token=")[1]
    assert token not in ticket.token_hash and len(ticket.token_hash) == 64


def test_bucket_ticket_is_a_presigned_put(client: Client, role, settings, monkeypatch):
    settings.CAREERS_CV_BUCKET = "example-cvs"
    calls = []

    def fake_presign(key, mime, size):
        calls.append((key, mime, size))
        return f"https://r2.example.test/example-cvs/{key}?X-Amz-Signature=example"

    monkeypatch.setattr(intake, "presign_put", fake_presign)
    data = json.loads(_ticket(client, role, mime=DOCX_MIME, size=4096, filename="cv.docx").content)
    assert calls == [(f"pending/{data['uploadId']}.docx", DOCX_MIME, 4096)]
    assert data["uploadUrl"].startswith("https://r2.example.test/")
    assert UploadTicket.objects.get(pk=data["uploadId"]).mode == "bucket"


def test_presign_uses_the_private_bucket_with_exact_type_and_length(settings, monkeypatch):
    seen = {}

    class FakeClient:
        def generate_presigned_url(self, operation, Params, ExpiresIn, HttpMethod):  # noqa: N803
            seen.update(operation=operation, params=Params, expires=ExpiresIn, method=HttpMethod)
            return "https://r2.example.test/signed"

    class FakeStorage:
        bucket_name = "example-cvs"
        connection = type("C", (), {"meta": type("M", (), {"client": FakeClient()})()})()

    monkeypatch.setitem(storages._storages, "careers_cvs", FakeStorage())
    assert intake.presign_put("pending/x.pdf", PDF_MIME, 123) == "https://r2.example.test/signed"
    assert seen == {
        "operation": "put_object",
        "params": {
            "Bucket": "example-cvs",
            "Key": "pending/x.pdf",
            "ContentType": PDF_MIME,
            "ContentLength": 123,
        },
        "expires": 600,
        "method": "PUT",
    }


def test_production_without_a_bucket_refuses_tickets(client: Client, role, settings):
    settings.CAREERS_CV_STORAGE_ENABLED = False
    response = _ticket(client, role)
    assert response.status_code == 503
    assert json.loads(response.content) == {"errors": {"uploadId": "upload_missing"}}
    assert not UploadTicket.objects.exists()


@pytest.mark.parametrize(
    ("changes", "field", "code"),
    [
        ({"mime": "application/x-msdownload"}, "mime", "upload_type"),
        ({"size": 11 * 1024 * 1024}, "size", "upload_size"),
        ({"filename": "cv.exe"}, "filename", "upload_type"),
        ({"size": 0}, "size", "invalid"),
    ],
)
def test_ticket_validation(client: Client, role, contract, changes, field, code):
    body = {"roleSlug": role.published_slug, "filename": "cv.pdf", "size": 100, "mime": PDF_MIME, **changes}
    response = signed_post(client, TICKETS, json.dumps(body).encode(), scope="submit")
    assert response.status_code == 400
    data = json.loads(response.content)
    assert data["errors"][field] == code
    assert contract.errors(contract.component("ApplicationErrors"), data) == []


def test_ticket_for_a_role_not_taking_applications(client: Client, superadmin):
    closed = make_role("Example closed (fixture)", actor=superadmin, status="closed")
    external = make_role(
        "Example external (fixture)",
        actor=superadmin,
        apply_mode="external",
        external_apply_url="https://example.test/apply",
    )
    for role in (closed, external):
        response = _ticket(client, role)
        assert response.status_code == 409 and json.loads(response.content) == {
            "errors": {"roleSlug": "role_closed"}
        }


def test_tickets_need_a_submit_signature(client: Client, role, settings):
    body = json.dumps(
        {"roleSlug": role.published_slug, "filename": "cv.pdf", "size": 1, "mime": PDF_MIME}
    ).encode()
    assert signed_post(client, TICKETS, body, scope="read").status_code == 401
    assert client.post(TICKETS, data=body, content_type="application/json").status_code == 401
    settings.CAREERS_SUBMIT_CLIENT_KEYS = ""
    assert client.post(TICKETS, data=body, content_type="application/json").status_code == 503


# --- Fallback uploads ----------------------------------------------------------------------------


def test_pdf_and_docx_uploads_are_stored_once(client: Client, role):
    ticket = json.loads(_ticket(client, role, size=len(pdf_bytes())).content)
    response = _put(client, ticket["uploadUrl"], pdf_bytes())
    assert response.status_code == 204 and response["Access-Control-Allow-Origin"] == WEB
    stored = UploadTicket.objects.get(pk=ticket["uploadId"])
    assert storages["careers_cvs"].exists(stored.key) and stored.uploaded_at
    assert _put(client, ticket["uploadUrl"], pdf_bytes()).status_code == 403  # reused
    data = docx_bytes()
    docx = json.loads(_ticket(client, role, mime=DOCX_MIME, size=len(data), filename="cv.docx").content)
    assert _put(client, docx["uploadUrl"], data, mime=DOCX_MIME).status_code == 204


@pytest.mark.parametrize(
    ("data", "mime", "filename"),
    [
        (b"MZ\x90\x00" + b"\x00" * 200, PDF_MIME, "cv.pdf"),  # a renamed EXE
        (zip_bytes(["readme.txt"]), DOCX_MIME, "cv.docx"),  # a ZIP that is not a Word document
        (b"%PDF-1.7 but declared as Word", DOCX_MIME, "cv.docx"),
    ],
)
def test_wrong_file_contents_are_refused(client: Client, role, data, mime, filename):
    ticket = json.loads(_ticket(client, role, mime=mime, size=len(data), filename=filename).content)
    response = _put(client, ticket["uploadUrl"], data, mime=mime)
    assert response.status_code == 400
    assert not storages["careers_cvs"].exists(UploadTicket.objects.get(pk=ticket["uploadId"]).key)


def test_size_rules(client: Client, role):
    ticket = json.loads(_ticket(client, role, size=4000).content)
    assert _put(client, ticket["uploadUrl"], pdf_bytes(3000)).status_code == 400  # not the declared size
    url = ticket["uploadUrl"].replace("https://admin.example.test", "")
    response = client.put(
        url,
        data=pdf_bytes(4000),
        content_type=PDF_MIME,
        HTTP_ORIGIN=WEB,
        CONTENT_LENGTH=str(11 * 1024 * 1024),
    )
    assert response.status_code == 413


def test_wrong_token_type_and_expiry(client: Client, role):
    ticket = json.loads(_ticket(client, role).content)
    base, _ = ticket["uploadUrl"].split("token=")
    assert _put(client, base + "token=wrong", pdf_bytes()).status_code == 403
    assert _put(client, ticket["uploadUrl"], pdf_bytes(), mime="text/plain").status_code == 400
    UploadTicket.objects.filter(pk=ticket["uploadId"]).update(
        expires_at=timezone.now() - timedelta(seconds=1)
    )
    assert _put(client, ticket["uploadUrl"], pdf_bytes()).status_code == 403


def test_cors_allows_only_the_website_origins(client: Client, role):
    ticket = json.loads(_ticket(client, role).content)
    path = ticket["uploadUrl"].replace("https://admin.example.test", "")
    preflight = client.options(path, HTTP_ORIGIN=WEB, HTTP_ACCESS_CONTROL_REQUEST_METHOD="PUT")
    assert preflight.status_code == 204
    assert (
        preflight["Access-Control-Allow-Origin"] == WEB and "PUT" in preflight["Access-Control-Allow-Methods"]
    )
    other = client.options(path, HTTP_ORIGIN="https://evil.example.test")
    assert other.status_code == 403 and "Access-Control-Allow-Origin" not in other
    assert (
        _put(client, ticket["uploadUrl"], pdf_bytes(), origin="https://evil.example.test").status_code == 403
    )


# --- Applications --------------------------------------------------------------------------------


def test_application_is_created_once_and_the_cv_moves(client: Client, role, contract, superadmin):
    ticket = _uploaded(client, role, filename="../../Example CV <final>.pdf")
    data = _application(role, ticket["uploadId"])
    response = _submit(client, data)
    assert response.status_code == 201
    payload = json.loads(response.content)
    assert contract.errors(contract.component("ApplicationAccepted"), payload) == []
    assert payload["roleTitle"] == "Example role (fixture)" and payload["process"] == ""
    application = Application.objects.get(pk=payload["applicationId"])
    assert application.cv_path == f"applications/{application.pk}/cv.pdf"
    assert application.cv_filename == "Example CV _final_.pdf"
    assert storages["careers_cvs"].exists(application.cv_path)
    assert not storages["careers_cvs"].exists(f"pending/{ticket['uploadId']}.pdf")
    assert UploadTicket.objects.get(pk=ticket["uploadId"]).consumed_at is not None
    # Idempotent by submissionId.
    again = _submit(client, data)
    assert again.status_code == 200 and json.loads(again.content) == payload
    assert Application.objects.count() == 1
    # The raw IP is never stored; the hash is a salted HMAC.
    assert application.ip_hash and len(application.ip_hash) == 64
    stored = " ".join(str(value) for value in Application.objects.values().get(pk=application.pk).values())
    assert "203.0.113.7" not in stored
    assert intake.hash_ip("203.0.113.7") == application.ip_hash


def test_upload_tickets_cannot_be_reused_for_a_second_application(client: Client, role):
    ticket = _uploaded(client, role)
    assert _submit(client, _application(role, ticket["uploadId"])).status_code == 201
    second = _submit(client, _application(role, ticket["uploadId"], email="other@example.test"))
    assert second.status_code == 422 and json.loads(second.content) == {
        "errors": {"uploadId": "upload_missing"}
    }


def test_missing_upload_and_bad_object(client: Client, role, settings):
    ticket = json.loads(_ticket(client, role).content)  # never uploaded
    response = _submit(client, _application(role, ticket["uploadId"]))
    assert response.status_code == 422
    settings.CAREERS_CV_BUCKET = "example-cvs"
    import apps.careers.intake as module

    module_presign = module.presign_put
    module.presign_put = lambda key, mime, size: "https://r2.example.test/signed"
    try:
        bucket = json.loads(_ticket(client, role, size=300).content)
        assert (
            _submit(client, _application(role, bucket["uploadId"])).status_code == 422
        )  # nothing in storage
        key = UploadTicket.objects.get(pk=bucket["uploadId"]).key
        storages["careers_cvs"].save(key, ContentFile(b"MZ" + b"\x00" * 298))
        response = _submit(client, _application(role, bucket["uploadId"]))
        assert (
            response.status_code == 422
            and json.loads(response.content)["errors"]["uploadId"] == "upload_type"
        )
    finally:
        module.presign_put = module_presign


def test_role_closed_between_ticket_and_submit(client: Client, role, superadmin):
    from apps.careers import services

    ticket = _uploaded(client, role)
    services.close_role(role, superadmin)
    response = _submit(client, _application(role, ticket["uploadId"]))
    assert response.status_code == 409 and json.loads(response.content) == {
        "errors": {"roleSlug": "role_closed"}
    }


@pytest.mark.parametrize(
    ("changes", "field", "code"),
    [
        ({"name": ""}, "name", "required"),
        ({"email": "not an email"}, "email", "invalid"),
        ({"coverNote": "x" * 3001}, "coverNote", "too_long"),
        ({"consent": False}, "consent", "required"),
        ({"rightToWork": "maybe"}, "rightToWork", "invalid"),
        ({"linkedinUrl": "javascript:alert(1)"}, "linkedinUrl", "invalid"),
    ],
)
def test_field_errors(client: Client, role, contract, changes, field, code):
    ticket = _uploaded(client, role)
    response = _submit(client, _application(role, ticket["uploadId"], **changes))
    assert response.status_code == 400
    data = json.loads(response.content)
    assert data["errors"][field] == code
    assert contract.errors(contract.component("ApplicationErrors"), data) == []
    assert not Application.objects.exists()


def test_duplicates_are_accepted_and_flagged_and_email_is_limited(client: Client, role):
    first = _submit(client, _application(role, _uploaded(client, role)["uploadId"]))
    second = _submit(
        client, _application(role, _uploaded(client, role)["uploadId"], email="Candidate@Example.test")
    )
    assert first.status_code == 201 and second.status_code == 201
    original = Application.objects.get(pk=json.loads(first.content)["applicationId"])
    duplicate = Application.objects.get(pk=json.loads(second.content)["applicationId"])
    assert duplicate.duplicate_of == original and original.duplicate_of is None
    assert _submit(client, _application(role, _uploaded(client, role)["uploadId"])).status_code == 201
    limited = _submit(client, _application(role, _uploaded(client, role)["uploadId"]))
    assert limited.status_code == 429 and json.loads(limited.content) == {"errors": {"email": "rate_limited"}}


def test_hiring_team_alerts_are_deduplicated_per_role(
    client: Client, role, superadmin, settings, make_user, django_capture_on_commit_callbacks
):
    from apps.accounts.roles import SUPERADMIN

    settings.EMAIL_TRANSPORT = "resend"  # outside the log transport only @vitalos.co.uk is emailed
    make_user(SUPERADMIN, email="hiring@vitalos.co.uk")
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        _submit(client, _application(role, _uploaded(client, role)["uploadId"]))
    with django_capture_on_commit_callbacks(execute=True):
        _submit(
            client,
            _application(
                role, _uploaded(client, role)["uploadId"], name="Example Second", email="second@example.test"
            ),
        )
    titles = list(Notification.objects.filter(kind=alerts.NOTIFICATION_KIND).values_list("title", flat=True))
    assert "Example Candidate applied for Example role (fixture)" in titles
    internal = [m for m in mail.outbox if m.to != ["candidate@example.test"]]
    assert len(internal) == 1 and internal[0].to == ["hiring@vitalos.co.uk"]
    assert (
        "Example Candidate" in internal[0].body
        and "https://admin.example.test/careers/applications/" in internal[0].body
    )
    assert "token" not in internal[0].body and "candidate@example.test" not in internal[0].body
    html = internal[0].alternatives[0][0]
    assert "New application: Example role (fixture)</h1>" in html and ">Review applications</a>" in html
    assert internal[0].extra_headers["X-Vitalos-Notification"] == "careers.application-alert"
    assert CareersAlertEmail.objects.count() == 1
    assert alerts.flush(timezone.now()) == 0  # the second application waits for the window
    sent = alerts.flush(timezone.now() + timedelta(minutes=11))
    assert sent == 1 and "Example Second" in mail.outbox[-1].body
    assert not Application.objects.filter(alert_emailed_at__isnull=True).exists()


def test_candidate_emails_are_never_sent_with_the_flag_off(
    client: Client, role, settings, django_capture_on_commit_callbacks
):
    assert settings.CAREERS_CANDIDATE_EMAILS_ENABLED is False
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        _submit(client, _application(role, _uploaded(client, role)["uploadId"]))
    assert not any("candidate@example.test" in m.to for m in mail.outbox)
    application = Application.objects.get()
    with pytest.raises(alerts.EmailsOff):
        alerts.send_candidate_email(application, "rejection", actor=None)
    assert not any("candidate@example.test" in m.to for m in mail.outbox)


def test_candidate_receipt_is_sent_when_the_flag_is_on(
    client: Client, role, settings, django_capture_on_commit_callbacks
):
    settings.CAREERS_CANDIDATE_EMAILS_ENABLED = True
    mail.outbox.clear()
    with django_capture_on_commit_callbacks(execute=True):
        _submit(client, _application(role, _uploaded(client, role)["uploadId"]))
    receipts = [m for m in mail.outbox if m.to == ["candidate@example.test"]]
    assert len(receipts) == 1 and receipts[0].subject == "Your application for Example role (fixture)"
    assert Application.objects.get().events.filter(type="email_sent").count() == 1


def test_closed_careers_section_takes_no_applications(client: Client, role):
    from apps.content_sync.models import SiteSettings

    SiteSettings.objects.filter(pk=1).update(careers_open=False)
    assert _ticket(client, role).status_code == 409
    assert Role.objects.count() == 1
