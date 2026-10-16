"""The content tick (ADR-042): scheduled posts go live and expired roles close exactly once, pending
events are delivered, and the opportunistic tick runs at most once a minute."""

import io
import threading
from datetime import timedelta

import pytest
from django.core.management import call_command
from django.db import connection, transaction
from django.utils import timezone

from apps.careers.models import Role, RoleStatus
from apps.content_sync import render, tick
from apps.content_sync.models import SyncEvent, TickState
from apps.insights import public, services
from apps.insights.models import Post, PostRevision, PostStatus

from .content_helpers import configure, expire_role, make_author, make_post, make_role, ok_render, tick_all

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _setup(settings, monkeypatch):
    configure(settings, targets=())
    monkeypatch.setattr(render, "render", ok_render)


def _scheduled(actor, title="Example scheduled (fixture)"):
    post = make_post(title, actor, authors=[make_author(actor=actor)])
    services.submit_for_review(post, actor)
    services.approve(post, actor)
    tick_all(post, actor)
    post = services.schedule(Post.objects.get(pk=post.pk), actor, timezone.now() + timedelta(minutes=10))
    Post.objects.filter(pk=post.pk).update(publish_at=timezone.now() - timedelta(seconds=30))
    return Post.objects.get(pk=post.pk)


def test_tick_promotes_due_posts_exactly_once(superadmin):
    post = _scheduled(superadmin)
    not_due = make_post("Example later (fixture)", superadmin)
    first = tick.run()
    second = tick.run()
    assert first["promoted"] == 1 and second["promoted"] == 0
    post.refresh_from_db()
    assert post.status == PostStatus.PUBLISHED and post.publish_at is None
    assert post.first_published_at is not None
    assert PostRevision.objects.filter(post=post).count() == 1
    assert SyncEvent.objects.filter(entity_id=str(post.pk), action="post.published").count() == 1
    assert public.post_detail(public.Catalogue(), post.slug)["title"] == "Example scheduled (fixture)"
    assert Post.objects.get(pk=not_due.pk).status == PostStatus.DRAFT


def test_tick_keeps_working_copy_edits_made_after_scheduling_private(superadmin):
    post = _scheduled(superadmin)
    data = {name: getattr(post, name) for name in services.WORKING_FIELDS}
    services.save_working_copy(
        post,
        {**data, "title": "Example edited later (fixture)"},
        authors=services.author_ids(post),
        actor=superadmin,
    )
    tick.run()
    post.refresh_from_db()
    assert post.published_snapshot["title"] == "Example scheduled (fixture)"
    assert post.has_unpublished_changes


def test_tick_closes_expired_roles_exactly_once(superadmin):
    role = make_role(actor=superadmin, closes_in=timedelta(days=1))
    expire_role(role)
    keep = make_role("Example open role (fixture)", actor=superadmin, closes_in=timedelta(days=3))
    assert tick.run()["closed"] == 1
    assert tick.run()["closed"] == 0
    role.refresh_from_db()
    assert role.status == RoleStatus.CLOSED and role.closed_at == role.published_closes_at
    assert SyncEvent.objects.filter(entity_id=str(role.pk), action="role.closed").count() == 1
    assert Role.objects.get(pk=keep.pk).status == RoleStatus.OPEN


def test_tick_reports_next_due_at(superadmin):
    assert tick.run()["nextDueAt"] is None
    role = make_role(actor=superadmin, closes_in=timedelta(days=2))
    result = tick.run()
    assert result["nextDueAt"] == role.published_closes_at.strftime("%Y-%m-%dT%H:%M:%SZ")


def test_daily_part_runs_once_per_day(superadmin):
    tick.run()
    first = TickState.load().last_daily_at
    tick.run()
    assert TickState.load().last_daily_at == first


def test_management_command(superadmin):
    _scheduled(superadmin)
    out = io.StringIO()
    call_command("content_tick", stdout=out)
    assert "promoted=1" in out.getvalue()


def test_opportunistic_tick_runs_at_most_once_a_minute(settings, monkeypatch):
    started = []
    monkeypatch.setattr(
        tick.threading, "Thread", lambda **kwargs: type("T", (), {"start": lambda self: started.append(1)})()
    )
    settings.CONTENT_OPPORTUNISTIC_TICK = True
    assert tick.maybe_run_async() is True
    assert tick.maybe_run_async() is False
    TickState.objects.filter(pk=1).update(last_run_at=timezone.now() - timedelta(seconds=61))
    assert tick.maybe_run_async() is True
    assert len(started) == 2
    settings.CONTENT_OPPORTUNISTIC_TICK = False
    TickState.objects.filter(pk=1).update(last_run_at=None)
    assert tick.maybe_run_async() is False


def test_read_api_and_admin_pages_trigger_the_opportunistic_tick(
    settings, monkeypatch, client_for, superadmin, client
):
    from .content_helpers import signed_get

    calls = []
    monkeypatch.setattr(tick, "maybe_run_async", lambda: calls.append(1) or True)
    signed_get(client, "/api/content/v1/health")
    client_for(superadmin).get("/insights/posts/")
    client_for(superadmin).get("/")
    assert len(calls) == 2


@pytest.mark.django_db(transaction=True, serialized_rollback=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql", reason="skip_locked needs PostgreSQL (set DATABASE_URL)"
)
def test_concurrent_ticks_promote_and_close_exactly_once_on_postgres(superadmin):
    posts = [_scheduled(superadmin, f"Example concurrent {index} (fixture)") for index in range(3)]
    roles = [
        make_role(f"Example concurrent role {index} (fixture)", actor=superadmin, closes_in=timedelta(days=1))
        for index in range(3)
    ]
    for role in roles:
        expire_role(role)
    TickState.load()
    results, errors = [], []
    barrier = threading.Barrier(4)

    def worker():
        try:
            barrier.wait()
            results.append(tick.run())
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)
        finally:
            connection.close()

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert not errors
    assert sum(result["promoted"] for result in results) == 3
    assert sum(result["closed"] for result in results) == 3
    for post in posts:
        assert PostRevision.objects.filter(post=post).count() == 1
        assert SyncEvent.objects.filter(entity_id=str(post.pk), action="post.published").count() == 1
    for role in roles:
        assert SyncEvent.objects.filter(entity_id=str(role.pk), action="role.closed").count() == 1


def test_select_for_update_skip_locked_is_accepted_on_this_database():
    with transaction.atomic():
        assert list(Post.objects.select_for_update(skip_locked=True).filter(pk=None)) == []
