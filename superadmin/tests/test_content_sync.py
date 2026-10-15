"""The outbox (brief 3.4, ADR-036): atomic with the change, delivered after commit, signed, retried with
backoff, alerting after three failures, and never raising into the request."""

import json
from datetime import timedelta

import pytest
from django.db import transaction
from django.utils import timezone

from apps.content_sync import relay, signing, status, sync
from apps.content_sync.models import SyncEvent
from apps.insights import services
from apps.insights.models import Post, PostStatus
from apps.notifications.models import Notification

from .content_helpers import configure, make_author, make_post, ok_render, tick_all

pytestmark = pytest.mark.django_db
TARGETS = ("https://web.example.test", "https://preview.example.test")


@pytest.fixture(autouse=True)
def _setup(settings, monkeypatch):
    from apps.content_sync import render

    configure(settings, targets=TARGETS)
    monkeypatch.setattr(render, "render", ok_render)


class Recorder:
    def __init__(self, statuses=None, error=None):
        self.calls = []
        self.statuses = statuses or {}
        self.error = error

    def __call__(self, url, body, headers, timeout=3):
        self.calls.append(
            {"url": url, "body": json.loads(body), "headers": headers, "raw": body, "timeout": timeout}
        )
        if self.error and any(url.startswith(t) for t in self.error):
            raise sync.DeliveryError("timeout")
        for prefix, code in self.statuses.items():
            if url.startswith(prefix):
                return code
        return 200


def _approved(actor):
    post = make_post("Example post (fixture)", actor, authors=[make_author(actor=actor)])
    services.submit_for_review(post, actor)
    services.approve(post, actor)
    tick_all(post, actor)
    return Post.objects.get(pk=post.pk)


def test_emit_expands_tags_and_paths_from_tags_json():
    with transaction.atomic():
        event = sync.emit(
            "post",
            "00000000-0000-4000-8000-000000000101",
            "post.slug_changed",
            "Example (fixture)",
            slug="example-new",
            old_slug="example-old",
            author_slugs=["example-author", "example-old-author"],
            topic_slugs=["data"],
            deliver=False,
        )
    assert event.kind == "remove"
    assert event.tags == [
        "insights",
        "insights:list",
        "insights:post:example-old",
        "insights:post:example-new",
        "insights:author:example-author",
        "insights:author:example-old-author",
        "insights:topic:data",
        "home",
        "feed",
        "sitemap",
    ]
    assert event.paths[:2] == ["/insights/example-new", "/insights/example-old"]
    assert "/insights/authors/example-old-author" in event.paths and "/insights/topics/data" in event.paths
    role = sync.emit("role", "x", "role.opened", "Example role (fixture)", slug="example-role", deliver=False)
    assert role.tags == ["careers", "careers:list", "careers:role:example-role", "home", "sitemap"]
    assert role.paths == ["/careers/example-role", "/careers", "/"]


def test_outbox_is_atomic_with_the_change(superadmin, monkeypatch):
    post = _approved(superadmin)

    def explode(*args, **kwargs):
        raise RuntimeError("forced failure after emit")

    original_emit = sync.emit

    def emit_then_fail(*args, **kwargs):
        original_emit(*args, **kwargs)
        explode()

    monkeypatch.setattr(sync, "emit", emit_then_fail)
    with pytest.raises(RuntimeError, match="forced failure"):
        services.publish(post, superadmin)
    post.refresh_from_db()
    assert post.status == PostStatus.APPROVED and post.published_snapshot is None
    assert not SyncEvent.objects.exists()
    assert not post.revisions.exists()


def test_delivery_on_commit_signs_and_posts_to_every_target(
    superadmin, monkeypatch, django_capture_on_commit_callbacks
):
    recorder = Recorder()
    monkeypatch.setattr(sync, "http_post", recorder)
    post = _approved(superadmin)
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        services.publish(post, superadmin)
    event = SyncEvent.objects.get()
    assert event.delivered_at is None and recorder.calls == []  # nothing is sent before commit
    for callback in callbacks:
        callback()
    event.refresh_from_db()
    assert event.delivered_at is not None and event.attempts == 0
    assert sorted(event.delivered_targets) == sorted(TARGETS)
    assert [call["url"] for call in recorder.calls] == [t + "/api/content/revalidate" for t in TARGETS]
    body = recorder.calls[0]["body"]
    assert body == {"eventId": str(event.pk), "kind": "publish", "tags": event.tags, "paths": event.paths}
    headers = recorder.calls[0]["headers"]
    assert headers["X-Vitalos-Key-Id"] == "rev-1"
    signing.verify(
        "revalidate",
        key_id=headers["X-Vitalos-Key-Id"],
        timestamp=headers["X-Vitalos-Timestamp"],
        signature_header=headers["X-Vitalos-Signature"],
        method="POST",
        path="/api/content/revalidate",
        body=recorder.calls[0]["raw"],
    )
    assert recorder.calls[0]["timeout"] == 3
    assert status.item_status("post", post.pk, live=True).label.startswith("LIVE · SYNCED ")


def test_failure_backs_off_retries_only_unacknowledged_targets_and_alerts_after_three(
    superadmin, monkeypatch
):
    recorder = Recorder(statuses={TARGETS[1]: 502})
    monkeypatch.setattr(sync, "http_post", recorder)
    with transaction.atomic():
        event = sync.emit(
            "post", "x", "post.published", "Example post (fixture)", slug="example", deliver=False
        )
    start = timezone.now()
    assert sync.deliver(event.pk, now=start) is False
    event.refresh_from_db()
    assert event.attempts == 1 and event.last_error == "http_502"
    assert event.delivered_targets == [TARGETS[0]]
    assert event.next_attempt_at == start + timedelta(minutes=1)
    assert status.item_status("post", "x", live=True).label == "SYNC PENDING"
    assert status.overall().label == "1 UPDATE PENDING"
    recorder.calls.clear()
    sync.deliver(event.pk, now=start + timedelta(minutes=1))
    assert [call["url"] for call in recorder.calls] == [TARGETS[1] + "/api/content/revalidate"]
    event.refresh_from_db()
    assert event.attempts == 2 and event.next_attempt_at == start + timedelta(minutes=1) + timedelta(
        minutes=2
    )
    alerts = Notification.objects.filter(kind=sync.NOTIFICATION_KIND)
    assert not alerts.exists()
    sync.deliver(event.pk, now=start + timedelta(minutes=4))
    event.refresh_from_db()
    assert event.attempts == 3 and event.alerted_at is not None
    alert = alerts.get(recipient=superadmin)
    assert alert.title == "Site sync failed for Example post (fixture)"
    assert status.item_status("post", "x", live=True).label == "SYNC FAILED · RETRY"
    assert status.overall().label == "1 SYNC FAILURE"
    sync.deliver(event.pk, now=start + timedelta(minutes=10))
    assert alerts.count() == 1  # alerted once
    recorder.statuses = {}
    assert sync.retry(event) is True
    event.refresh_from_db()
    assert event.delivered_at is not None and status.overall().label == "SITE IN SYNC"


def test_gives_up_after_ten_attempts(monkeypatch):
    monkeypatch.setattr(sync, "http_post", Recorder(error=TARGETS))
    with transaction.atomic():
        event = sync.emit("site", "", "site.resync", "Resync everything", deliver=False)
    now = timezone.now()
    for _ in range(10):
        sync.deliver(event.pk, now=now)
    event.refresh_from_db()
    assert event.attempts == 10 and event.next_attempt_at is None and event.last_error == "timeout"
    assert event.pk not in [e.pk for e in sync.due_events(now + timedelta(days=1))]


def test_delivery_never_raises_into_the_request(superadmin, monkeypatch, django_capture_on_commit_callbacks):
    def crash(*args, **kwargs):
        raise ValueError("unexpected")

    monkeypatch.setattr(sync, "http_post", crash)
    post = _approved(superadmin)
    with django_capture_on_commit_callbacks(execute=True):
        services.publish(post, superadmin)
    assert Post.objects.get(pk=post.pk).status == PostStatus.PUBLISHED
    assert SyncEvent.objects.get().delivered_at is None


def test_missing_revalidate_key_is_a_failure_not_a_crash(settings, monkeypatch):
    settings.CONTENT_REVALIDATE_SECRET = ""
    monkeypatch.setattr(sync, "http_post", Recorder())
    with transaction.atomic():
        event = sync.emit("site", "", "site.resync", "Resync everything", deliver=False)
    assert sync.deliver(event.pk) is False
    event.refresh_from_db()
    assert event.last_error == "not_configured" and event.attempts == 1


def test_no_targets_means_nothing_to_sync(settings):
    settings.CONTENT_WEB_TARGETS = []
    with transaction.atomic():
        event = sync.emit("site", "", "site.resync", "Resync everything", deliver=False)
    assert sync.deliver(event.pk) is True
    event.refresh_from_db()
    assert event.delivered_at is not None and event.last_error == "no_targets"


def test_due_events_are_delivered_by_the_tick(monkeypatch):
    recorder = Recorder()
    monkeypatch.setattr(sync, "http_post", recorder)
    with transaction.atomic():
        due = sync.emit("site", "", "site.resync", "Due", deliver=False)
        later = sync.emit("site", "", "site.resync", "Later", deliver=False)
    SyncEvent.objects.filter(pk=later.pk).update(next_attempt_at=timezone.now() + timedelta(minutes=5))
    assert sync.deliver_due() == 1
    assert SyncEvent.objects.get(pk=due.pk).delivered_at is not None
    assert SyncEvent.objects.get(pk=later.pk).delivered_at is None


def test_relay_hook_is_off_by_default_and_fires_only_when_enabled(settings, monkeypatch):
    monkeypatch.setattr(sync, "http_post", Recorder())
    received = []

    def receiver(sender, **kwargs):
        received.append(kwargs)

    relay.relay_sync.connect(receiver)
    try:
        with transaction.atomic():
            first = sync.emit("post", "id-1", "post.published", "Example", slug="example", deliver=False)
        sync.deliver(first.pk)
        assert received == []
        settings.CONTENT_RELAY_SYNC_ENABLED = True
        with transaction.atomic():
            second = sync.emit("post", "id-2", "post.unpublished", "Example", slug="example", deliver=False)
            other = sync.emit("home_section", "home_insights", "home_section.updated", "Home", deliver=False)
        sync.deliver(second.pk)
        sync.deliver(other.pk)
        assert received == [
            {
                "signal": relay.relay_sync,
                "entity": "post",
                "entity_id": "id-2",
                "action": "post.unpublished",
                "kind": "remove",
            }
        ]
    finally:
        relay.relay_sync.disconnect(receiver)
