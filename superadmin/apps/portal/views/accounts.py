"""Settings > Users & roles > Client portal users (SuperAdmin only): customer accounts across organisations.

The actions are the account-level form of the Members table actions and reuse the same services
(``members``): Suspend and Restore act on every membership; Remove takes the person out of every
organisation and then settles the account (deleted, or erased when it wrote project records)."""

from __future__ import annotations

from django.contrib import messages
from django.contrib.auth import get_user_model
from django.http import Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.views.decorators.http import require_GET, require_POST

from apps.accounts import selectors as account_selectors
from apps.accounts.roles import SUPERADMIN, role_required

from .. import members, services, staff_selectors

CUSTOMER_ACTIONS = ("suspend", "restore", "remove")

OUTCOME = {
    members.KEPT: "",
    members.DELETED: " Their portal account was deleted.",
    members.ERASED: " Their portal account was erased; their project records stay, shown as Former member.",
}


def _organisations(count: int) -> str:
    return f"{count} organisation{'' if count == 1 else 's'}"


@role_required(SUPERADMIN)
@require_GET
def portal_users(request):
    rows = staff_selectors.customer_accounts()
    context = {
        "rows": rows,
        "tab": "users",
        "users_view": "portal",
        "staff_count": account_selectors.staff_accounts().count(),
        "customer_count": len(rows),
    }
    return render(request, "settings/portal_users.html", context)


@role_required(SUPERADMIN)
@require_POST
def portal_user_action(request, pk, action):
    if action not in CUSTOMER_ACTIONS:
        raise Http404
    customers = get_user_model().objects.filter(pk__in=account_selectors.customer_ids())
    user = get_object_or_404(customers, pk=pk)
    name = user.get_full_name()
    try:
        if action == "suspend":
            count = members.suspend_customer(user, actor=request.user, request=request)
            message = f"{name} no longer has portal access ({_organisations(count)})."
        elif action == "restore":
            count = members.restore_customer(user, actor=request.user, request=request)
            message = f"Portal access restored for {name} ({_organisations(count)})."
        else:
            outcome = members.remove_customer(user, actor=request.user, request=request)
            message = f"{name} was removed from every organisation.{OUTCOME[outcome]}"
    except services.PortalError as exc:
        messages.error(request, str(exc))
    else:
        messages.success(request, message)
    return HttpResponseRedirect(reverse("portal_settings:users"))
