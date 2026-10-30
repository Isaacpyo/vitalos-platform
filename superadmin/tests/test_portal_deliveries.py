"""Client portal > Notification deliveries (staff) and the delivery-record retention job (ADR-056, "Delivery status
and retention").

Everything here is synthetic. Email goes to Django's locmem outbox (or a failing stand-in for the mail service);
push goes to a faked transport, never off this machine (see the guard in conftest).
"""

from __future__ import annotations

import datetime as dt
import io
import json
import secrets

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from django.core.management import call_command
from django.db import DatabaseError, connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.accounts.roles import SERVICE_LEAD, VIEWER
from apps.aidata import workqueue
from apps.audit.models import AuditEvent
from apps.content_sync import tick
from apps.content_sync.models import TickState
from apps.portal import deliveries, notifications, push, retention, services, staff_selectors
from apps.portal.models import EmailDelivery, Notification, PushDelivery, PushSubscription
from tests.conftest import login
from tests.portal_helpers import build_world, client_for
from tests.test_portal_push import FakeTransport, Receiver, add_device, b64, fcm, point, raw_scalar

BODY = "SYNTHETIC-NOTIFICATION-BODY-never-shown-9q"
LIST = "/client-portal/deliveries/"
HX = {"HTTP_HX_REQUEST": "true"}


# --- Fixtures and builders -----------------------------------------------------------------------------------------


@pytest.fixture
def world(db, mailoutbox):
    built = build_world()
    # Start from a clean slate: the world's own set-up sent emails we do not want in the counts.
    EmailDelivery.objects.all().delete()
    PushDelivery.objects.all().delete()
    mailoutbox.clear()
    return built


@pytest.fixture
def staff(world):
    return client_for(world.staff)


@pytest.fixture
def vapid(settings):
    key = ec.generate_private_key(ec.SECP256R1())
    settings.PORTAL_PUSH_VAPID_PRIVATE_KEY = raw_scalar(key)
    return key


@pytest.fixture
def transport(monkeypatch):
    fake = FakeTransport()
    monkeypatch.setattr(push, "_send_http", fake)
    return fake


def make_note(member, kind="question", url_name="question", pk=None):
    return Notification.objects.create(
        user=member.user,
        organisation=member.organisation,
        kind=kind,
        title=f"Synthetic {kind}",
        body=BODY,
        url_name=url_name,
        url_kwargs={"pk": pk} if pk else {},
        dedupe_key=secrets.token_hex(8),
    )


def _state_fields(state, error, created):
    return {
        "queued": {"status": "queued", "attempts": 0},
        "retrying": {
            "status": "failed",
            "attempts": 1,
            "last_error": error,
            "next_attempt_at": created + dt.timedelta(minutes=5),
        },
        "sent": {"status": "sent", "attempts": 1, "sent_at": created},
        "failed": {"status": "failed", "attempts": 3, "last_error": error},
        "cancelled": {"status": "failed", "attempts": 3, "last_error": "cancelled"},
    }[state]


def make_email(
    member, state="sent", *, age=dt.timedelta(0), kind="question", error="OSError", note=None, sent=None
):
    created = timezone.now() - age
    fields = _state_fields(state, error, created)
    if sent is not None:
        fields["sent_at"] = sent
    return EmailDelivery.objects.create(
        notification=note or make_note(member, kind),
        organisation=member.organisation,
        recipient=member.user,
        to_email=member.user.email,
        kind=kind,
        subject=f"{member.organisation.name}: Synthetic {kind}",
        created_at=created,
        **{"next_attempt_at": created, **fields},
    )


def make_device(member, *, disabled_age=None, reason="", age=dt.timedelta(days=1), label="Chrome on Android"):
    now = timezone.now()
    receiver = Receiver(fcm())
    return PushSubscription.objects.create(
        member=member,
        endpoint=receiver.endpoint,
        p256dh=b64(point(receiver.key)),
        auth=b64(receiver.auth),
        vapid_key_id=push.key_id() or "synthetic-key",
        label=label,
        created_at=now - age,
        disabled_at=None if disabled_age is None else now - disabled_age,
        disabled_reason=reason,
    )


def make_push(sub, state="sent", *, age=dt.timedelta(0), kind="question", error="server_error", note=None):
    created = timezone.now() - age
    fields = _state_fields(state, error, created)
    return PushDelivery.objects.create(
        notification=note if note is not None else make_note(sub.member, kind),
        subscription=sub,
        kind=kind,
        created_at=created,
        **{"next_attempt_at": created, **fields},
    )


def hx_toast(response) -> dict:
    assert response.status_code == 204, response.status_code
    triggers = json.loads(response["HX-Trigger"])
    assert triggers["vsa-changed"] is True
    return triggers["vsa-toast"]


def rows(html: str) -> list[str]:
    """The delivery keys in the desktop table, in order."""
    table = html.split('data-testid="deliveries"', 1)[1].split("</table>", 1)[0]
    return [part.split('"', 1)[0] for part in table.split('data-delivery="')[1:]]


# --- Summary --------------------------------------------------------------------------------------------------------


def test_summary_counts_per_channel_window_and_device(world, staff):
    a, b = world.approver, world.b_approver
    hour, day3, day10 = dt.timedelta(hours=1), dt.timedelta(days=3), dt.timedelta(days=10)
    for _ in range(2):
        make_email(a, "sent", age=hour)
    make_email(b, "sent", age=day3)
    make_email(a, "queued")
    make_email(a, "retrying", age=day3)
    make_email(a, "failed", age=hour)
    make_email(a, "cancelled", age=hour)
    make_email(a, "sent", age=day10)  # outside both windows
    phone = make_device(a)
    make_device(b)
    make_push(phone, "sent", age=hour)
    make_push(phone, "retrying", age=hour)
    make_push(phone, "failed", age=day3, error="gone")
    make_device(a, disabled_age=dt.timedelta(days=2), reason="gone")
    make_device(a, disabled_age=dt.timedelta(days=1), reason="gone")
    make_device(b, disabled_age=dt.timedelta(hours=5), reason="key")
    make_device(b, disabled_age=dt.timedelta(days=9), reason="failing")  # outside the week

    data = deliveries.summary()
    email, pushes = data["channels"]
    assert email.channel == "email" and pushes.channel == "push"
    assert email.day == {"sent": 2, "pending": 1, "failed": 1, "cancelled": 1}
    assert email.week == {"sent": 3, "pending": 2, "failed": 1, "cancelled": 1}
    assert pushes.day == {"sent": 1, "pending": 1, "failed": 0, "cancelled": 0}
    assert pushes.week == {"sent": 1, "pending": 1, "failed": 1, "cancelled": 0}
    assert data["devices_active"] == 2
    assert {item["reason"]: item["count"] for item in data["devices_disabled"]} == {"gone": 2, "key": 1}
    assert data["devices_disabled_total"] == 3

    html = staff.get(LIST).content.decode()
    assert 'data-testid="count-email-1-sent">2<' in html
    assert 'data-testid="count-email-7-pending">2<' in html
    assert 'data-testid="count-push-7-failed">1<' in html
    assert 'data-testid="devices-active">2<' in html
    assert "The browser ended the subscription: <span" in html
    assert "1 cancelled by staff in the last 7 days." in html
    # Each number opens the matching list.
    assert 'href="?channel=email&amp;status=final&amp;days=1"' in html


def test_summary_says_when_push_is_off(world, staff, settings):
    settings.PORTAL_PUSH_VAPID_PRIVATE_KEY = ""
    assert 'data-testid="push-off"' in staff.get(LIST).content.decode()


# --- List, filters, pagination ----------------------------------------------------------------------------------------


def test_list_shows_both_channels_newest_first_with_the_columns(world, vapid, staff):
    a = world.approver
    old = make_email(a, "failed", age=dt.timedelta(hours=3), error="OSError")
    phone = make_device(a, label="Safari on iPhone")
    middle = make_push(phone, "retrying", age=dt.timedelta(hours=2), error="rate_limited")
    new = make_email(world.b_approver, "sent", age=dt.timedelta(hours=1), kind="update")
    response = staff.get(LIST)
    assert response.status_code == 200
    html = response.content.decode()
    assert rows(html) == [f"email-{new.pk}", f"push-{middle.pk}", f"email-{old.pk}"]
    for text in (
        "Notification deliveries",
        "Showing 1–3 of 3, newest first",
        world.org_a.name,
        world.org_b.name,
        "Alma Approver",
        a.user.email,  # email deliveries show the address
        "Safari on iPhone",  # push shows the coarse device label
        "Question for you",
        "Published update",
        "Retrying",
        "Rate limited",
        "Mail service error (OSError)",
        "1 of 3 attempts",
        "3 of 3 attempts",
        "Retry now",
        "Cancel",
    ):
        assert text in html, text
    # The staff navigation and the work queue's portal section lead here.
    assert 'aria-current="page">Notification deliveries</a>' in html
    assert "/client-portal/deliveries/" in staff.get("/client-portal/").content.decode()


def test_filters_narrow_the_list_and_unknown_values_are_ignored(world, staff):
    a, b = world.approver, world.b_approver
    sent_a = make_email(a, "sent", kind="update")
    final_a = make_email(a, "failed", age=dt.timedelta(days=2))
    retrying_b = make_email(b, "retrying")
    cancelled_a = make_email(a, "cancelled")
    old_a = make_email(a, "sent", age=dt.timedelta(days=40))
    phone = make_device(a)
    push_gone = make_push(phone, "failed", error="gone")
    push_test = make_push(phone, "sent", kind="test", note=None)
    PushDelivery.objects.filter(pk=push_test.pk).update(notification=None)

    def keys(query):
        return set(rows(staff.get(f"{LIST}?{query}").content.decode()))

    assert keys("channel=push") == {f"push-{push_gone.pk}", f"push-{push_test.pk}"}
    assert keys("channel=email&status=sent") == {f"email-{sent_a.pk}", f"email-{old_a.pk}"}
    assert keys("status=final") == {f"email-{final_a.pk}", f"push-{push_gone.pk}"}
    assert keys("status=failed") == {f"email-{final_a.pk}", f"email-{retrying_b.pk}", f"push-{push_gone.pk}"}
    assert keys("status=pending") == {f"email-{retrying_b.pk}"}
    assert keys("status=cancelled") == {f"email-{cancelled_a.pk}"}
    assert keys(f"org={world.org_b.pk}") == {f"email-{retrying_b.pk}"}
    # A member's own test push belongs to their organisation.
    assert f"push-{push_test.pk}" in keys(f"org={world.org_a.pk}&channel=push")
    assert keys("kind=update") == {f"email-{sent_a.pk}"}
    assert keys("kind=test") == {f"push-{push_test.pk}"}
    assert f"email-{old_a.pk}" not in keys("days=30")
    assert f"email-{final_a.pk}" not in keys("days=1")
    everything = keys("")
    assert keys("channel=fax&status=lost&org=abc&kind=zzz&days=13") == everything
    assert len(everything) == 7
    # The filter form keeps what was chosen.
    html = staff.get(f"{LIST}?channel=push&status=final&days=7").content.decode()
    assert '<option value="push" selected>' in html and '<option value="final" selected>' in html
    assert '<option value="7" selected>' in html


def test_pagination_is_newest_first_and_tolerates_bad_pages(world, staff):
    created = [make_email(world.approver, "sent", age=dt.timedelta(minutes=index)) for index in range(55)]
    first = staff.get(LIST).content.decode()
    assert "Showing 1–50 of 55, newest first" in first and "Page 1 of 2" in first
    assert rows(first)[0] == f"email-{created[0].pk}"
    assert 'rel="next"' in first and 'href="?page=2"' in first
    second = staff.get(f"{LIST}?page=2").content.decode()
    assert "Showing 51–55 of 55" in second and rows(second)[-1] == f"email-{created[-1].pk}"
    assert 'rel="prev"' in second
    assert "Showing 51–55" in staff.get(f"{LIST}?page=99").content.decode()
    assert "Showing 1–50" in staff.get(f"{LIST}?page=abc").content.decode()
    # Filters survive paging.
    filtered = staff.get(f"{LIST}?channel=email&status=sent").content.decode()
    assert 'href="?channel=email&amp;status=sent&amp;page=2"' in filtered


def test_empty_and_error_states_are_honest(world, staff, monkeypatch):
    html = staff.get(LIST).content.decode()
    assert "No portal email or push has been sent yet." in html and 'data-testid="deliveries"' not in html
    assert "Retry all failed" not in html
    filtered = staff.get(f"{LIST}?status=final").content.decode()
    assert "No deliveries match these filters." in filtered and "Clear the filters" in filtered

    def broken(*args, **kwargs):
        raise DatabaseError("synthetic outage")

    monkeypatch.setattr(deliveries, "listing", broken)
    failed = staff.get(LIST)
    assert failed.status_code == 200
    page = failed.content.decode()
    assert 'role="alert"' in page and "could not be loaded" in page
    assert 'data-testid="delivery-summary"' not in page and "synthetic outage" not in page


# --- What staff never see ---------------------------------------------------------------------------------------------


def test_endpoints_keys_payloads_and_bodies_never_appear(world, vapid, transport, staff):
    sub, receiver = add_device(world.approver)
    question = services.ask_question(
        world.ch_a, question="Synthetic: which export format?", actor=world.staff
    )
    sent = PushDelivery.objects.get(subscription=sub, notification__dedupe_key=f"question:{question.pk}")
    push.deliver(sent.pk)
    transport.statuses = [410]
    gone_note = make_note(world.approver, pk=question.pk)
    gone = PushDelivery.objects.create(notification=gone_note, subscription=sub, kind="question")
    push.deliver(gone.pk)
    gone.refresh_from_db()
    sub.refresh_from_db()
    assert gone.last_error == "gone" and sub.disabled_reason == "gone"
    test_push = PushDelivery.objects.create(subscription=sub, kind="test", status="sent", attempts=1)
    email = make_email(world.approver, "failed")
    secrets_and_payload = [
        sub.endpoint,
        sub.endpoint.rsplit("/", 1)[1],
        sub.p256dh,
        sub.auth,
        receiver.subscription()["keys"]["auth"],
        push.endpoint_digest(sub.endpoint),
        f"/notifications/{sent.notification_id}/open/",
        BODY,
        *(body for _, body in push.MESSAGES.values()),
    ]
    pages = [
        staff.get(LIST).content.decode(),
        staff.get(f"{LIST}?channel=push&status=final").content.decode(),
        staff.get(f"/client-portal/deliveries/push/{sent.pk}/").content.decode(),
        staff.get(f"/client-portal/deliveries/push/{gone.pk}/").content.decode(),
        staff.get(f"/client-portal/deliveries/push/{test_push.pk}/").content.decode(),
        staff.get(f"/client-portal/deliveries/email/{email.pk}/").content.decode(),
    ]
    for html in pages:
        for value in secrets_and_payload:
            assert value not in html, value
    # Email deliveries may show the address and the subject, never a body (none is stored).
    assert email.to_email in pages[-1] and email.subject in pages[-1]


# --- Detail -----------------------------------------------------------------------------------------------------------


def test_detail_explains_a_gone_device_and_links_the_record(world, vapid, transport, staff):
    sub, _ = add_device(world.approver)
    note = make_note(world.approver, pk=world.q_a.pk)
    delivery = PushDelivery.objects.create(notification=note, subscription=sub, kind="question")
    transport.statuses = [410]
    push.deliver(delivery.pk)
    html = staff.get(f"/client-portal/deliveries/push/{delivery.pk}/").content.decode()
    assert "Device gone" in html
    assert "The browser removed this subscription; the device has been turned off." in html
    assert "The browser ended the subscription." in html  # the device's reason
    assert f'href="/client-portal/challenges/{world.q_a.challenge_id}/"' in html
    assert "Open the question&#x27;s challenge" in html
    assert "A push service ended a portal notification subscription" in html  # device history
    assert "Retry now" in html  # failed for good can still be retried (and will be refused)


def test_detail_of_a_failed_email_shows_its_attempts(world, staff, monkeypatch):
    from apps.mailer import system

    monkeypatch.setattr(system, "send", lambda *a, **k: (_ for _ in ()).throw(ConnectionError("down")))
    services.ask_question(world.ch_a, question="Synthetic detail question?", actor=world.staff)
    monkeypatch.undo()
    delivery = EmailDelivery.objects.filter(recipient=world.approver.user).get()
    html = staff.get(f"/client-portal/deliveries/email/{delivery.pk}/").content.decode()
    assert "Mail service error (ConnectionError)" in html and "next automatic attempt" in html
    assert "A portal email could not be sent" in html and "attempt 1 failed (ConnectionError)" in html
    assert delivery.subject in html and delivery.to_email in html
    assert "Open the question&#x27;s challenge" in html
    assert 'data-testid="delivery-state">Retrying<' in html


def test_detail_edge_cases(world, staff):
    sub = make_device(world.approver)
    test_push = make_push(sub, "sent", kind="test")
    PushDelivery.objects.filter(pk=test_push.pk).update(notification=None)
    html = staff.get(f"/client-portal/deliveries/push/{test_push.pk}/").content.decode()
    assert "A test the member sent to their own device" in html
    assert "Member&#x27;s own test" in html
    orphan = make_email(world.approver, "sent")
    Notification.objects.filter(pk=orphan.notification_id).delete()
    assert "has been deleted" in staff.get(f"/client-portal/deliveries/email/{orphan.pk}/").content.decode()
    assert staff.get("/client-portal/deliveries/fax/1/").status_code == 404
    assert staff.get("/client-portal/deliveries/email/999999/").status_code == 404
    # The back link returns to the filtered list, never to another site.
    back = staff.get(
        f"/client-portal/deliveries/email/{orphan.pk}/?back=/client-portal/deliveries/%3Fstatus%3Dsent"
    )
    assert 'href="/client-portal/deliveries/?status=sent"' in back.content.decode()
    evil = staff.get(f"/client-portal/deliveries/email/{orphan.pk}/?back=https://evil.example.test/")
    assert 'href="https://evil.example.test/"' not in evil.content.decode()
    assert '<a href="/client-portal/deliveries/" class="hover:underline">' in evil.content.decode()


# --- Retry ------------------------------------------------------------------------------------------------------------


def test_retry_now_sends_a_failed_email_once_with_a_toast(world, staff, monkeypatch, mailoutbox):
    from apps.mailer import system

    monkeypatch.setattr(system, "send", lambda *a, **k: (_ for _ in ()).throw(OSError("down")))
    services.ask_question(world.ch_a, question="Synthetic retry question?", actor=world.staff)
    monkeypatch.undo()
    delivery = EmailDelivery.objects.get(recipient=world.approver.user)
    assert deliveries.state_of(delivery) == "retrying"
    toast = hx_toast(staff.post(f"/client-portal/deliveries/email/{delivery.pk}/retry/", **HX))
    assert toast == {"message": "Sent.", "tone": ""}
    delivery.refresh_from_db()
    assert delivery.status == "sent" and delivery.attempts == 2
    assert [m.to for m in mailoutbox] == [[world.approver.user.email]]
    event = AuditEvent.objects.get(action="portal.delivery_retried")
    assert event.actor == world.staff and event.entity_id == str(delivery.pk) and "sent" in event.summary
    # A second press cannot send it again; without HTMX the answer is a message and a redirect back.
    again = staff.post(
        f"/client-portal/deliveries/email/{delivery.pk}/retry/",
        {"next": f"{LIST}?status=failed"},
        follow=True,
    )
    assert again.redirect_chain[-1][0] == f"{LIST}?status=failed"
    assert "Already sent. A sent delivery is never sent again." in again.content.decode()
    assert len(mailoutbox) == 1
    # The original email-only address still works.
    other = EmailDelivery.objects.filter(status="failed").first()
    staff.post(f"/client-portal/deliveries/{other.pk}/retry/")
    other.refresh_from_db()
    assert other.status == "sent"


def test_retry_now_tries_a_push_again_after_the_automatic_attempts(world, vapid, transport, staff):
    sub, receiver = add_device(world.approver)
    delivery = make_push(sub, "failed", error="server_error")
    toast = hx_toast(staff.post(f"/client-portal/deliveries/push/{delivery.pk}/retry/", **HX))
    assert toast["message"] == "Sent." and len(transport.calls) == 1
    message = json.loads(receiver.decrypt(transport.calls[0]["body"]))
    assert message["body"] == push.MESSAGES["question"][1]  # the generic line, as ever
    delivery.refresh_from_db()
    assert delivery.status == "sent" and delivery.attempts == 4


def test_a_retry_that_still_fails_says_so(world, vapid, transport, staff):
    sub, _ = add_device(world.approver)
    delivery = make_push(sub, "failed", error="server_error")
    transport.statuses = [503]
    toast = hx_toast(staff.post(f"/client-portal/deliveries/push/{delivery.pk}/retry/", **HX))
    assert toast["tone"] == "error" and toast["message"] == (
        "Still failing (Push service error). The push service had a temporary fault (5xx). "
        "No automatic attempts are left."
    )


def _revoke(world, sub, delivery, settings):
    services.revoke_member(world.approver, actor=world.staff)


def _push_preference_off(world, sub, delivery, settings):
    pref = notifications.preferences(world.approver.user)
    pref.push_questions = False
    pref.save()


def _device_gone(world, sub, delivery, settings):
    PushSubscription.objects.filter(pk=sub.pk).update(disabled_at=timezone.now(), disabled_reason="gone")


def _expired(world, sub, delivery, settings):
    PushDelivery.objects.filter(pk=delivery.pk).update(created_at=timezone.now() - dt.timedelta(days=2))


def _blocked(world, sub, delivery, settings):
    PushSubscription.objects.filter(pk=sub.pk).update(endpoint="https://push.evil.example.test/abc")


def _rotated_key(world, sub, delivery, settings):
    settings.PORTAL_PUSH_VAPID_PRIVATE_KEY = raw_scalar(ec.generate_private_key(ec.SECP256R1()))


@pytest.mark.parametrize(
    ("change", "category", "words"),
    [
        (_revoke, "not_member", "no longer a live member"),
        (_push_preference_off, "preference_off", "turned this kind of notification off"),
        (_device_gone, "device_off", "already been turned off"),
        (_expired, "expired", "more than a day old"),
        (_blocked, "blocked_endpoint", "no longer on the allowlist"),
        (_rotated_key, "old_key", "earlier server key"),
    ],
)
def test_push_retry_respects_every_recheck(world, vapid, transport, staff, settings, change, category, words):
    sub, _ = add_device(world.approver)
    delivery = make_push(sub, "failed", error="server_error")
    change(world, sub, delivery, settings)
    toast = hx_toast(staff.post(f"/client-portal/deliveries/push/{delivery.pk}/retry/", **HX))
    assert toast["tone"] == "error" and toast["message"].startswith("Not sent:") and words in toast["message"]
    assert transport.calls == []
    delivery.refresh_from_db()
    assert delivery.status == "failed" and delivery.last_error == category
    assert AuditEvent.objects.get(action="portal.delivery_retried").metadata["category"] == category
    detail = staff.get(f"/client-portal/deliveries/push/{delivery.pk}/").content.decode()
    assert words in detail


@pytest.mark.parametrize("why", ["revoked", "preference"])
def test_email_retry_respects_membership_and_preference(world, staff, mailoutbox, why):
    delivery = make_email(world.approver, "failed")
    if why == "revoked":
        services.revoke_member(world.approver, actor=world.staff)
        words = "no longer a live member"
    else:
        pref = notifications.preferences(world.approver.user)
        pref.email_questions = False
        pref.save()
        words = "turned this kind of notification off"
    mailoutbox.clear()
    toast = hx_toast(staff.post(f"/client-portal/deliveries/email/{delivery.pk}/retry/", **HX))
    assert toast["message"].startswith("Not sent:") and words in toast["message"]
    assert mailoutbox == []
    delivery.refresh_from_db()
    assert delivery.status == "failed" and delivery.last_error in (
        notifications.NOT_MEMBER_ERROR,
        notifications.PREFERENCE_OFF_ERROR,
    )


# --- Cancel -----------------------------------------------------------------------------------------------------------


def test_cancel_stops_a_pending_delivery_for_good(world, vapid, transport, staff):
    sub, _ = add_device(world.approver)
    queued = make_push(sub, "queued")
    toast = hx_toast(staff.post(f"/client-portal/deliveries/push/{queued.pk}/cancel/", **HX))
    assert toast == {"message": "Cancelled. It will not be sent.", "tone": ""}
    queued.refresh_from_db()
    assert deliveries.state_of(queued) == "cancelled"
    # Nothing can send it now: not the automatic retry, not deliver itself, not Retry now.
    assert push.send_pending()["attempted"] == 0
    assert push.deliver(queued.pk, manual=True).last_error == "cancelled"
    refused = hx_toast(staff.post(f"/client-portal/deliveries/push/{queued.pk}/retry/", **HX))
    assert "was cancelled" in refused["message"]
    assert transport.calls == []
    assert AuditEvent.objects.filter(action="portal.delivery_cancelled", entity_id=str(queued.pk)).exists()
    html = staff.get(f"{LIST}?status=cancelled").content.decode()
    assert f"push-{queued.pk}" in rows(html) and "Cancelled" in html


def test_a_cancelled_email_leaves_the_overview_and_the_work_queue(world, staff, mailoutbox):
    delivery = make_email(world.approver, "retrying")
    assert staff_selectors.failed_deliveries().count() == 1
    response = staff.post(
        f"/client-portal/deliveries/email/{delivery.pk}/cancel/",
        {"next": f"{LIST}?status=failed"},
        follow=True,
    )
    assert "Cancelled. It will not be sent." in response.content.decode()
    assert staff_selectors.failed_deliveries().count() == 0
    assert not [i for i in workqueue.work_queue()[2].items if i.title.startswith("Portal email failed")]
    assert notifications.deliver(delivery.pk, manual=True).status == "failed" and mailoutbox == []


def test_only_pending_deliveries_can_be_cancelled(world, staff):
    sent = make_email(world.approver, "sent")
    final = make_email(world.approver, "failed")
    for delivery in (sent, final):
        toast = hx_toast(staff.post(f"/client-portal/deliveries/email/{delivery.pk}/cancel/", **HX))
        assert toast["tone"] == "error" and "Only a queued or retrying delivery" in toast["message"]
        before = delivery.last_error
        delivery.refresh_from_db()
        assert delivery.last_error == before
    assert staff.post("/client-portal/deliveries/email/999999/cancel/").status_code == 404
    assert staff.get(f"/client-portal/deliveries/email/{sent.pk}/cancel/").status_code == 405


# --- Bulk retry -------------------------------------------------------------------------------------------------------


def test_bulk_retry_is_capped_newest_first_and_stays_in_the_filter(
    world, vapid, transport, staff, monkeypatch
):
    monkeypatch.setattr(deliveries, "BULK_RETRY_CAP", 3)
    mine = [make_email(world.approver, "retrying", age=dt.timedelta(minutes=10 - i)) for i in range(5)]
    other_org = make_email(world.b_approver, "failed")
    sub, _ = add_device(world.approver)
    other_channel = make_push(sub, "failed")
    query = f"channel=email&org={world.org_a.pk}"
    html = staff.get(f"{LIST}?{query}").content.decode()
    # The styled confirmation dialog asks first (never window.confirm).
    assert 'data-confirm-title="Retry 3 failed deliveries now?"' in html
    assert "The newest 3 of the 5 in this filter are retried now" in html
    assert "Retry all failed in this filter (3 of 5)" in html
    assert "window.confirm" not in html and "onclick" not in html
    response = staff.post(
        "/client-portal/deliveries/retry-failed/", {"channel": "email", "org": world.org_a.pk}, follow=True
    )
    assert response.redirect_chain[-1][0] == f"{LIST}?{query}"
    assert (
        "Retried 3: 3 sent. 2 more not tried yet; press Retry again to continue." in response.content.decode()
    )
    states = {d.pk: deliveries.state_of(EmailDelivery.objects.get(pk=d.pk)) for d in mine}
    assert [states[d.pk] for d in mine] == ["retrying", "retrying", "sent", "sent", "sent"]  # newest first
    assert deliveries.state_of(EmailDelivery.objects.get(pk=other_org.pk)) == "failed"
    assert deliveries.state_of(PushDelivery.objects.get(pk=other_channel.pk)) == "failed"
    assert transport.calls == []
    event = AuditEvent.objects.get(action="portal.delivery_bulk_retried")
    assert event.metadata["sent"] == 3 and event.metadata["left"] == 2 and event.actor == world.staff
    staff.post("/client-portal/deliveries/retry-failed/", {"channel": "email", "org": world.org_a.pk})
    assert all(EmailDelivery.objects.get(pk=d.pk).status == "sent" for d in mine)
    done = staff.post(
        "/client-portal/deliveries/retry-failed/", {"channel": "email", "org": world.org_a.pk}, follow=True
    )
    assert "Nothing to retry" in done.content.decode()


def test_bulk_retry_reports_refusals_and_the_time_budget(world, staff, monkeypatch):
    for _ in range(2):
        make_email(world.approver, "failed")
    services.revoke_member(world.contrib, actor=world.staff)
    make_email(world.contrib, "failed")
    result = deliveries.bulk_retry(deliveries.Filters(), actor=world.staff)
    assert (result.attempted, result.sent, result.refused, result.failing, result.left) == (3, 2, 1, 0, 0)
    assert "1 not sent (a re-check refused them)" in result.message
    make_email(world.approver, "failed")
    late = deliveries.bulk_retry(deliveries.Filters(), actor=world.staff, budget=-1)
    assert late.attempted == 0 and late.left == 2  # the refused one and the new one: nothing started


def test_bulk_retry_default_cap_is_one_hundred(world, monkeypatch):
    assert deliveries.BULK_RETRY_CAP == 100
    EmailDelivery.objects.bulk_create(
        EmailDelivery(
            organisation=world.org_a,
            recipient=world.approver.user,
            to_email=world.approver.user.email,
            kind="question",
            subject="Synthetic",
            status="failed",
            attempts=3,
            last_error="OSError",
        )
        for _ in range(101)
    )
    attempted = []
    monkeypatch.setattr(deliveries, "_attempt", lambda channel, pk: attempted.append(pk) or ("sent", ""))
    result = deliveries.bulk_retry(deliveries.Filters(), actor=world.staff)
    assert len(attempted) == 100 and result.attempted == 100 and result.left == 1


# --- Permissions and hosts --------------------------------------------------------------------------------------------


def test_only_portal_staff_reach_the_delivery_tools(world, make_user):
    delivery = make_email(world.approver, "failed")
    gets = [LIST, f"/client-portal/deliveries/email/{delivery.pk}/"]
    posts = [
        f"/client-portal/deliveries/email/{delivery.pk}/retry/",
        f"/client-portal/deliveries/email/{delivery.pk}/cancel/",
        f"/client-portal/deliveries/{delivery.pk}/retry/",
        "/client-portal/deliveries/retry-failed/",
    ]
    anonymous = Client()
    for path in gets:
        response = anonymous.get(path)
        assert response.status_code == 302 and "/login/" in response["Location"], path
    for path in posts:
        assert anonymous.post(path).status_code == 302, path
    viewer = login(Client(), make_user(VIEWER, email="viewer-role@example.test"))
    customer = client_for(world.approver.user)
    no_role = login(Client(), make_user(None, email="no-role@example.test"), verified=False)
    for client, allowed in ((viewer, {403}), (customer, {403}), (no_role, {302, 403, 404})):
        for path in gets:
            assert client.get(path).status_code in allowed, path
        for path in posts:
            assert client.post(path).status_code in allowed, path
    delivery.refresh_from_db()
    assert delivery.status == "failed" and delivery.attempts == 3
    assert not AuditEvent.objects.filter(action__startswith="portal.delivery_").exists()
    lead = login(Client(), make_user(SERVICE_LEAD, email="lead-role@example.test"))
    assert lead.get(LIST).status_code == 200


def test_the_portal_host_never_serves_the_delivery_tools(world, settings):
    settings.PORTAL_HOST = "portal.example.test"
    settings.ALLOWED_HOSTS = ["testserver", "localhost", "portal.example.test"]
    delivery = make_email(world.approver, "failed")
    for client in (client_for(world.staff), client_for(world.approver.user), Client()):
        client.defaults["HTTP_HOST"] = "portal.example.test"
        for path in (LIST, f"/client-portal/deliveries/email/{delivery.pk}/", "/deliveries/"):
            assert client.get(path).status_code == 404, path
        assert client.post(f"/client-portal/deliveries/email/{delivery.pk}/retry/").status_code == 404
    delivery.refresh_from_db()
    assert delivery.attempts == 3
    assert client_for(world.staff).get(LIST).status_code == 200  # the admin host still serves staff


def test_the_local_customer_portal_has_no_delivery_routes(world):
    customer = client_for(world.approver.user)
    for path in ("/portal/deliveries/", "/portal/client-portal/deliveries/"):
        assert customer.get(path).status_code == 404, path


# --- Performance ------------------------------------------------------------------------------------------------------


def test_the_list_is_a_fixed_number_of_queries(world, staff, django_assert_max_num_queries):
    members = [world.approver, world.contrib, world.b_approver]

    def add(count):
        for index in range(count):
            member = members[index % 3]
            make_email(member, ("sent", "retrying", "failed")[index % 3])
            make_push(make_device(member), ("sent", "queued", "failed")[index % 3])

    def measure():
        with CaptureQueriesContext(connection) as queries:
            assert staff.get(LIST).status_code == 200
        return len(queries)

    staff.get(LIST)  # warm up the session
    add(3)
    few = measure()
    add(20)
    many = measure()
    assert many == few, (few, many)
    # Measured 16: session, user and second factor (4); the page of keys, its count and the retryable count (3);
    # the email rows and the push rows (2); the summary (4); the organisation filter (1); the page chrome (2).
    assert few <= 16
    with django_assert_max_num_queries(few):
        staff.get(f"{LIST}?channel=push&status=failed&org={world.org_a.pk}&days=7")


# --- Retention --------------------------------------------------------------------------------------------------------


@pytest.fixture
def aged(world):
    """Rows either side of every policy boundary (defaults: 90 days sent, 180 failed or cancelled, 90 devices)."""
    a = world.approver
    days = dt.timedelta(days=1)
    rows = {
        "email_sent_91": make_email(a, "sent", age=91 * days),
        "email_sent_89": make_email(a, "sent", age=89 * days),
        # Counted from sending, not queueing.
        "email_sent_late": make_email(a, "sent", age=100 * days, sent=timezone.now() - 80 * days),
        "email_failed_181": make_email(a, "failed", age=181 * days),
        "email_cancelled_200": make_email(a, "cancelled", age=200 * days),
        "email_failed_179": make_email(a, "failed", age=179 * days),
        "email_retrying_400": make_email(a, "retrying", age=400 * days),
        "email_queued_400": make_email(a, "queued", age=400 * days),
    }
    active = make_device(a, age=400 * days)
    rows.update(
        {
            "push_sent_91": make_push(active, "sent", age=91 * days),
            "push_failed_181": make_push(active, "failed", age=181 * days),
            "push_retrying_400": make_push(active, "retrying", age=400 * days),
            "push_queued_400": make_push(active, "queued", age=400 * days),
        }
    )
    clean = make_device(a, disabled_age=100 * days, reason="gone", age=200 * days)
    rows["push_clean_sent_120"] = make_push(clean, "sent", age=120 * days)
    kept = make_device(a, disabled_age=100 * days, reason="gone", age=200 * days)
    rows["push_kept_failed_120"] = make_push(kept, "failed", age=120 * days, error="gone")
    pending = make_device(a, disabled_age=100 * days, reason="key", age=200 * days)
    rows["push_pending_on_off_device"] = make_push(pending, "queued", age=400 * days)
    devices = {
        "active": active,
        "clean": clean,
        "kept": kept,
        "pending": pending,
        "recent": make_device(a, disabled_age=30 * days, reason="failing"),
        "empty_91": make_device(a, disabled_age=91 * days, reason="limit"),
    }
    return rows, devices


EXPECTED = {"email_sent": 1, "email_failed": 2, "push_sent": 2, "push_failed": 1, "devices": 2}
DELETED_ROWS = {
    "email_sent_91",
    "email_failed_181",
    "email_cancelled_200",
    "push_sent_91",
    "push_failed_181",
    "push_clean_sent_120",
}
DELETED_DEVICES = {"clean", "empty_91"}


def _exists(obj) -> bool:
    return type(obj).objects.filter(pk=obj.pk).exists()


def test_retention_dry_run_counts_and_deletes_nothing(aged, settings, caplog):
    rows, devices = aged
    assert settings.RETENTION_ENFORCE is False
    notes = Notification.objects.count()
    audit = AuditEvent.objects.count()
    assert retention.counts() == EXPECTED
    with caplog.at_level("INFO", logger="apps.portal.retention"):
        assert retention.run() == sum(EXPECTED.values())
    assert all(_exists(obj) for obj in [*rows.values(), *devices.values()])
    assert Notification.objects.count() == notes and AuditEvent.objects.count() == audit
    record = next(r for r in caplog.records if r.getMessage() == "Portal delivery retention dry run")
    assert record.would_delete == EXPECTED


def test_retention_enforced_deletes_only_what_the_policy_covers(aged, settings):
    rows, devices = aged
    settings.RETENTION_ENFORCE = True
    notes = Notification.objects.count()
    audit_ids = set(AuditEvent.objects.values_list("pk", flat=True))
    assert retention.run() == sum(EXPECTED.values())
    for name, obj in rows.items():
        assert _exists(obj) is (name not in DELETED_ROWS), name
    for name, obj in devices.items():
        assert _exists(obj) is (name not in DELETED_DEVICES), name
    # Notifications and audit events are never touched; the run itself is audited once.
    assert Notification.objects.count() == notes
    assert audit_ids <= set(AuditEvent.objects.values_list("pk", flat=True))
    event = AuditEvent.objects.get(action="portal.delivery_retention")
    assert event.metadata == EXPECTED
    # A second run finds nothing more.
    assert retention.run() == 0 and AuditEvent.objects.filter(action="portal.delivery_retention").count() == 1


def test_retention_settings_and_their_floor(world, settings):
    a = world.approver
    days = dt.timedelta(days=1)
    thirty_one = make_email(a, "sent", age=31 * days)
    eight = make_email(a, "sent", age=8 * days)
    five = make_email(a, "sent", age=5 * days)
    assert retention.counts()["email_sent"] == 0
    settings.PORTAL_DELIVERY_SENT_RETENTION_DAYS = 30
    assert retention.counts()["email_sent"] == 1
    settings.PORTAL_DELIVERY_SENT_RETENTION_DAYS = 1  # below the floor: counts as 7
    assert retention.policy().sent_days == 7
    settings.RETENTION_ENFORCE = True
    assert retention.run() == 2
    assert not _exists(thirty_one) and not _exists(eight) and _exists(five)
    settings.PORTAL_DELIVERY_FAILED_RETENTION_DAYS = "not a number"
    assert retention.policy().failed_days == 180


def test_retention_runs_daily_in_the_content_tick_as_a_dry_run(aged, settings):
    rows, _ = aged
    TickState.objects.filter(pk=1).update(last_daily_at=None)
    tick.run()
    assert TickState.load().last_result["portal_deliveries"] == sum(EXPECTED.values())
    assert all(_exists(obj) for obj in rows.values())


def test_a_failing_portal_retention_does_not_skip_the_other_daily_steps(world, monkeypatch):
    def broken(now=None):
        raise RuntimeError("synthetic failure")

    monkeypatch.setattr(retention, "run", broken)
    result = tick.run_daily(timezone.now())
    assert result["portal_deliveries"] == "error" and result["retention"] != "error"


def test_retention_command_prints_the_dry_run(aged, settings):
    out = io.StringIO()
    call_command("portal_delivery_retention", stdout=out)
    text = out.getvalue()
    assert "Dry run: would delete 1 sent email record(s) sent before" in text
    assert "Dry run: would delete 2 turned-off push device(s)" in text
    assert "Nothing changed. Set RETENTION_ENFORCE=true" in text
    rows, _ = aged
    assert all(_exists(obj) for obj in rows.values())
    settings.RETENTION_ENFORCE = True
    out = io.StringIO()
    call_command("portal_delivery_retention", stdout=out)
    assert f"Deleted {sum(EXPECTED.values())} record(s)." in out.getvalue()


def test_the_page_states_the_retention_policy(world, staff, settings):
    html = staff.get(LIST).content.decode()
    assert "sent records are deleted 90 days after sending" in html and "a dry run" in html
    settings.RETENTION_ENFORCE = True
    assert "The daily job deletes them." in staff.get(LIST).content.decode()
