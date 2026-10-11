"""Settings tabs owned by the architecture app: company profile and CSV data import/export."""

from django.core.exceptions import PermissionDenied
from django.http import Http404, HttpResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.roles import SUPERADMIN, is_superadmin, role_required
from apps.core.htmx import changed_response

from .. import csv_io, services
from ..forms import CompanyForm, CsvImportForm
from ..models import Company


@role_required(SUPERADMIN)
@require_http_methods(["GET", "POST"])
def settings_company(request):
    company = Company.load() or Company(name="Vitalos")
    form = CompanyForm(request.POST or None, instance=company)
    if request.method == "POST" and form.is_valid():
        services.save_record(form.save(commit=False), request.user)
        return changed_response(request, request.path, "Company profile saved.")
    return render(request, "settings/company.html", {"form": form, "tab": "company"})


@role_required()
@require_http_methods(["GET", "POST"])
def settings_data(request):
    choices = [(resource.key, resource.label) for resource in csv_io.RESOURCES.values()]
    can_import = is_superadmin(request.user)
    form = CsvImportForm(request.POST or None, request.FILES or None, resources=choices)
    report = None
    if request.method == "POST":
        if not can_import:
            raise PermissionDenied
        if form.is_valid():
            resource = csv_io.RESOURCES[form.cleaned_data["resource"]]
            report = csv_io.run_import(
                resource, form.cleaned_data["file"].read(), request.user, dry_run=form.cleaned_data["dry_run"]
            )
    context = {
        "form": form,
        "resources": csv_io.RESOURCES.values(),
        "report": report,
        "can_import": can_import,
        "tab": "data",
    }
    return render(request, "settings/data.html", context)


@role_required()
@require_GET
def csv_export(request, resource):
    selected = csv_io.RESOURCES.get(resource)
    if selected is None:
        raise Http404
    body = csv_io.export_csv(selected, request.user)
    response = HttpResponse(body, content_type="text/csv; charset=utf-8")
    stamp = timezone.localdate().isoformat()
    response["Content-Disposition"] = f'attachment; filename="vitalos-{selected.key}-{stamp}.csv"'
    return response
