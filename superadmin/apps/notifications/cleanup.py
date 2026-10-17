"""Remove what the browser smoke test (``e2e/smoke.py``) leaves behind (finding E5).

The smoke test names every record it creates "Smoke test …" and archives them at the end; their
project-status and KPI-breach notifications still reach every super admin. ``purge_smoke_test``
finds those notifications and the archived smoke records. It is a dry run unless ``apply=True``.
Only archived records whose name starts with "Smoke test " are touched; live records never are.
"""

from dataclasses import dataclass, field

from django.db import transaction

from .models import Notification

PREFIX = "Smoke test "


@dataclass
class PurgeReport:
    counts: dict[str, int] = field(default_factory=dict)

    @property
    def total(self) -> int:
        return sum(self.counts.values())


def _smoke_notifications():
    return Notification.objects.filter(title__contains=PREFIX)


def _smoke_records():
    from apps.architecture.models import KPI, Offer, Practice, Project, Solution

    # Children first, so a cascade never removes something the report did not count.
    for model in (Offer, Solution, Practice, KPI, Project):
        yield model._meta.verbose_name_plural, model.objects.filter(name__startswith=PREFIX, is_archived=True)


def purge_smoke_test(*, apply: bool = False) -> PurgeReport:
    report = PurgeReport()
    with transaction.atomic():
        notifications = _smoke_notifications()
        report.counts["notifications"] = notifications.count()
        if apply:
            notifications.delete()
        for label, queryset in _smoke_records():
            report.counts[f"archived {label}"] = queryset.count()
            if apply:
                for obj in queryset:
                    obj.delete()
    return report
