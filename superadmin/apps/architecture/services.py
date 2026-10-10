"""Write rules for the company architecture. Views call these; they never save models directly."""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.accounts.roles import SUPERADMIN, has_service_access, is_superadmin
from apps.notifications.models import Notification
from apps.notifications.services import notify

from .models import KPI, Company, KPIValue, Project, ServiceLine, TeamMember
from .selectors import can_view


def superadmins():
    User = get_user_model()
    return User.objects.filter(Q(is_superuser=True) | Q(groups__name=SUPERADMIN), is_active=True).distinct()


def service_line_of(obj) -> ServiceLine | None:
    if isinstance(obj, ServiceLine):
        return obj
    if isinstance(obj, TeamMember):
        return None
    return getattr(obj, "service_line", None)


def can_edit(user, obj) -> bool:
    """Whether ``user`` may create/change/archive ``obj``.

    Service lines, the company profile and team members span the company, so only SuperAdmin edits
    them. Everything else needs ``has_service_access`` for its service line *and* read access to the
    record's classification, so a ServiceLead can never act on (or create) a Restricted record.
    """
    if is_superadmin(user):
        return True
    if isinstance(obj, ServiceLine | Company | TeamMember):
        return False
    return has_service_access(user, service_line_of(obj)) and can_view(user, obj)


def ensure_can_edit(user, obj) -> None:
    if not can_edit(user, obj):
        raise PermissionDenied


def save_record(instance, user, reason: str | None = None):
    """Validate and save a governed record, stamping who created/changed it."""
    if instance._state.adding and instance.created_by_id is None:
        instance.created_by = user
    instance.updated_by = user
    instance.full_clean()
    if reason:
        instance._change_reason = reason
    instance.save()
    return instance


@transaction.atomic
def archive(instance, user):
    ensure_can_edit(user, instance)
    if not instance.is_archived:
        instance.is_archived = True
        instance.archived_at = timezone.now()
        save_record(instance, user, reason="Archived")
    return instance


@transaction.atomic
def restore(instance, user):
    ensure_can_edit(user, instance)
    if instance.is_archived:
        instance.is_archived = False
        instance.archived_at = None
        save_record(instance, user, reason="Restored")
    return instance


def _normalise_service_line_order() -> list[ServiceLine]:
    lines = list(ServiceLine.objects.order_by("order", "name", "pk"))
    for index, line in enumerate(lines, start=1):
        if line.order != index:
            ServiceLine.objects.filter(pk=line.pk).update(order=index)
            line.order = index
    return lines


@transaction.atomic
def move_service_line(service_line: ServiceLine, direction: str, user) -> None:
    """Swap a service line with its neighbour (``direction`` is ``up`` or ``down``)."""
    if not is_superadmin(user):
        raise PermissionDenied
    lines = _normalise_service_line_order()
    index = next(i for i, line in enumerate(lines) if line.pk == service_line.pk)
    other_index = index - 1 if direction == "up" else index + 1
    if other_index < 0 or other_index >= len(lines):
        return
    current, other = lines[index], lines[other_index]
    current.order, other.order = other.order, current.order
    save_record(current, user, reason="Reordered")
    save_record(other, user, reason="Reordered")


@transaction.atomic
def set_service_line_active(service_line: ServiceLine, active: bool, user) -> ServiceLine:
    if not is_superadmin(user):
        raise PermissionDenied
    if service_line.is_active != active:
        service_line.is_active = active
        save_record(service_line, user, reason="Reactivated" if active else "Retired")
    return service_line


def next_service_line_order() -> int:
    last = ServiceLine.objects.order_by("-order").values_list("order", flat=True).first()
    return (last or 0) + 1


def notify_project_status(project: Project, previous_status: str, user) -> int:
    if previous_status == project.status:
        return 0
    recipients = list(superadmins())
    if project.service_line.owner:
        recipients.append(project.service_line.owner)
    if project.lead and project.lead.user:
        recipients.append(project.lead.user)
    old = Project.Status(previous_status).label if previous_status else "new"
    return notify(
        recipients,
        Notification.Kind.PROJECT_STATUS,
        title=f"{project.name}: {old} → {project.get_status_display()}",
        body=f"{project.service_line.name} project status changed by {user}.",
        url=project.get_absolute_url(),
        exclude=user,
    )


@transaction.atomic
def save_project(project: Project, user, previous_status: str | None = None) -> Project:
    ensure_can_edit(user, project)
    save_record(project, user)
    if previous_status is not None:
        notify_project_status(project, previous_status, user)
    return project


@transaction.atomic
def change_project_status(project: Project, status: str, user) -> Project:
    ensure_can_edit(user, project)
    if status not in Project.Status.values:
        raise ValueError("Unknown project status.")
    previous = project.status
    if previous != status:
        project.status = status
        save_record(project, user, reason="Status changed")
        notify_project_status(project, previous, user)
    return project


def notify_kpi_breach(kpi_value: KPIValue) -> int:
    kpi = kpi_value.kpi
    if not kpi.is_breach(kpi_value.value):
        return 0
    recipients = list(superadmins())
    if kpi.service_line.owner:
        recipients.append(kpi.service_line.owner)
    comparator = "below" if kpi.direction == KPI.Direction.HIGHER else "above"
    unit = f" {kpi.unit}" if kpi.unit else ""
    return notify(
        recipients,
        Notification.Kind.KPI_BREACH,
        title=f"KPI breach: {kpi.name} ({kpi.service_line.name})",
        body=f"{kpi_value.value}{unit} on {kpi_value.date:%d %b %Y} is {comparator} the target of "
        f"{kpi.target}{unit}.",
        url=kpi.get_absolute_url(),
    )


@transaction.atomic
def record_kpi_value(kpi: KPI, on: date, value: Decimal, user, classification=None) -> tuple[KPIValue, bool]:
    """Create or update the value for ``kpi`` on ``on``; notifies on target breach."""
    ensure_can_edit(user, kpi)
    kpi_value = KPIValue.objects.filter(kpi=kpi, date=on).first()
    created = kpi_value is None
    if created:
        kpi_value = KPIValue(
            kpi=kpi, date=on, value=value, classification=classification or kpi.classification
        )
    elif kpi_value.value == value and not kpi_value.is_archived:
        return kpi_value, False
    else:
        kpi_value.value = value
        kpi_value.is_archived = False
        kpi_value.archived_at = None
    save_record(kpi_value, user)
    notify_kpi_breach(kpi_value)
    return kpi_value, created


@transaction.atomic
def save_kpi_value(kpi_value: KPIValue, user) -> KPIValue:
    ensure_can_edit(user, kpi_value.kpi)
    save_record(kpi_value, user)
    notify_kpi_breach(kpi_value)
    return kpi_value


def bump_order_after(model, **filters) -> int:
    last = model.objects.filter(**filters).order_by("-order").values_list("order", flat=True).first()
    return (last or 0) + 1
