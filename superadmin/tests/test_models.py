from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.architecture import services
from apps.architecture.models import KPI, Company, Practice, Project, ServiceLine, Solution
from apps.core.models import Classification


@pytest.mark.django_db
def test_seed_loads_company_and_six_lines_in_order(seeded):
    company = Company.load()
    assert company.name == "Vitalos"
    assert company.tagline == "From strategy to production."
    assert company.business_modes == ["ADVISE", "BUILD", "OPERATE", "CREATE"]
    assert company.vision.startswith("Build one of the world's most trusted AI-centred")
    assert company.mission == "Help organisations turn technology and AI into measurable business advantage."
    assert list(ServiceLine.objects.values_list("name", flat=True)) == [
        "Vitalos Consulting",
        "Vitalos Engineering",
        "Vitalos AI & Data",
        "Vitalos Experience",
        "Vitalos Managed Services",
        "Vitalos Labs",
    ]


@pytest.mark.django_db
def test_company_is_a_singleton(seeded):
    other = Company(name="Another")
    other.save()
    assert Company.objects.count() == 1
    assert Company.load().name == "Another"


@pytest.mark.django_db
def test_business_modes_are_validated_and_ordered(seeded, superadmin):
    line = seeded["labs"]
    line.business_modes = ["CREATE", "ADVISE"]
    services.save_record(line, superadmin)
    assert line.business_modes == ["ADVISE", "CREATE"]
    line.business_modes = ["DREAM"]
    with pytest.raises(ValidationError):
        line.full_clean()


@pytest.mark.django_db
def test_slug_is_generated_and_unique_per_parent(seeded, superadmin):
    line = seeded["consulting"]
    practice = services.save_record(Practice(service_line=line, name="Cloud Strategy"), superadmin)
    assert practice.slug == "cloud-strategy"
    with pytest.raises(ValidationError):
        services.save_record(Practice(service_line=line, name="Cloud Strategy"), superadmin)
    # The same slug is fine under another service line.
    services.save_record(Practice(service_line=seeded["engineering"], name="Cloud Strategy"), superadmin)


@pytest.mark.django_db
def test_audit_fields_and_history_are_recorded(seeded, superadmin):
    practice = services.save_record(
        Practice(service_line=seeded["consulting"], name="Data Strategy"), superadmin
    )
    assert practice.created_by == superadmin and practice.updated_by == superadmin
    practice.status = "active"
    services.save_record(practice, superadmin)
    history = list(practice.history.order_by("history_date"))
    assert [h.history_type for h in history] == ["+", "~"]
    assert history[-1].status == "active"


@pytest.mark.django_db
def test_archive_and_restore_keep_history(seeded, superadmin):
    practice = services.save_record(
        Practice(service_line=seeded["consulting"], name="Archivable"), superadmin
    )
    services.archive(practice, superadmin)
    practice.refresh_from_db()
    assert practice.is_archived and practice.archived_at is not None
    assert not Practice.objects.active().filter(pk=practice.pk).exists()
    services.restore(practice, superadmin)
    practice.refresh_from_db()
    assert not practice.is_archived and practice.archived_at is None
    reasons = list(practice.history.order_by("history_date").values_list("history_change_reason", flat=True))
    assert reasons[-2:] == ["Archived", "Restored"]
    assert Practice.objects.filter(pk=practice.pk).exists()  # never deleted


@pytest.mark.django_db
def test_project_defaults_to_confidential_and_validates_dates(seeded, superadmin):
    project = Project(service_line=seeded["engineering"], name="Platform build")
    assert project.classification == Classification.CONFIDENTIAL
    project.start_date, project.end_date = date(2026, 5, 1), date(2026, 4, 1)
    with pytest.raises(ValidationError):
        services.save_record(project, superadmin)


@pytest.mark.parametrize(
    ("direction", "value", "breach"),
    [("higher", "40", True), ("higher", "50", False), ("lower", "60", True), ("lower", "50", False)],
)
def test_kpi_breach_direction(direction, value, breach):
    kpi = KPI(name="Utilisation", target=Decimal("50"), direction=direction)
    assert kpi.is_breach(Decimal(value)) is breach
    assert KPI(name="No target").is_breach(Decimal("1")) is False


@pytest.mark.django_db
def test_record_kpi_value_upserts_by_date(seeded, superadmin):
    kpi = services.save_record(
        KPI(service_line=seeded["labs"], name="Experiments", target=Decimal("3")), superadmin
    )
    first, created = services.record_kpi_value(kpi, date(2026, 9, 30), Decimal("2"), superadmin)
    assert created
    second, created = services.record_kpi_value(kpi, date(2026, 9, 30), Decimal("4"), superadmin)
    assert not created and first.pk == second.pk and second.value == Decimal("4")


@pytest.mark.django_db
def test_move_service_line_reorders(seeded, superadmin):
    services.move_service_line(seeded["engineering"], "up", superadmin)
    assert list(ServiceLine.objects.values_list("slug", flat=True)[:2]) == ["engineering", "consulting"]
    services.move_service_line(seeded["engineering"], "up", superadmin)  # already first: no-op
    assert ServiceLine.objects.first().slug == "engineering"


@pytest.mark.django_db
def test_solution_service_line_resolves_through_practice(seeded, superadmin):
    practice = services.save_record(Practice(service_line=seeded["ai-data"], name="ML Ops"), superadmin)
    solution = services.save_record(Solution(practice=practice, name="Model monitoring"), superadmin)
    assert solution.service_line == seeded["ai-data"]
    assert "tab=structure" in solution.get_absolute_url()
