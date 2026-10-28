"""Mail > Outreach. Super Admin only (checked here and again in the services)."""

from __future__ import annotations

from django.contrib import messages
from django.core.exceptions import ValidationError
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from apps.accounts.roles import SUPERADMIN, role_required
from apps.content_sync.models import TickState
from apps.core.forms import INPUT

from . import services
from .models import Contact

LIST_LIMIT = 50


def _error(request, exc: ValidationError) -> None:
    messages.error(request, " ".join(exc.messages))


@role_required(SUPERADMIN)
@require_GET
@never_cache
def home(request):
    services.require_superadmin(request.user)
    current = services.load_settings()
    now = timezone.now()
    context = {
        "current": current,
        "counts": services.counts(now),
        "next_due": services.next_due(now, current),
        "in_window": services.in_window(now),
        "problems": services.start_problems(current),
        "mailbox_ready": services.mailbox_ready(),
        "mailbox": services.outreach_mailbox(),
        "sends_for_real": services.sends_for_real(),
        "templates": services.templates(),
        "daily_cap_max": services.DAILY_CAP_MAX,
        "queued": Contact.objects.filter(status=Contact.Status.QUEUED)[:LIST_LIMIT],
        "history": Contact.objects.exclude(status=Contact.Status.QUEUED).order_by("-sent_at", "-id")[
            :LIST_LIMIT
        ],
        "last_tick": TickState.load().last_finished_at,
        "input_class": INPUT,
        "max_rows": services.imports.MAX_ROWS,
    }
    return render(request, "outreach/home.html", context)


@role_required(SUPERADMIN)
@require_POST
def upload(request):
    file = request.FILES.get("file")
    if file is None:
        messages.error(request, "Choose the CSV or .xlsx file exported from Notion.")
        return redirect("outreach:home")
    try:
        result = services.import_contacts(
            file,
            user=request.user,
            only_new=request.POST.get("only_new") == "on",
            corporate_only=request.POST.get("corporate_only") == "on",
            no_website_only=request.POST.get("no_website_only") == "on",
            request=request,
        )
    except ValidationError as exc:
        _error(request, exc)
    else:
        messages.success(request, result.summary)
    return redirect("outreach:home")


@role_required(SUPERADMIN)
@require_POST
def update_settings(request):
    try:
        daily_cap = int(request.POST.get("daily_cap", ""))
    except ValueError:
        messages.error(request, "Enter the daily limit as a number.")
        return redirect("outreach:home")
    try:
        services.update_settings(
            user=request.user,
            template_id=request.POST.get("template", ""),
            daily_cap=daily_cap,
            request=request,
        )
    except ValidationError as exc:
        _error(request, exc)
    else:
        messages.success(request, "Saved.")
    return redirect("outreach:home")


@role_required(SUPERADMIN)
@require_POST
def start(request):
    try:
        services.start(user=request.user, request=request)
    except ValidationError as exc:
        _error(request, exc)
    else:
        messages.success(request, "Started. Emails go out one at a time on weekdays, 09:00 to 17:00.")
    return redirect("outreach:home")


@role_required(SUPERADMIN)
@require_POST
def pause(request):
    services.pause(user=request.user, request=request)
    messages.success(request, "Paused. Nothing more is sent until you press Start.")
    return redirect("outreach:home")


@role_required(SUPERADMIN)
@require_POST
def remove(request, pk):
    services.remove(pk, user=request.user, request=request)
    return redirect("outreach:home")


@role_required(SUPERADMIN)
@require_POST
def clear(request):
    count = services.clear_queue(user=request.user, request=request)
    messages.success(request, f"Removed {count} from the queue.")
    return redirect("outreach:home")


@role_required(SUPERADMIN)
@require_POST
@never_cache
def export(request):
    response = HttpResponse(services.export_csv(user=request.user, request=request), content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="outreach-sent.csv"'
    response["Cache-Control"] = "private, no-store"
    return response
