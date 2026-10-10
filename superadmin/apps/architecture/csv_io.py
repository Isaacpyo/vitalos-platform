"""CSV export and validated (dry-run capable) import for the architecture.

Every import runs inside one transaction. Each row is validated with the model's own rules in a
savepoint; a dry run, or any row error, rolls the whole import back so data is never half-loaded.
"""

import csv
import io
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ObjectDoesNotExist, PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.accounts.roles import is_superadmin
from apps.core.models import Classification

from . import services
from .models import (
    KPI,
    KPIValue,
    Maturity,
    Offer,
    OfferingStatus,
    Practice,
    Project,
    ServiceLine,
    Solution,
    TeamMember,
)
from .selectors import visible

FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


class RowError(Exception):
    pass


def escape_cell(value) -> str:
    """Neutralise spreadsheet formula injection in exported text."""
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(FORMULA_PREFIXES) else text


def unescape_cell(text: str) -> str:
    text = (text or "").strip()
    if len(text) > 1 and text[0] == "'" and text[1] in "=+-@\t\r":
        return text[1:]
    return text


def _choice(value: str, choices, column: str, default=None) -> str:
    value = (value or "").strip()
    if not value and default is not None:
        return default
    by_value = {str(v).lower(): v for v, _ in choices}
    by_label = {str(label).lower(): v for v, label in choices}
    key = value.lower()
    if key in by_value:
        return by_value[key]
    if key in by_label:
        return by_label[key]
    raise RowError(f"{column}: {value!r} is not one of {', '.join(str(v) for v, _ in choices)}.")


def _bool(value: str) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "y"}


def _decimal(value: str, column: str, required=False) -> Decimal | None:
    value = (value or "").strip().replace(",", "")
    if not value:
        if required:
            raise RowError(f"{column} is required.")
        return None
    try:
        return Decimal(value)
    except InvalidOperation as exc:
        raise RowError(f"{column}: {value!r} is not a number.") from exc


def _int(value: str, column: str) -> int:
    value = (value or "").strip()
    if not value:
        return 0
    if not value.isdigit():
        raise RowError(f"{column}: {value!r} is not a whole number.")
    return int(value)


def _date(value: str, column: str, required=False) -> date | None:
    value = (value or "").strip()
    if not value:
        if required:
            raise RowError(f"{column} is required.")
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise RowError(f"{column}: {value!r} is not a YYYY-MM-DD date.") from exc


def _get(model, column, **lookup):
    try:
        return model.objects.get(**lookup)
    except ObjectDoesNotExist as exc:
        shown = ", ".join(f"{v}" for v in lookup.values())
        raise RowError(f"{column}: no {model._meta.verbose_name} matches {shown!r}.") from exc


def _apply(instance, values: dict) -> bool:
    """Set attributes; return True when anything actually changed."""
    changed = instance._state.adding
    for name, value in values.items():
        try:
            current = getattr(instance, name)
        except ObjectDoesNotExist:  # an unset foreign key on a new record
            current = None
        if current != value:
            setattr(instance, name, value)
            changed = True
    return changed


def _archive_flag(instance, archived: bool) -> bool:
    if instance.is_archived == archived:
        return False
    instance.is_archived = archived
    instance.archived_at = timezone.now() if archived else None
    return True


@dataclass
class RowResult:
    line: int
    action: str  # created | updated | unchanged | error
    label: str = ""
    errors: list[str] = field(default_factory=list)


@dataclass
class ImportReport:
    resource: str
    dry_run: bool
    rows: list[RowResult] = field(default_factory=list)
    file_errors: list[str] = field(default_factory=list)
    committed: bool = False

    def count(self, action: str) -> int:
        return sum(1 for row in self.rows if row.action == action)

    @property
    def summary(self) -> dict[str, int]:
        return {action: self.count(action) for action in ("created", "updated", "unchanged", "error")}

    @property
    def has_errors(self) -> bool:
        return bool(self.file_errors) or any(row.action == "error" for row in self.rows)


class Resource:
    key = ""
    label = ""
    model = None
    columns: list[str] = []
    required: list[str] = []
    #: Columns that are text and must be formula-escaped on export.
    numeric_columns: set[str] = set()

    def queryset(self, user):
        return visible(self.model.objects.all(), user)

    def export_row(self, obj) -> dict:
        raise NotImplementedError

    def import_row(self, row: dict, user) -> tuple[str, str]:
        raise NotImplementedError

    def _save(self, instance, changed: bool, user) -> str:
        if not changed:
            return "unchanged"
        created = instance._state.adding
        services.ensure_can_edit(user, instance)
        services.save_record(instance, user, reason="CSV import")
        return "created" if created else "updated"


class OfferingResource(Resource):
    numeric_columns = {"order"}

    def _offering_values(self, row):
        name = row.get("name", "")
        if not name:
            raise RowError("name is required.")
        return {
            "name": name,
            "summary": row.get("summary", ""),
            "status": _choice(row.get("status"), OfferingStatus.choices, "status", OfferingStatus.DRAFT),
            "maturity": _choice(row.get("maturity"), Maturity.choices, "maturity", Maturity.EMERGING),
            "classification": _choice(
                row.get("classification"), Classification.choices, "classification", Classification.INTERNAL
            ),
            "order": _int(row.get("order"), "order"),
        }

    def _common_export(self, obj):
        return {
            "slug": obj.slug,
            "name": obj.name,
            "summary": obj.summary,
            "status": obj.status,
            "maturity": obj.maturity,
            "classification": obj.classification,
            "order": obj.order,
            "is_archived": "true" if obj.is_archived else "false",
        }


OFFERING_COLUMNS = ["slug", "name", "summary", "status", "maturity", "classification", "order", "is_archived"]


class PracticeResource(OfferingResource):
    key, label, model = "practices", "Practices", Practice
    columns = ["service_line", *OFFERING_COLUMNS]

    def queryset(self, user):
        return (
            super()
            .queryset(user)
            .select_related("service_line")
            .order_by("service_line__order", "order", "name")
        )

    def export_row(self, obj):
        return {"service_line": obj.service_line.slug, **self._common_export(obj)}

    def import_row(self, row, user):
        line = _get(ServiceLine, "service_line", slug=row.get("service_line", ""))
        values = self._offering_values(row)
        slug = row.get("slug") or None
        instance = Practice.objects.filter(service_line=line, slug=slug).first() if slug else None
        instance = instance or Practice(service_line=line, slug=slug or "")
        changed = _apply(instance, values) | _archive_flag(instance, _bool(row.get("is_archived")))
        return self._save(instance, changed, user), instance.name


class SolutionResource(OfferingResource):
    key, label, model = "solutions", "Solutions", Solution
    columns = ["service_line", "practice", *OFFERING_COLUMNS]

    def queryset(self, user):
        return (
            super()
            .queryset(user)
            .select_related("practice__service_line")
            .order_by("practice__service_line__order", "practice__order", "order", "name")
        )

    def export_row(self, obj):
        return {
            "service_line": obj.practice.service_line.slug,
            "practice": obj.practice.slug,
            **self._common_export(obj),
        }

    def import_row(self, row, user):
        practice = _get(
            Practice, "practice", service_line__slug=row.get("service_line", ""), slug=row.get("practice", "")
        )
        values = self._offering_values(row)
        slug = row.get("slug") or None
        instance = Solution.objects.filter(practice=practice, slug=slug).first() if slug else None
        instance = instance or Solution(practice=practice, slug=slug or "")
        changed = _apply(instance, values) | _archive_flag(instance, _bool(row.get("is_archived")))
        return self._save(instance, changed, user), instance.name


class OfferResource(OfferingResource):
    key, label, model = "offers", "Offers", Offer
    columns = ["service_line", "practice", "solution", *OFFERING_COLUMNS]

    def queryset(self, user):
        return (
            super()
            .queryset(user)
            .select_related("solution__practice__service_line")
            .order_by(
                "solution__practice__service_line__order",
                "solution__practice__order",
                "solution__order",
                "order",
            )
        )

    def export_row(self, obj):
        return {
            "service_line": obj.solution.practice.service_line.slug,
            "practice": obj.solution.practice.slug,
            "solution": obj.solution.slug,
            **self._common_export(obj),
        }

    def import_row(self, row, user):
        solution = _get(
            Solution,
            "solution",
            practice__service_line__slug=row.get("service_line", ""),
            practice__slug=row.get("practice", ""),
            slug=row.get("solution", ""),
        )
        values = self._offering_values(row)
        slug = row.get("slug") or None
        instance = Offer.objects.filter(solution=solution, slug=slug).first() if slug else None
        instance = instance or Offer(solution=solution, slug=slug or "")
        changed = _apply(instance, values) | _archive_flag(instance, _bool(row.get("is_archived")))
        return self._save(instance, changed, user), instance.name


class ProjectResource(Resource):
    key, label, model = "projects", "Projects", Project
    columns = [
        "id",
        "service_line",
        "name",
        "client",
        "status",
        "start_date",
        "end_date",
        "lead_email",
        "value",
        "classification",
        "is_archived",
    ]
    numeric_columns = {"id", "value", "start_date", "end_date"}

    def queryset(self, user):
        return super().queryset(user).select_related("service_line", "lead").order_by("pk")

    def export_row(self, obj):
        return {
            "id": obj.pk,
            "service_line": obj.service_line.slug,
            "name": obj.name,
            "client": obj.client,
            "status": obj.status,
            "start_date": obj.start_date.isoformat() if obj.start_date else "",
            "end_date": obj.end_date.isoformat() if obj.end_date else "",
            "lead_email": obj.lead.email if obj.lead else "",
            "value": "" if obj.value is None else f"{obj.value:.2f}",
            "classification": obj.classification,
            "is_archived": "true" if obj.is_archived else "false",
        }

    def import_row(self, row, user):
        line = _get(ServiceLine, "service_line", slug=row.get("service_line", ""))
        if not row.get("name"):
            raise RowError("name is required.")
        lead = None
        if row.get("lead_email"):
            lead = _get(TeamMember, "lead_email", email__iexact=row["lead_email"])
        raw_id = row.get("id", "")
        instance = None
        if raw_id:
            if not raw_id.isdigit():
                raise RowError(f"id: {raw_id!r} is not a number.")
            instance = _get(Project, "id", pk=int(raw_id))
        instance = instance or Project()
        previous_status = None if instance._state.adding else instance.status
        values = {
            "service_line": line,
            "name": row["name"],
            "client": row.get("client", ""),
            "status": _choice(row.get("status"), Project.Status.choices, "status", Project.Status.PIPELINE),
            "start_date": _date(row.get("start_date"), "start_date"),
            "end_date": _date(row.get("end_date"), "end_date"),
            "lead": lead,
            "value": _decimal(row.get("value"), "value"),
            "classification": _choice(
                row.get("classification"),
                Classification.choices,
                "classification",
                Classification.CONFIDENTIAL,
            ),
        }
        if not instance._state.adding:
            services.ensure_can_edit(user, instance)  # cannot move a project out of a line you cannot edit
        changed = _apply(instance, values) | _archive_flag(instance, _bool(row.get("is_archived")))
        action = self._save(instance, changed, user)
        if action == "updated" and previous_status is not None:
            services.notify_project_status(instance, previous_status, user)
        return action, instance.name


class KPIValueResource(Resource):
    key, label, model = "kpi_values", "KPI values", KPIValue
    columns = ["service_line", "kpi", "date", "value", "classification", "is_archived"]
    numeric_columns = {"date", "value"}

    def queryset(self, user):
        return (
            super()
            .queryset(user)
            .select_related("kpi__service_line")
            .order_by("kpi__service_line__order", "kpi__name", "date")
        )

    def export_row(self, obj):
        return {
            "service_line": obj.kpi.service_line.slug,
            "kpi": obj.kpi.name,
            "date": obj.date.isoformat(),
            "value": f"{obj.value:.2f}",
            "classification": obj.classification,
            "is_archived": "true" if obj.is_archived else "false",
        }

    def import_row(self, row, user):
        kpi = _get(
            KPI, "kpi", service_line__slug=row.get("service_line", ""), name__iexact=row.get("kpi", "")
        )
        on = _date(row.get("date"), "date", required=True)
        value = _decimal(row.get("value"), "value", required=True)
        instance = KPIValue.objects.filter(kpi=kpi, date=on).first() or KPIValue(kpi=kpi, date=on)
        values = {
            "value": value,
            "classification": _choice(
                row.get("classification"), Classification.choices, "classification", kpi.classification
            ),
        }
        changed = _apply(instance, values) | _archive_flag(instance, _bool(row.get("is_archived")))
        action = self._save(instance, changed, user)
        if action != "unchanged":
            services.notify_kpi_breach(instance)
        return action, str(instance)


class TeamMemberResource(Resource):
    key, label, model = "team_members", "Team members", TeamMember
    columns = ["id", "name", "role_title", "email", "service_lines", "classification", "is_archived"]
    numeric_columns = {"id"}

    def queryset(self, user):
        return super().queryset(user).prefetch_related("service_lines").order_by("name", "pk")

    def export_row(self, obj):
        return {
            "id": obj.pk,
            "name": obj.name,
            "role_title": obj.role_title,
            "email": obj.email,
            "service_lines": ";".join(line.slug for line in obj.service_lines.order_by("order")),
            "classification": obj.classification,
            "is_archived": "true" if obj.is_archived else "false",
        }

    def import_row(self, row, user):
        if not row.get("name"):
            raise RowError("name is required.")
        email = (row.get("email") or "").strip().lower()
        instance = None
        if row.get("id"):
            if not row["id"].isdigit():
                raise RowError(f"id: {row['id']!r} is not a number.")
            instance = _get(TeamMember, "id", pk=int(row["id"]))
        elif email:
            instance = TeamMember.objects.filter(email__iexact=email).first()
        instance = instance or TeamMember()
        slugs = [slug.strip() for slug in (row.get("service_lines") or "").split(";") if slug.strip()]
        lines = list(ServiceLine.objects.filter(slug__in=slugs))
        missing = set(slugs) - {line.slug for line in lines}
        if missing:
            raise RowError(f"service_lines: unknown slug(s) {', '.join(sorted(missing))}.")
        values = {
            "name": row["name"],
            "role_title": row.get("role_title", ""),
            "email": email,
            "classification": _choice(
                row.get("classification"), Classification.choices, "classification", Classification.INTERNAL
            ),
        }
        changed = _apply(instance, values) | _archive_flag(instance, _bool(row.get("is_archived")))
        current = (
            set() if instance._state.adding else set(instance.service_lines.values_list("pk", flat=True))
        )
        lines_changed = current != {line.pk for line in lines}
        action = self._save(instance, changed or lines_changed, user)
        if lines_changed:
            instance.service_lines.set(lines)
            if action == "unchanged":
                action = "updated"
        return action, instance.name


RESOURCES: dict[str, Resource] = {
    resource.key: resource
    for resource in (
        PracticeResource(),
        SolutionResource(),
        OfferResource(),
        ProjectResource(),
        KPIValueResource(),
        TeamMemberResource(),
    )
}


def export_csv(resource: Resource, user) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=resource.columns, lineterminator="\n")
    writer.writeheader()
    for obj in resource.queryset(user):
        row = resource.export_row(obj)
        writer.writerow(
            {
                column: row.get(column, "")
                if column in resource.numeric_columns
                else escape_cell(row.get(column))
                for column in resource.columns
            }
        )
    return buffer.getvalue()


def run_import(resource: Resource, content: bytes | str, user, dry_run: bool = True) -> ImportReport:
    if not is_superadmin(user):
        raise PermissionDenied
    report = ImportReport(resource=resource.key, dry_run=dry_run)
    try:
        text = content.decode("utf-8-sig") if isinstance(content, bytes) else content
    except UnicodeDecodeError:
        report.file_errors.append("The file must be UTF-8 encoded CSV.")
        return report
    reader = csv.DictReader(io.StringIO(text))
    header = [name.strip() for name in (reader.fieldnames or [])]
    missing = [
        column for column in resource.columns if column not in header and column not in {"id", "is_archived"}
    ]
    if not header:
        report.file_errors.append("The file is empty.")
        return report
    if missing:
        report.file_errors.append(f"Missing column(s): {', '.join(missing)}.")
        return report
    with transaction.atomic():
        for line_number, raw in enumerate(reader, start=2):
            row = {(key or "").strip(): unescape_cell(value) for key, value in raw.items() if key}
            if not any(row.values()):
                continue
            try:
                with transaction.atomic():
                    action, label = resource.import_row(row, user)
                report.rows.append(RowResult(line=line_number, action=action, label=label))
            except RowError as exc:
                report.rows.append(RowResult(line=line_number, action="error", errors=[str(exc)]))
            except ValidationError as exc:
                messages = [
                    f"{name}: {message}" if name != "__all__" else message
                    for name, items in getattr(exc, "message_dict", {"__all__": exc.messages}).items()
                    for message in items
                ]
                report.rows.append(RowResult(line=line_number, action="error", errors=messages))
            except PermissionDenied:
                report.rows.append(
                    RowResult(line=line_number, action="error", errors=["You cannot change this record."])
                )
        if dry_run or report.has_errors:
            transaction.set_rollback(True)
        else:
            report.committed = True
    return report
