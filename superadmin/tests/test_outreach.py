"""Mail > Outreach: Notion export import, the paced queue, the outreach mailbox only, and the tick."""

import io
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.mail.backends.locmem import EmailBackend
from django.core.management import call_command

from apps.accounts.roles import SUPERADMIN
from apps.audit.models import AuditEvent
from apps.content_sync import tick
from apps.email_templates.models import EmailSuppression, EmailTemplate
from apps.outreach import imports, services
from apps.outreach.models import Contact, OutreachSettings

LONDON = ZoneInfo("Europe/London")
# Tuesday 28 Oct 2026, 10:00 London (GMT): inside the sending window.
TUESDAY_10 = datetime(2026, 10, 28, 10, 0, tzinfo=LONDON)

NOTION_CSV = (
    "﻿Business,Contact name,Email,Entity type,Status,No website,Lead ID\n"
    'Ireland Dental Ltd,"Jamie Ireland, Elizabeth Ireland (directors)",info@ireland.test,Limited company,New,Yes,LEAD-1\n'
    "Allen Clinic Ltd,Helen Claire Allen (director),Helen@Allen.test,Limited company,New,No,LEAD-2\n"
    "Maini LLP,Dr Dinesh Kumar Maini (director),dinesh@maini.test,LLP,New,Yes,LEAD-3\n"
    "Solo Plumbing,Sam Solo,sam@solo.test,Sole trader / partnership,New,Yes,LEAD-4\n"
    "Unknown Cafe,,cafe@unknown.test,Unknown,New,Yes,LEAD-5\n"
    "Done Ltd,Dana Done (director),dana@done.test,Limited company,Contacted,Yes,LEAD-6\n"
    "No Email Ltd,Nora Null (director),,Limited company,New,Yes,LEAD-7\n"
    "Bad Email Ltd,Bob Bad (director),not-an-email,Limited company,New,Yes,LEAD-8\n"
    "Twice Ltd,Tom Twice (director),info@ireland.test,Limited company,New,Yes,LEAD-9\n"
    ",,,,,,\n"
)


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()


@pytest.fixture
def owner(make_user):
    return make_user(SUPERADMIN, email="owner@vitalos.co.uk", full_name="Temitope Agbola")


@pytest.fixture
def library(db, seeded):
    call_command("seed_email_templates", stdout=io.StringIO())
    return EmailTemplate.objects.all()


@pytest.fixture
def mailbox(settings, monkeypatch):
    """A configured outreach mailbox, delivering to Django's test outbox."""
    settings.EMAIL_TRANSPORT = "resend"
    settings.OUTREACH_SMTP_HOST = "smtp.example.test"
    settings.OUTREACH_SMTP_USER = "temitope@vitalos.co.uk"
    monkeypatch.setattr(services, "outreach_connection", EmailBackend)
    return settings


def _csv(text=NOTION_CSV, name="Vitalos Leads.csv"):
    return SimpleUploadedFile(name, text.encode("utf-8"), content_type="text/csv")


def _load(owner, **options):
    return services.import_contacts(_csv(), user=owner, **options)


def _running(owner, **fields):
    current = services.load_settings()
    current.paused, current.started_by = False, owner
    for name, value in fields.items():
        setattr(current, name, value)
    current.save()
    return current


# --- Import ------------------------------------------------------------------------------------------


def test_notion_export_is_filtered_deduplicated_and_named(db, owner, library):
    result = _load(owner)
    queued = {c.email: c for c in Contact.objects.all()}
    assert set(queued) == {"info@ireland.test", "helen@allen.test", "dinesh@maini.test"}
    assert result.added == 3 and result.total == 9
    assert result.skipped == {
        "Not a limited company, LLP or PLC": 2,
        "Status is not New": 1,
        "No email address": 1,
        "Not a valid email address": 1,
        "Listed twice in the file": 1,
    }
    # Several directors: no name, so "Hi there,". One director: their first name, titles dropped.
    assert queued["info@ireland.test"].first_name == ""
    assert queued["helen@allen.test"].first_name == "Helen"
    assert queued["dinesh@maini.test"].first_name == "Dinesh"
    assert queued["dinesh@maini.test"].lead_ref == "LEAD-3"
    assert queued["helen@allen.test"].business == "Allen Clinic Ltd"
    event = AuditEvent.objects.get(action="outreach.imported")
    assert "Queued 3 of 9" in event.summary and "@" not in event.summary


def test_no_website_filter_and_loading_again_skips_known_and_unsubscribed(db, owner, library):
    _load(owner, no_website_only=True)
    assert set(Contact.objects.values_list("email", flat=True)) == {"info@ireland.test", "dinesh@maini.test"}
    EmailSuppression.objects.create(email="helen@allen.test")
    again = _load(owner)
    assert again.added == 0
    assert again.skipped["Already loaded before"] == 2
    assert again.skipped["Unsubscribed from Vitalos email"] == 1


def test_corporate_filter_needs_the_entity_type_column(db, owner, library):
    text = "Business,Email\nA Ltd,a@a.test\n"
    with pytest.raises(Exception, match="no Entity type column"):
        services.import_contacts(_csv(text), user=owner)
    result = services.import_contacts(_csv(text), user=owner, corporate_only=False)
    assert result.added == 1


def test_xlsx_export_is_read(db, owner, library):
    from openpyxl import Workbook

    book = Workbook()
    sheet = book.active
    sheet.append(["Business", "Contact name", "Email", "Entity type", "Status"])
    sheet.append(["Excel Ltd", "Ada Lovelace (director)", "ada@excel.test", "Limited company", "New"])
    buffer = io.BytesIO()
    book.save(buffer)
    upload = SimpleUploadedFile("leads.xlsx", buffer.getvalue())
    assert services.import_contacts(upload, user=owner).added == 1
    assert Contact.objects.get().first_name == "Ada"


@pytest.mark.parametrize(
    ("name", "content", "message"),
    [
        ("leads.txt", b"Email\na@a.test\n", "as .csv"),
        ("leads.csv", b"Business\nA Ltd\n", "no Email column"),
        ("leads.xlsx", b"not a zip", "could not be read"),
        ("leads.csv", b"", "empty"),
    ],
)
def test_bad_files_are_refused(db, owner, library, name, content, message):
    with pytest.raises(Exception, match=message):
        services.import_contacts(SimpleUploadedFile(name, content), user=owner)


def test_large_files_are_refused(db, owner, monkeypatch):
    monkeypatch.setattr(imports, "MAX_ROWS", 2)
    text = "Email,Entity type\n" + "".join(f"p{n}@a.test,LLP\n" for n in range(3))
    with pytest.raises(Exception, match="more than 2 rows"):
        services.import_contacts(_csv(text), user=owner)


@pytest.mark.parametrize(
    ("contact", "expected"),
    [
        ("Helen Claire Allen (director)", "Helen"),
        ("Jamie Ireland, Elizabeth Ireland (directors)", ""),
        ("Ann & Bob Smith", ""),
        ("Teresa (from website email)", "Teresa"),
        ("Mr. Bob Jones", "Bob"),
        ("JOHN SMITH", "John"),
        ("", ""),
    ],
)
def test_first_name_from_contact_name(contact, expected):
    assert imports.first_name_from(contact) == expected


# --- Start, pause and settings -----------------------------------------------------------------------


def test_starts_paused_with_the_founder_template(db, owner, library):
    current = services.load_settings()
    assert current.paused and current.daily_cap == 15
    assert current.template.key == "outreach-small-business-free-plan"


def test_start_is_refused_on_resend_without_a_mailbox(db, owner, library, settings):
    settings.EMAIL_TRANSPORT, settings.OUTREACH_SMTP_HOST = "resend", ""
    with pytest.raises(Exception, match="No outreach mailbox"):
        services.start(user=owner)
    assert services.load_settings().paused


def test_start_and_pause_are_audited(db, owner, library, mailbox):
    services.start(user=owner)
    assert not services.load_settings().paused
    services.pause(user=owner)
    assert services.load_settings().paused
    actions = set(AuditEvent.objects.values_list("action", flat=True))
    assert {"outreach.started", "outreach.paused"} <= actions


def test_settings_accept_only_outreach_templates_and_a_sane_cap(db, owner, library):
    invoice = EmailTemplate.objects.get(key="invoice-sent")
    with pytest.raises(Exception, match="Choose an outreach template"):
        services.update_settings(user=owner, template_id=invoice.pk, daily_cap=10)
    template = services.default_template()
    with pytest.raises(Exception, match="between 1 and 50"):
        services.update_settings(user=owner, template_id=template.pk, daily_cap=500)
    assert services.update_settings(user=owner, template_id=template.pk, daily_cap=20).daily_cap == 20


# --- Pacing ------------------------------------------------------------------------------------------


def test_next_due_respects_pause_window_weekends_and_cap(db, owner, library):
    _load(owner)
    assert services.next_due(TUESDAY_10) is None  # paused
    current = _running(owner)
    assert services.next_due(TUESDAY_10, current) == TUESDAY_10
    early = TUESDAY_10.replace(hour=7)
    assert services.next_due(early, current) == TUESDAY_10.replace(hour=9)
    friday_evening = datetime(2026, 10, 30, 18, 0, tzinfo=LONDON)
    assert services.next_due(friday_evening, current) == datetime(2026, 11, 2, 9, 0, tzinfo=LONDON)
    saturday = datetime(2026, 10, 31, 11, 0, tzinfo=LONDON)
    assert services.next_due(saturday, current) == datetime(2026, 11, 2, 9, 0, tzinfo=LONDON)
    current.next_send_at = TUESDAY_10 + timedelta(minutes=5)
    assert services.next_due(TUESDAY_10, current) == TUESDAY_10 + timedelta(minutes=5)
    current.daily_cap = 1
    current.next_send_at = None
    Contact.objects.filter(email="helen@allen.test").update(status="sent", sent_at=TUESDAY_10)
    assert services.next_due(TUESDAY_10, current) == datetime(2026, 10, 29, 9, 0, tzinfo=LONDON)


def test_nothing_is_due_with_an_empty_queue(db, owner, library):
    assert services.next_due(TUESDAY_10, _running(owner)) is None


# --- Sending -----------------------------------------------------------------------------------------


def test_sends_one_email_through_the_mailbox_then_waits(db, owner, library, mailbox, mailoutbox):
    _load(owner)
    _running(owner)
    assert services.send_due(TUESDAY_10) == 1
    assert services.send_due(TUESDAY_10) == 0  # the gap
    [message] = mailoutbox
    first = Contact.objects.get(email="info@ireland.test")
    assert message.to == ["info@ireland.test"] and first.status == "sent" and first.sent_at == TUESDAY_10
    assert message.from_email == "Temitope Agbola <temitope@vitalos.co.uk>"
    assert message.reply_to == ["temitope@vitalos.co.uk"]
    assert message.subject == "A free one-page plan for your business"
    assert "Hi there," in message.body  # several directors: no name
    assert "/mail/unsubscribe/" in message.extra_headers["List-Unsubscribe"]
    assert "Auto-Submitted" not in message.extra_headers
    gap = services.load_settings().next_send_at - TUESDAY_10
    assert timedelta(minutes=3) <= gap <= timedelta(minutes=8)
    assert services.send_due(TUESDAY_10 + gap) == 1
    assert "Hi Helen," in mailoutbox[1].body
    event = AuditEvent.objects.filter(action="outreach.sent").first()
    assert "lead LEAD-" in event.summary and "@" not in event.summary


def test_nothing_is_sent_while_paused_or_outside_the_window(db, owner, library, mailbox, mailoutbox):
    _load(owner)
    assert services.send_due(TUESDAY_10) == 0
    _running(owner)
    assert services.send_due(TUESDAY_10.replace(hour=18)) == 0
    assert services.send_due(datetime(2026, 10, 31, 11, 0, tzinfo=LONDON)) == 0
    assert mailoutbox == []


def test_daily_cap_stops_the_day(db, owner, library, mailbox, mailoutbox):
    _load(owner)
    _running(owner, daily_cap=1)
    assert services.send_due(TUESDAY_10) == 1
    assert services.send_due(TUESDAY_10 + timedelta(hours=1)) == 0
    assert services.send_due(datetime(2026, 10, 29, 9, 30, tzinfo=LONDON)) == 1
    assert len(mailoutbox) == 2


def test_never_resend_and_never_through_resend(db, owner, library, settings, mailoutbox):
    """Without a mailbox on a live server the queue pauses itself rather than use Resend."""
    _load(owner)
    _running(owner)
    settings.EMAIL_TRANSPORT, settings.OUTREACH_SMTP_HOST = "resend", ""
    assert services.send_due(TUESDAY_10) == 0
    current = services.load_settings()
    assert current.paused and "No outreach mailbox" in current.last_error
    assert mailoutbox == [] and Contact.objects.filter(status="queued").count() == 3


def test_an_address_that_unsubscribed_after_loading_is_skipped(db, owner, library, mailbox, mailoutbox):
    _load(owner)
    _running(owner)
    EmailSuppression.objects.create(email="info@ireland.test")
    assert services.send_due(TUESDAY_10) == 0
    assert Contact.objects.get(email="info@ireland.test").status == "removed"
    assert mailoutbox == []


def test_three_failures_in_a_row_pause_the_queue(db, owner, library, mailbox, monkeypatch):
    class Broken(EmailBackend):
        def send_messages(self, messages):
            raise OSError("mailbox refused")

    monkeypatch.setattr(services, "outreach_connection", Broken)
    _load(owner)
    _running(owner)
    now = TUESDAY_10
    for _ in range(3):
        assert services.send_due(now) == 0
        now = services.load_settings().next_send_at
    current = services.load_settings()
    assert current.paused and "3 failed sends" in current.last_error
    assert Contact.objects.filter(status="failed").count() == 3


def test_the_content_tick_sends_and_reports_outreach_as_due(db, owner, library, mailbox, mailoutbox):
    _load(owner)
    _running(owner)
    assert tick.next_due_at(TUESDAY_10) == TUESDAY_10
    tick.run(TUESDAY_10)
    assert len(mailoutbox) == 1


# --- Page --------------------------------------------------------------------------------------------


def test_page_is_superadmin_only(client_for, viewer, lead):
    for user in (viewer, lead):
        client = client_for(user)
        assert client.get("/mail/outreach/").status_code == 403
        assert client.post("/mail/outreach/start/").status_code == 403
        assert client.post("/mail/outreach/upload/").status_code == 403


def test_page_loads_and_upload_queues(client_for, owner, library, settings):
    settings.EMAIL_TRANSPORT, settings.OUTREACH_SMTP_HOST = "resend", ""
    client = client_for(owner)
    page = client.get("/mail/outreach/").content.decode()
    assert "Load leads from Notion" in page and 'data-testid="outreach-no-mailbox"' in page
    assert "disabled" in page.split('data-testid="outreach-start"')[1].split(">")[0]
    response = client.post(
        "/mail/outreach/upload/", {"file": _csv(), "corporate_only": "on", "only_new": "on"}, follow=True
    )
    body = response.content.decode()
    assert "Queued 3 of 9" in body and body.count('data-testid="queued-row"') == 3
    assert "Hi Helen," in body and "Hi there," in body
    assert client.post("/mail/outreach/start/", follow=True).status_code == 200
    assert services.load_settings().paused


def test_remove_clear_and_export(client_for, owner, library):
    _load(owner)
    client = client_for(owner)
    first = Contact.objects.first()
    client.post(f"/mail/outreach/contacts/{first.pk}/remove/")
    assert Contact.objects.get(pk=first.pk).status == "removed"
    client.post("/mail/outreach/clear/")
    assert not Contact.objects.filter(status="queued").exists()
    response = client.post("/mail/outreach/export/")
    assert response["Content-Type"] == "text/csv" and "attachment" in response["Content-Disposition"]
    text = response.content.decode()
    assert text.startswith("Lead ID,Business,Email,Status") and "LEAD-1" in text
    assert AuditEvent.objects.filter(action="outreach.exported").exists()


def test_settings_singleton(db):
    assert OutreachSettings.load().pk == OutreachSettings.load().pk == 1
