import csv
import io
from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import PermissionDenied
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.architecture import csv_io, services
from apps.architecture.models import KPI, KPIValue, Offer, Practice, Project, Solution, TeamMember


@pytest.fixture
def data(seeded, superadmin):
    line = seeded["consulting"]
    practice = services.save_record(Practice(service_line=line, name="Cloud", summary="=SUM(A1)"), superadmin)
    solution = services.save_record(Solution(practice=practice, name="Landing zones"), superadmin)
    services.save_record(Offer(solution=solution, name="Accelerator", status="active"), superadmin)
    member = services.save_record(TeamMember(name="Sam Example", email="sam@example.test"), superadmin)
    member.service_lines.add(line, seeded["labs"])
    services.save_record(
        Project(
            service_line=line,
            name="Foundation",
            client="-Acme",
            lead=member,
            value=Decimal("1250.50"),
            start_date=date(2026, 1, 5),
        ),
        superadmin,
    )
    kpi = services.save_record(
        KPI(service_line=line, name="Utilisation", unit="%", target=Decimal("75")), superadmin
    )
    services.record_kpi_value(kpi, date(2026, 9, 30), Decimal("80"), superadmin)
    return line


def history_count():
    return sum(model.history.count() for model in (Practice, Solution, Offer, Project, KPIValue, TeamMember))


@pytest.mark.django_db
@pytest.mark.parametrize("key", list(csv_io.RESOURCES))
def test_csv_round_trip_is_a_no_op(key, data, superadmin):
    resource = csv_io.RESOURCES[key]
    exported = csv_io.export_csv(resource, superadmin)
    rows = list(csv.DictReader(io.StringIO(exported)))
    assert rows, key
    before = history_count()
    dry = csv_io.run_import(resource, exported.encode(), superadmin, dry_run=True)
    assert not dry.has_errors, dry
    assert dry.summary == {"created": 0, "updated": 0, "unchanged": len(rows), "error": 0}
    real = csv_io.run_import(resource, exported.encode(), superadmin, dry_run=False)
    assert real.committed and real.summary["unchanged"] == len(rows)
    assert history_count() == before
    assert csv_io.export_csv(resource, superadmin) == exported


@pytest.mark.django_db
def test_formula_cells_are_escaped_and_restored(data, superadmin):
    exported = csv_io.export_csv(csv_io.RESOURCES["practices"], superadmin)
    assert "'=SUM(A1)" in exported
    projects = csv_io.export_csv(csv_io.RESOURCES["projects"], superadmin)
    assert "'-Acme" in projects and ",1250.50," in projects


@pytest.mark.django_db
def test_dry_run_reports_changes_without_saving(data, superadmin):
    resource = csv_io.RESOURCES["practices"]
    exported = csv_io.export_csv(resource, superadmin)
    edited = (
        exported.replace("Cloud,", "Cloud & Platform,")
        + "consulting,,Data Strategy,,draft,emerging,internal,2,false\n"
    )
    report = csv_io.run_import(resource, edited.encode(), superadmin, dry_run=True)
    assert report.summary == {"created": 1, "updated": 1, "unchanged": 0, "error": 0}
    assert not report.committed
    assert not Practice.objects.filter(name="Data Strategy").exists()
    assert Practice.objects.filter(name="Cloud").exists()
    report = csv_io.run_import(resource, edited.encode(), superadmin, dry_run=False)
    assert report.committed
    assert Practice.objects.filter(name="Data Strategy", slug="data-strategy").exists()
    assert Practice.objects.filter(name="Cloud & Platform").exists()


@pytest.mark.django_db
def test_any_row_error_rolls_back_everything(data, superadmin):
    resource = csv_io.RESOURCES["projects"]
    content = (
        "id,service_line,name,client,status,start_date,end_date,lead_email,value,classification,is_archived\n"
        ",consulting,Good project,,active,2026-01-01,,,,confidential,false\n"
        ",nowhere,Bad line,,active,,,,,confidential,false\n"
        ",consulting,Bad date,,active,01/02/2026,,,,confidential,false\n"
        ",consulting,Bad status,,dreaming,,,,,confidential,false\n"
        ",consulting,Backwards,,active,2026-05-01,2026-04-01,,,confidential,false\n"
    )
    report = csv_io.run_import(resource, content.encode(), superadmin, dry_run=False)
    assert report.summary["error"] == 4 and report.summary["created"] == 1
    assert not report.committed
    assert not Project.objects.filter(name="Good project").exists()
    errors = " ".join(" ".join(row.errors) for row in report.rows)
    assert "nowhere" in errors and "YYYY-MM-DD" in errors and "dreaming" in errors and "End date" in errors


@pytest.mark.django_db
def test_missing_columns_and_bad_encoding_are_reported(data, superadmin):
    resource = csv_io.RESOURCES["kpi_values"]
    assert csv_io.run_import(resource, b"kpi,date\n", superadmin).file_errors
    assert csv_io.run_import(resource, "\udcff".encode("utf-8", "surrogateescape"), superadmin).file_errors


@pytest.mark.django_db
def test_kpi_value_import_upserts_and_notifies_on_breach(data, superadmin):
    resource = csv_io.RESOURCES["kpi_values"]
    content = "service_line,kpi,date,value,classification,is_archived\nconsulting,utilisation,2026-10-31,60,internal,false\n"
    report = csv_io.run_import(resource, content.encode(), superadmin, dry_run=False)
    assert report.committed and report.summary["created"] == 1
    assert superadmin.notifications.filter(kind="kpi_breach").exists()


@pytest.mark.django_db
def test_team_member_import_sets_service_lines(data, superadmin):
    resource = csv_io.RESOURCES["team_members"]
    content = "id,name,role_title,email,service_lines,classification,is_archived\n,Jo Example,Engineer,jo@example.test,engineering;labs,internal,false\n"
    report = csv_io.run_import(resource, content.encode(), superadmin, dry_run=False)
    assert report.committed
    member = TeamMember.objects.get(email="jo@example.test")
    assert sorted(member.service_lines.values_list("slug", flat=True)) == ["engineering", "labs"]


@pytest.mark.django_db
def test_import_requires_superadmin(data, viewer):
    with pytest.raises(PermissionDenied):
        csv_io.run_import(csv_io.RESOURCES["practices"], b"", viewer)


@pytest.mark.django_db
def test_export_respects_classification(data, superadmin, viewer):
    projects = csv_io.export_csv(csv_io.RESOURCES["projects"], viewer)
    assert "Foundation" not in projects  # Confidential by default
    assert "Foundation" in csv_io.export_csv(csv_io.RESOURCES["projects"], superadmin)


@pytest.mark.django_db
def test_import_view_round_trip(data, make_user, client_for):
    admin = make_user("SuperAdmin")
    client = client_for(admin)
    exported = client.get("/settings/data/export/offers.csv")
    assert exported["Content-Type"].startswith("text/csv")
    assert "attachment;" in exported["Content-Disposition"]
    upload = SimpleUploadedFile("offers.csv", exported.content, content_type="text/csv")
    response = client.post("/settings/data/", {"resource": "offers", "file": upload, "dry_run": "on"})
    assert response.status_code == 200
    assert b'data-testid="import-report"' in response.content and b"Dry run" in response.content


@pytest.mark.django_db
def test_import_without_archive_column_keeps_archive_state(data, superadmin):
    practice = Practice.objects.get(name="Cloud")
    services.archive(practice, superadmin)
    content = "service_line,slug,name,summary,status,maturity,classification,order\nconsulting,cloud,Cloud,,draft,emerging,internal,0\n"
    report = csv_io.run_import(csv_io.RESOURCES["practices"], content.encode(), superadmin, dry_run=False)
    assert report.committed
    practice.refresh_from_db()
    assert practice.is_archived


@pytest.mark.django_db
def test_blank_classification_never_downgrades(data, superadmin):
    project = Project.objects.get(name="Foundation")
    project.classification = "restricted"
    services.save_record(project, superadmin)
    content = (
        "id,service_line,name,client,status,start_date,end_date,lead_email,value,classification,is_archived\n"
        f"{project.pk},consulting,Foundation,-Acme,pipeline,2026-01-05,,sam@example.test,1250.50,,false\n"
    )
    report = csv_io.run_import(csv_io.RESOURCES["projects"], content.encode(), superadmin, dry_run=False)
    assert report.committed and report.summary["unchanged"] == 1
    project.refresh_from_db()
    assert project.classification == "restricted"


@pytest.mark.django_db
def test_non_ascii_digits_are_a_row_error_not_a_crash(data, superadmin):
    content = (
        "id,name,role_title,email,service_lines,classification,is_archived\n²,Jo,Engineer,,,internal,false\n"
    )
    report = csv_io.run_import(csv_io.RESOURCES["team_members"], content.encode(), superadmin, dry_run=True)
    assert report.summary["error"] == 1 and "not a number" in report.rows[0].errors[0]
