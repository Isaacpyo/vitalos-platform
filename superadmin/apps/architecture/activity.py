"""Activity feed built from django-simple-history rows across the architecture models."""

import heapq
from dataclasses import dataclass, field
from datetime import datetime

from apps.accounts.roles import is_superadmin

from .models import (
    KPI,
    Company,
    Decision,
    KPIValue,
    Offer,
    Practice,
    Project,
    ServiceLine,
    Solution,
    TeamMember,
)
from .selectors import visibility_q

#: key → (model, label, history-row path to its service line, or None for company-wide records)
FEED_MODELS = {
    "serviceline": (ServiceLine, "Service line", "id"),
    "practice": (Practice, "Practice", "service_line"),
    "solution": (Solution, "Solution", "practice__service_line"),
    "offer": (Offer, "Offer", "solution__practice__service_line"),
    "project": (Project, "Project", "service_line"),
    "kpi": (KPI, "KPI", "service_line"),
    "kpivalue": (KPIValue, "KPI value", "kpi__service_line"),
    "decision": (Decision, "Decision", "service_line"),
    "teammember": (TeamMember, "Team member", None),
    "company": (Company, "Company", None),
}
MODEL_CHOICES = [(key, label) for key, (_, label, _) in FEED_MODELS.items()]
IGNORED_FIELDS = {"updated_at", "updated_by", "created_by", "created_at", "archived_at"}


@dataclass
class ActivityEntry:
    when: datetime
    model_key: str
    model_label: str
    action: str
    object_label: str
    actor: object
    url: str
    reason: str = ""
    changes: list[tuple[str, str, str]] = field(default_factory=list)
    history_id: int = 0


def _history_queryset(key, user, service_line=None):
    model, _, path = FEED_MODELS[key]
    queryset = model.history.select_related("history_user")
    if service_line is not None:
        if key == "company":
            return None
        if key == "teammember":
            member_ids = list(service_line.team_members.values_list("pk", flat=True))
            queryset = queryset.filter(id__in=member_ids)
        else:
            lookup = "id" if path == "id" else f"{path}_id"
            queryset = queryset.filter(**{lookup: service_line.pk})
    if not is_superadmin(user):
        # History rows keep the classification the record had at the time of the change.
        queryset = queryset.filter(visibility_q(user, path))
    return queryset.order_by("-history_date", "-history_id")


def _display(record, field_name, value):
    try:
        model_field = record.instance._meta.get_field(field_name)
    except Exception:  # noqa: BLE001 - history-only fields
        return str(value)
    if value in (None, ""):
        return "—"
    if model_field.choices:
        return str(dict(model_field.flatchoices).get(value, value))
    if isinstance(value, list):
        return ", ".join(map(str, value)) or "—"
    if model_field.is_relation:
        related = model_field.related_model.objects.filter(pk=value).first()
        return str(related) if related else f"#{value}"
    return str(value)


def _entry(key, record) -> ActivityEntry:
    _, label, _ = FEED_MODELS[key]
    action = {"+": "created", "~": "updated", "-": "deleted"}[record.history_type]
    reason = record.history_change_reason or ""
    changes = []
    if record.history_type == "~":
        previous = record.prev_record
        if previous is not None:
            # diff_against covers editable fields only; the archive flag is compared directly.
            if record.is_archived != previous.is_archived:
                action = "archived" if record.is_archived else "restored"
            delta = record.diff_against(previous, excluded_fields=list(IGNORED_FIELDS))
            for change in delta.changes:
                changes.append(
                    (
                        record.instance._meta.get_field(change.field).verbose_name.capitalize(),
                        _display(record, change.field, change.old),
                        _display(record, change.field, change.new),
                    )
                )
    if reason in {"Retired", "Reactivated", "Reordered", "Status changed"}:
        action = reason.lower()
    instance = record.instance
    try:
        url = instance.get_absolute_url() if hasattr(instance, "get_absolute_url") else ""
    except Exception:  # noqa: BLE001 - the parent may have been hard-deleted in Django admin
        url = ""
    return ActivityEntry(
        when=record.history_date,
        model_key=key,
        model_label=label,
        action=action,
        object_label=str(instance),
        actor=record.history_user,
        url=url,
        reason=reason,
        changes=changes,
        history_id=record.history_id,
    )


def feed(user, service_line=None, model_key: str | None = None, limit: int = 30, before=None):
    """Most recent visible changes, newest first, optionally scoped to a service line or model."""
    keys = [model_key] if model_key in FEED_MODELS else list(FEED_MODELS)
    streams = []
    for key in keys:
        queryset = _history_queryset(key, user, service_line)
        if queryset is None:
            continue
        if before is not None:
            queryset = queryset.filter(history_date__lt=before)
        rows = [(key, record) for record in queryset[:limit]]
        streams.append(rows)
    merged = heapq.merge(*streams, key=lambda item: item[1].history_date, reverse=True)
    entries = []
    for key, record in merged:
        entries.append(_entry(key, record))
        if len(entries) >= limit:
            break
    return entries
