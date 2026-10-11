"""Generic create / edit / archive / restore for every governed record, served as HTMX modals.

Without HTMX the same views render a full page and redirect, so forms still work.
"""

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_http_methods, require_POST

from apps.accounts.roles import role_required
from apps.core.htmx import changed_response, close_modal_response

from .. import forms, services
from ..models import (
    GOVERNED_MODELS,
    KPI,
    Decision,
    KPIValue,
    Offer,
    Practice,
    Project,
    ServiceLine,
    Solution,
    TeamMember,
)
from ..selectors import can_view

FORMS = {
    "serviceline": forms.ServiceLineForm,
    "practice": forms.PracticeForm,
    "solution": forms.SolutionForm,
    "offer": forms.OfferForm,
    "teammember": forms.TeamMemberForm,
    "project": forms.ProjectForm,
    "kpi": forms.KPIForm,
    "kpivalue": forms.KPIValueForm,
    "decision": forms.DecisionForm,
}
#: Forms whose choice fields are scoped to a service line.
SCOPED_FORMS = {"solution", "offer", "project", "kpi"}


def _model(kind: str):
    model = GOVERNED_MODELS.get(kind)
    if model is None:
        raise Http404
    return model


def _param(request, name):
    # The form posts back to its own URL, so parent identifiers stay in the query string.
    return request.GET.get(name, "")


def _new_instance(kind: str, request):
    """Build an unsaved record with its parent from the query string; return it and its service line."""
    line_slug = _param(request, "service_line")
    line = get_object_or_404(ServiceLine, slug=line_slug) if line_slug else None
    if kind == "serviceline":
        return ServiceLine(order=services.next_service_line_order()), None
    if kind == "practice":
        if line is None:
            raise Http404
        return Practice(service_line=line, order=services.bump_order_after(Practice, service_line=line)), line
    if kind == "solution":
        practice = (
            get_object_or_404(Practice, pk=_param(request, "practice"))
            if _param(request, "practice")
            else None
        )
        line = practice.service_line if practice else line
        if line is None:
            raise Http404
        instance = Solution(practice=practice) if practice else Solution()
        if practice:
            instance.order = services.bump_order_after(Solution, practice=practice)
        return instance, line
    if kind == "offer":
        solution = (
            get_object_or_404(Solution, pk=_param(request, "solution"))
            if _param(request, "solution")
            else None
        )
        line = solution.service_line if solution else line
        if line is None:
            raise Http404
        instance = Offer(solution=solution) if solution else Offer()
        if solution:
            instance.order = services.bump_order_after(Offer, solution=solution)
        return instance, line
    if kind == "teammember":
        return TeamMember(), line
    if kind == "project":
        if line is None:
            raise Http404
        return Project(service_line=line), line
    if kind == "kpi":
        if line is None:
            raise Http404
        return KPI(service_line=line, order=services.bump_order_after(KPI, service_line=line)), line
    if kind == "kpivalue":
        kpi = get_object_or_404(KPI, pk=_param(request, "kpi"))
        return KPIValue(kpi=kpi, classification=kpi.classification), kpi.service_line
    if kind == "decision":
        return Decision(service_line=line), line
    raise Http404


def _form_kwargs(kind, line, instance, request):
    kwargs = {"data": request.POST or None, "instance": instance}
    if kind in SCOPED_FORMS:
        kwargs["service_line"] = line
    if kind == "teammember" and instance.pk is None and line is not None:
        kwargs["initial"] = {"service_lines": [line.pk]}
    if kind == "solution" and instance.practice_id:
        kwargs.setdefault("initial", {})["practice"] = instance.practice_id
    if kind == "offer" and instance.solution_id:
        kwargs.setdefault("initial", {})["solution"] = instance.solution_id
    return kwargs


def _attach_errors(form, exc: ValidationError):
    if hasattr(exc, "error_dict"):
        for field, errors in exc.message_dict.items():
            target = field if field in form.fields else None
            for message in errors:
                form.add_error(
                    target, message if target else f"{field.replace('_', ' ').capitalize()}: {message}"
                )
    else:
        form.add_error(None, exc)


def _save(kind, form, instance, user, previous_status):
    with transaction.atomic():
        obj = form.save(commit=False)
        if kind == "project":
            services.save_project(obj, user, previous_status=previous_status)
        elif kind == "kpivalue" and obj.pk is None:
            # Adding a value for a date that already has one updates it rather than failing.
            obj, _ = services.record_kpi_value(obj.kpi, obj.date, obj.value, user, obj.classification)
        elif kind == "kpivalue":
            services.save_kpi_value(obj, user)
        else:
            services.ensure_can_edit(user, obj)
            services.save_record(obj, user)
        form.save_m2m()
    return obj


def _render_form(request, kind, form, instance, title):
    model = _model(kind)
    context = {
        "form": form,
        "title": title,
        "action": request.get_full_path(),
        "submit": "Save" if instance.pk else f"Add {model._meta.verbose_name}",
        "object": instance,
    }
    return render(request, "partials/form_modal.html", context)


@role_required()
@require_http_methods(["GET", "POST"])
def entity_create(request, kind):
    _model(kind)
    instance, line = _new_instance(kind, request)
    if not services.can_edit(
        request.user, instance if kind not in {"solution", "offer"} else Practice(service_line=line)
    ):
        raise PermissionDenied
    form = FORMS[kind](**_form_kwargs(kind, line, instance, request))
    name = str(instance._meta.verbose_name)
    label = name[:1].upper() + name[1:]
    if request.method == "POST" and form.is_valid():
        if not services.can_edit(request.user, form.instance):
            raise PermissionDenied
        try:
            obj = _save(kind, form, instance, request.user, previous_status=None)
        except ValidationError as exc:
            _attach_errors(form, exc)
        else:
            return close_modal_response(request, obj.get_absolute_url(), f"{label} “{obj}” added.")
    return _render_form(request, kind, form, instance, f"Add {instance._meta.verbose_name}")


@role_required()
@require_http_methods(["GET", "POST"])
def entity_edit(request, kind, pk):
    model = _model(kind)
    instance = get_object_or_404(model, pk=pk)
    if not can_view(request.user, instance) or not services.can_edit(request.user, instance):
        raise PermissionDenied
    line = services.service_line_of(instance)
    previous_status = instance.status if kind == "project" else None
    form = FORMS[kind](**_form_kwargs(kind, line, instance, request))
    if request.method == "POST" and form.is_valid():
        if not services.can_edit(request.user, form.instance):
            raise PermissionDenied
        try:
            obj = _save(kind, form, instance, request.user, previous_status)
        except ValidationError as exc:
            _attach_errors(form, exc)
        else:
            return close_modal_response(request, obj.get_absolute_url(), f"“{obj}” saved.")
    return _render_form(request, kind, form, instance, f"Edit {instance._meta.verbose_name}: {instance}")


@role_required()
@require_POST
def entity_archive(request, kind, pk):
    instance = get_object_or_404(_model(kind), pk=pk)
    services.archive(instance, request.user)
    return changed_response(request, instance.get_absolute_url(), f"“{instance}” archived.")


@role_required()
@require_POST
def entity_restore(request, kind, pk):
    instance = get_object_or_404(_model(kind), pk=pk)
    services.restore(instance, request.user)
    return changed_response(request, instance.get_absolute_url(), f"“{instance}” restored.")


@role_required()
@require_POST
def project_status(request, pk):
    project = get_object_or_404(Project, pk=pk)
    form = forms.ProjectStatusForm(request.POST)
    if not form.is_valid():
        raise PermissionDenied
    services.change_project_status(project, form.cleaned_data["status"], request.user)
    return changed_response(
        request, project.get_absolute_url(), f"{project.name} is now {project.get_status_display()}."
    )
