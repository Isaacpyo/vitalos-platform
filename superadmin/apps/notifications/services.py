"""Create and read in-app notifications. Email delivery is a Phase 2 adapter."""

from collections.abc import Iterable

from django.utils import timezone

from apps.core.synthetic import exclude_synthetic_text

from .models import Notification


def visible_notifications(user):
    """A user's notifications without those about smoke-test records."""
    return exclude_synthetic_text(Notification.objects.filter(recipient=user), "title", "body")


def notify(recipients: Iterable, kind: str, title: str, body: str = "", url: str = "", exclude=None) -> int:
    """Create one notification per distinct active recipient; returns how many were created."""
    seen: set[int] = set()
    rows = []
    for user in recipients:
        if user is None or not user.is_active or user.pk in seen:
            continue
        if exclude is not None and user.pk == exclude.pk:
            continue
        seen.add(user.pk)
        rows.append(Notification(recipient=user, kind=kind, title=title[:200], body=body, url=url[:500]))
    Notification.objects.bulk_create(rows)
    return len(rows)


def unread_count(user) -> int:
    if not user.is_authenticated:
        return 0
    return visible_notifications(user).filter(read_at__isnull=True).count()


def mark_read(user, notification_id: int) -> Notification | None:
    notification = Notification.objects.filter(recipient=user, pk=notification_id).first()
    if notification and notification.read_at is None:
        notification.read_at = timezone.now()
        notification.save(update_fields=["read_at"])
    return notification


def mark_all_read(user) -> int:
    return Notification.objects.filter(recipient=user, read_at__isnull=True).update(read_at=timezone.now())
