"""Client portal administration (Super Admin, staff only). Every view needs SuperAdmin or ServiceLead, every write
is a CSRF-protected POST that goes through ``services`` (and is audited there). Customers never reach these URLs."""

from __future__ import annotations

import json
import logging

from django.contrib import messages
from django.core.exceptions import PermissionDenied
from django.db import DatabaseError
from django.http import FileResponse, Http404, HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.aidata import selectors as aidata_selectors
from apps.audit.services import record

from .. import continuity, selectors, services, staff_selectors
from .. import deliveries as deliveries_svc
from .. import files as portal_files
from .. import members as portal_members
from .. import retention as portal_retention
from ..access import staff_required
from ..forms import (
    BriefForm,
    ChallengeForm,
    ChangeReviewForm,
    DeliverableForm,
    InviteForm,
    ItemForm,
    LinkChallengeForm,
    MilestoneForm,
    OrganisationForm,
    ProjectForm,
    QuestionForm,
    RoleForm,
    ServiceForm,
    StaffFileForm,
    StaffMessageForm,
    StatusReportForm,
    UpdateForm,
    VersionForm,
)
from ..models import (
    BriefStatus,
    BriefVersion,
    Challenge,
    ChangeRequest,
    Deliverable,
    DeliverableVersion,
    EmailDelivery,
    File,
    FileVersion,
    InformationRequest,
    InformationResponse,
    Invitation,
    ManagedService,
    Membership,
    Milestone,
    Organisation,
    Project,
    ProjectItem,
    ServiceStatusReport,
    Update,
)

logger = logging.getLogger(__name__)

PUBLISHABLE = {
    "project": Project,
    "milestone": Milestone,
    "item": ProjectItem,
    "deliverable": Deliverable,
    "question": InformationRequest,
    "service": ManagedService,
    "report": ServiceStatusReport,
}


def _back(request, default):
    """Redirect to the page the form came from, but only to this site (never a caller-chosen external URL)."""
    target = request.POST.get("next") or ""
    if not target or not url_has_allowed_host_and_scheme(
        target, allowed_hosts={request.get_host()}, require_https=request.is_secure()
    ):
        target = default
    return HttpResponseRedirect(target)


def _page(request, form, *, title, back, back_label, submit="Save", intro="", multipart=False, danger=False):
    return render(
        request,
        "portaladmin/form.html",
        {
            "form": form,
            "title": title,
            "back": back,
            "back_label": back_label,
            "submit": submit,
            "intro": intro,
            "multipart": multipart,
        },
    )


def _guard(request, fn):
    try:
        return fn()
    except services.PortalError as exc:
        messages.error(request, str(exc))
        return None


# --- Overview -----------------------------------------------------------------------------------------------------------------


@staff_required
@require_GET
def home(request):
    return render(
        request,
        "portaladmin/home.html",
        {
            "decisions": staff_selectors.outstanding_decisions(),
            "activity": staff_selectors.recent_customer_activity(),
            "failed": staff_selectors.failed_deliveries().count(),
            "orgs": staff_selectors.organisations(),
            "challenges": Challenge.objects.select_related("organisation").order_by("-created_at")[:10],
        },
    )


@staff_required
@require_http_methods(["GET", "POST"])
def org_new(request):
    form = OrganisationForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        org = _guard(
            request,
            lambda: services.create_organisation(
                name=form.cleaned_data["name"],
                actor=request.user,
                request=request,
                synthetic=form.cleaned_data["is_synthetic"],
            ),
        )
        if org:
            messages.success(request, f"{org.name} created. Invite a member next.")
            return redirect("portaladmin:org", pk=org.pk)
    return _page(
        request,
        form,
        title="New organisation",
        back=reverse("portaladmin:home"),
        back_label="Client portal",
        submit="Create organisation",
    )


@staff_required
@require_GET
def org(request, pk):
    organisation = get_object_or_404(Organisation, pk=pk)
    return render(
        request,
        "portaladmin/org.html",
        {
            "org": organisation,
            "members": staff_selectors.member_rows(organisation),
            "invite_form": InviteForm(),
            "challenges": organisation.challenges.all(),
            "services": organisation.services.all(),
            "deliveries": organisation.deliveries.select_related("recipient")[:15],
            "role_form": RoleForm(),
        },
    )


@staff_required
@require_POST
def member_invite(request, pk):
    organisation = get_object_or_404(Organisation, pk=pk)
    form = InviteForm(request.POST)
    if form.is_valid():
        member = _guard(
            request,
            lambda: services.invite_member(
                organisation=organisation,
                email=form.cleaned_data["email"],
                full_name=form.cleaned_data["full_name"],
                role=form.cleaned_data["role"],
                actor=request.user,
                request=request,
            ),
        )
        if member:
            messages.success(
                request, f"Invitation sent to {member.user.email}. The link works once and expires."
            )
    else:
        messages.error(request, "Check the invitation details.")
    return redirect("portaladmin:org", pk=organisation.pk)


MEMBER_ACTIONS = {"resend", "revoke", "restore", "role", "cancel", "remove"}

ACCOUNT_OUTCOME = {
    portal_members.KEPT: "",
    portal_members.DELETED: " Their portal account had no other membership, so it was deleted.",
    portal_members.ERASED: " Their portal account was erased; their messages and other project records stay, "
    "shown as Former member.",
}


@staff_required
@require_POST
def member_action(request, org_pk, pk, action):
    """Every member action is scoped to the organisation in the URL: a member of another organisation is a 404."""
    if action not in MEMBER_ACTIONS:
        raise Http404
    member = get_object_or_404(
        Membership.objects.select_related("organisation", "user"), pk=pk, organisation_id=org_pk
    )
    who = member.name
    if action == "resend":
        if _guard(request, lambda: services.resend_invitation(member, actor=request.user, request=request)):
            messages.success(request, f"A new invitation was sent to {who}. Earlier links no longer work.")
    elif action == "revoke":
        services.revoke_member(member, actor=request.user, request=request)
        messages.success(request, f"{who} no longer has access, effective immediately.")
    elif action == "restore":
        services.restore_member(member, actor=request.user, request=request)
        messages.success(request, f"Access restored for {who}.")
    elif action == "role":
        form = RoleForm(request.POST)
        if form.is_valid():
            services.change_role(member, form.cleaned_data["role"], actor=request.user, request=request)
            messages.success(request, f"{who} is now {member.get_role_display()}.")
        else:
            messages.error(request, "Choose a role.")
    elif action == "cancel":
        outcome = _guard(
            request, lambda: portal_members.cancel_invitation(member, actor=request.user, request=request)
        )
        if outcome:
            messages.success(request, f"Invitation for {who} cancelled.{ACCOUNT_OUTCOME[outcome]}")
    elif action == "remove":
        outcome = _guard(
            request, lambda: portal_members.remove_member(member, actor=request.user, request=request)
        )
        if outcome:
            messages.success(
                request, f"{who} was removed from {member.organisation.name}.{ACCOUNT_OUTCOME[outcome]}"
            )
    return redirect("portaladmin:org", pk=org_pk)


# --- Link an opportunity (from the AI & Data opportunity workspace) ---------------------------------------------------------------


@staff_required
@require_http_methods(["GET", "POST"])
def link_challenge(request, ref):
    opportunity = aidata_selectors.get_by_ref(ref)
    if opportunity is None:
        raise Http404
    existing = staff_selectors.challenge_for_opportunity(opportunity)
    if existing:
        return redirect("portaladmin:challenge", pk=existing.pk)
    form = LinkChallengeForm(request.POST or None, initial={"title": opportunity.title})
    if request.method == "POST" and form.is_valid():
        challenge = _guard(
            request,
            lambda: services.link_challenge(
                opportunity=opportunity,
                organisation=form.cleaned_data["organisation"],
                actor=request.user,
                request=request,
                title=form.cleaned_data["title"],
            ),
        )
        if challenge:
            messages.success(request, "Linked. The customer sees nothing until you share the challenge.")
            return redirect("portaladmin:challenge", pk=challenge.pk)
    return _page(
        request,
        form,
        title=f"Link {opportunity.ref} to the client portal",
        back=opportunity.get_absolute_url(),
        back_label=opportunity.ref,
        submit="Link opportunity",
        intro="This copies what the customer told us (problem and desired outcome) into the portal, so you can "
        "review it before sharing. The opportunity itself, its notes and its scores are not shown to the customer.",
    )


# --- Challenge workspace ---------------------------------------------------------------------------------------------------------


@staff_required
@require_GET
def challenge(request, pk):
    ch = get_object_or_404(Challenge.objects.select_related("organisation", "opportunity"), pk=pk)
    members = selectors.live_member_users(ch.organisation)
    # Opening the workspace is what "read" means for the work queue's "customer answer not yet read" item.
    InformationResponse.objects.filter(request__challenge=ch, staff_seen_at__isnull=True).update(
        staff_seen_at=timezone.now()
    )
    return render(
        request,
        "portaladmin/challenge.html",
        {
            "ch": ch,
            "status": continuity.challenge_status(ch),
            "proposal_project": continuity.project_from_proposal(ch),
            "briefs": ch.briefs.prefetch_related("reviews"),
            "projects": ch.projects.all(),
            "updates": ch.updates.all(),
            "questions": ch.information_requests.prefetch_related("responses"),
            "threads": ch.threads.prefetch_related("messages__author"),
            "files": ch.files.prefetch_related("versions"),
            "members": members,
            "message_form": StaffMessageForm(),
            "events": ch.events.all()[:12],
            "services": ch.organisation.services.all(),
        },
    )


@staff_required
@require_POST
def challenge_stage(request, pk):
    """The explicit, audited "Update customer-visible stage" action."""
    ch = get_object_or_404(Challenge.objects.select_related("opportunity"), pk=pk)
    try:
        continuity.sync_customer_stage(ch, actor=request.user, request=request)
    except continuity.ContinuityError as exc:
        messages.error(request, str(exc))
    else:
        messages.success(request, f"The customer now sees: {ch.get_journey_stage_display()}.")
    return redirect(ch.opportunity.get_absolute_url())


@staff_required
@require_POST
def project_from_proposal(request, ref):
    """ "Create portal project from proposal": explicit, idempotent, unpublished."""
    opportunity = aidata_selectors.get_by_ref(ref)
    if opportunity is None:
        raise Http404
    ch = staff_selectors.challenge_for_opportunity(opportunity)
    if ch is None:
        messages.error(request, "Link the opportunity to the client portal first.")
        return redirect(f"{opportunity.get_absolute_url()}?tab=proposal")
    try:
        project, created = continuity.create_project_from_proposal(ch, actor=request.user, request=request)
    except continuity.ContinuityError as exc:
        messages.error(request, str(exc))
        return redirect(f"{opportunity.get_absolute_url()}?tab=proposal")
    messages.success(
        request,
        "Project prefilled from the approved proposal. Nothing is published; review it, then publish."
        if created
        else "This challenge already has a project made from the proposal. Opening it.",
    )
    return redirect("portaladmin:project", pk=project.pk)


@staff_required
@require_http_methods(["GET", "POST"])
def challenge_edit(request, pk):
    ch = get_object_or_404(Challenge, pk=pk)
    initial = {f: getattr(ch, f) for f in ChallengeForm.base_fields}
    form = ChallengeForm(request.POST or None, initial=initial)
    if request.method == "POST" and form.is_valid():
        services.update_challenge(ch, actor=request.user, request=request, **form.cleaned_data)
        messages.success(request, "Saved.")
        return redirect("portaladmin:challenge", pk=ch.pk)
    return _page(
        request,
        form,
        title=f"Edit challenge: {ch.title}",
        back=reverse("portaladmin:challenge", args=[ch.pk]),
        back_label="Challenge",
    )


@staff_required
@require_POST
def challenge_share(request, pk):
    ch = get_object_or_404(Challenge, pk=pk)
    services.share_challenge(ch, actor=request.user, request=request)
    messages.success(request, "Shared. Members of the organisation can now see this challenge.")
    return redirect("portaladmin:challenge", pk=ch.pk)


@staff_required
@require_http_methods(["GET", "POST"])
def brief_edit(request, pk, brief_pk=None):
    ch = get_object_or_404(Challenge, pk=pk)
    brief = get_object_or_404(BriefVersion, pk=brief_pk, challenge=ch) if brief_pk else None
    if brief is None:
        base = ch.briefs.first()
    else:
        base = brief
    initial = (
        {
            "summary": base.summary,
            "change_note": base.change_note,
            "segments": BriefForm.initial_text(base.segments),
        }
        if base
        else {}
    )
    if brief is None and base:
        initial["summary"] = ""
        initial["change_note"] = ""
    form = BriefForm(request.POST or None, initial=initial)
    if request.method == "POST" and form.is_valid():
        saved = _guard(
            request,
            lambda: services.save_brief(
                ch,
                segments=form.cleaned_data["segments"],
                summary=form.cleaned_data["summary"],
                change_note=form.cleaned_data["change_note"],
                actor=request.user,
                request=request,
                brief=brief,
            ),
        )
        if saved:
            messages.success(
                request, f"Brief version {saved.number} saved as a draft. Preview it, then propose it."
            )
            return redirect("portaladmin:challenge", pk=ch.pk)
    return _page(
        request,
        form,
        title="Edit brief draft" if brief else "New brief version",
        back=reverse("portaladmin:challenge", args=[ch.pk]),
        back_label="Challenge",
        intro="A new version starts as an internal draft. Tag every segment with where it came from. "
        "AI suggestions reach the customer only inside a version you propose, and are labelled.",
    )


@staff_required
@require_POST
def brief_propose(request, pk):
    brief = get_object_or_404(BriefVersion, pk=pk)
    if _guard(request, lambda: services.propose_brief(brief, actor=request.user, request=request) or True):
        messages.success(request, f"Brief version {brief.number} proposed. Approvers were notified.")
    return redirect("portaladmin:challenge", pk=brief.challenge_id)


# --- Projects ----------------------------------------------------------------------------------------------------------------------


@staff_required
@require_http_methods(["GET", "POST"])
def project_edit(request, pk=None, challenge_pk=None):
    project = get_object_or_404(Project, pk=pk) if pk else None
    ch = project.challenge if project else get_object_or_404(Challenge, pk=challenge_pk)
    initial = {f: getattr(project, f) for f in ProjectForm.base_fields} if project else {}
    form = ProjectForm(request.POST or None, initial=initial)
    if request.method == "POST" and form.is_valid():
        saved = services.save_project(
            ch, actor=request.user, request=request, project=project, **form.cleaned_data
        )
        messages.success(request, "Saved. Publish it when the customer should see it.")
        return redirect("portaladmin:project", pk=saved.pk)
    return _page(
        request,
        form,
        title="Edit project" if project else "New project",
        back=reverse("portaladmin:challenge", args=[ch.pk]),
        back_label="Challenge",
    )


@staff_required
@require_GET
def project(request, pk):
    p = get_object_or_404(Project.objects.select_related("challenge__organisation"), pk=pk)
    return render(
        request,
        "portaladmin/project.html",
        {
            "p": p,
            "ch": p.challenge,
            "milestones": p.milestones.all(),
            "items": p.items.all(),
            "deliverables": [
                {"d": d, "versions": d.versions.prefetch_related("approvals")} for d in p.deliverables.all()
            ],
            "changes": p.change_requests.all(),
        },
    )


@staff_required
@require_http_methods(["GET", "POST"])
def milestone_edit(request, pk=None, project_pk=None):
    milestone = get_object_or_404(Milestone, pk=pk) if pk else None
    p = milestone.project if milestone else get_object_or_404(Project, pk=project_pk)
    initial = {f: getattr(milestone, f) for f in MilestoneForm.base_fields} if milestone else {}
    form = MilestoneForm(request.POST or None, initial=initial)
    if request.method == "POST" and form.is_valid():
        services.save_milestone(
            p, actor=request.user, request=request, milestone=milestone, **form.cleaned_data
        )
        messages.success(request, "Milestone saved.")
        return redirect("portaladmin:project", pk=p.pk)
    return _page(
        request,
        form,
        title="Edit milestone" if milestone else "New milestone",
        back=reverse("portaladmin:project", args=[p.pk]),
        back_label="Project",
        intro="Milestones carry a status label and a target date. There is deliberately no percentage complete.",
    )


@staff_required
@require_http_methods(["GET", "POST"])
def item_edit(request, pk=None, project_pk=None):
    item = get_object_or_404(ProjectItem, pk=pk) if pk else None
    p = item.project if item else get_object_or_404(Project, pk=project_pk)
    initial = {f: getattr(item, f) for f in ItemForm.base_fields} if item else {}
    form = ItemForm(request.POST or None, initial=initial)
    if request.method == "POST" and form.is_valid():
        services.save_item(p, actor=request.user, request=request, item=item, **form.cleaned_data)
        messages.success(request, "Saved.")
        return redirect("portaladmin:project", pk=p.pk)
    return _page(
        request,
        form,
        title="Edit item" if item else "New responsibility, dependency or blocker",
        back=reverse("portaladmin:project", args=[p.pk]),
        back_label="Project",
    )


@staff_required
@require_http_methods(["GET", "POST"])
def deliverable_edit(request, pk=None, project_pk=None):
    deliverable = get_object_or_404(Deliverable, pk=pk) if pk else None
    p = deliverable.project if deliverable else get_object_or_404(Project, pk=project_pk)
    initial = (
        {f: getattr(deliverable, f) for f in ("title", "description", "milestone", "internal_notes")}
        if deliverable
        else {}
    )
    form = DeliverableForm(request.POST or None, initial=initial, project=p)
    if request.method == "POST" and form.is_valid():
        services.save_deliverable(
            p, actor=request.user, request=request, deliverable=deliverable, **form.cleaned_data
        )
        messages.success(request, "Saved.")
        return redirect("portaladmin:project", pk=p.pk)
    return _page(
        request,
        form,
        title="Edit deliverable" if deliverable else "New deliverable",
        back=reverse("portaladmin:project", args=[p.pk]),
        back_label="Project",
    )


@staff_required
@require_http_methods(["GET", "POST"])
def version_new(request, pk):
    deliverable = get_object_or_404(Deliverable.objects.select_related("project__challenge"), pk=pk)
    form = VersionForm(request.POST or None, request.FILES or None, initial={"requires_approval": True})
    if request.method == "POST" and form.is_valid():
        data = form.cleaned_data

        def run():
            file_version = None
            upload = data.get("file")
            if upload:
                file_version = services.upload_staff_file(
                    deliverable.project.challenge,
                    upload,
                    actor=request.user,
                    project=deliverable.project,
                    title=f"{deliverable.title} (v{deliverable.versions.count() + 1})",
                    request=request,
                )
            return services.create_version(
                deliverable,
                actor=request.user,
                request=request,
                summary=data["summary"],
                body=data["body"],
                file_version=file_version,
                requires_approval=data["requires_approval"],
                is_contractual=data["is_contractual"],
                internal_notes=data["internal_notes"],
            )

        version = _guard(request, run)
        if version:
            messages.success(
                request,
                f"Version {version.number} created. It is not visible and not approved. Preview it, then share it.",
            )
            return redirect("portaladmin:deliverable", pk=deliverable.pk)
    return _page(
        request,
        form,
        title=f"New version of {deliverable.title}",
        back=reverse("portaladmin:project", args=[deliverable.project_id]),
        back_label="Project",
        multipart=True,
        intro="A new version starts unshared and unapproved. It never inherits an earlier version's approval.",
    )


@staff_required
@require_GET
def deliverable(request, pk):
    d = get_object_or_404(Deliverable.objects.select_related("project__challenge__organisation"), pk=pk)
    rows = []
    for v in d.versions.all():
        rows.append(
            {
                "v": v,
                "state": selectors.version_state(v),
                "approvals": list(v.approvals.all()),
                "shared": v.is_shared,
            }
        )
    return render(
        request,
        "portaladmin/deliverable.html",
        {"d": d, "p": d.project, "ch": d.project.challenge, "rows": rows},
    )


@staff_required
@require_POST
def version_action(request, pk, action):
    version = get_object_or_404(
        DeliverableVersion.objects.select_related("deliverable__project__challenge"), pk=pk
    )
    if action == "share":
        if _guard(
            request, lambda: services.share_version(version, actor=request.user, request=request) or True
        ):
            messages.success(request, f"Version {version.number} shared. Approvers were asked to review it.")
    elif action == "withdraw":
        services.withdraw_version(version, actor=request.user, request=request)
        messages.success(
            request, "Withdrawn. The customer no longer sees this version. Recorded decisions are kept."
        )
    else:
        raise Http404
    return redirect("portaladmin:deliverable", pk=version.deliverable_id)


@staff_required
@require_POST
def publish_toggle(request, kind, pk, state):
    model = PUBLISHABLE.get(kind)
    if model is None or state not in ("on", "off"):
        raise Http404
    obj = get_object_or_404(model, pk=pk)
    if kind == "question" and state == "on":
        _guard(request, lambda: services.publish_question(obj, actor=request.user, request=request))
    else:
        services.set_published(obj, state == "on", actor=request.user, request=request)
    messages.success(
        request, "Now visible to the customer." if state == "on" else "Hidden from the customer."
    )
    return _back(request, reverse("portaladmin:home"))


# --- Updates, questions, messages, files ----------------------------------------------------------------------------------------------


@staff_required
@require_http_methods(["GET", "POST"])
def update_edit(request, pk=None, challenge_pk=None):
    update = get_object_or_404(Update, pk=pk) if pk else None
    ch = update.challenge if update else get_object_or_404(Challenge, pk=challenge_pk)
    initial = (
        {f: getattr(update, f) for f in ("title", "body", "project", "internal_notes")} if update else {}
    )
    form = UpdateForm(request.POST or None, initial=initial, challenge=ch)
    if request.method == "POST" and form.is_valid():
        saved = _guard(
            request,
            lambda: services.save_update(
                ch,
                title=form.cleaned_data["title"],
                body=form.cleaned_data["body"],
                project=form.cleaned_data["project"],
                internal_notes=form.cleaned_data["internal_notes"],
                actor=request.user,
                request=request,
                update=update,
            ),
        )
        if saved:
            messages.success(request, "Draft saved. Preview it as the customer would see it, then publish.")
            return redirect("portaladmin:challenge", pk=ch.pk)
    return _page(
        request,
        form,
        title="Edit update draft" if update else "Prepare an update",
        back=reverse("portaladmin:challenge", args=[ch.pk]),
        back_label="Challenge",
        intro="A draft is invisible to the customer. Publishing is a separate, explicit step and notifies members.",
    )


@staff_required
@require_POST
def update_publish(request, pk):
    update = get_object_or_404(Update, pk=pk)
    if _guard(request, lambda: services.publish_update(update, actor=request.user, request=request) or True):
        messages.success(request, "Published. Members were notified according to their preferences.")
    return redirect("portaladmin:challenge", pk=update.challenge_id)


@staff_required
@require_http_methods(["GET", "POST"])
def question_new(request, pk):
    ch = get_object_or_404(Challenge, pk=pk)
    form = QuestionForm(request.POST or None, challenge=ch)
    if request.method == "POST" and form.is_valid():
        data = form.cleaned_data
        q = _guard(
            request,
            lambda: services.ask_question(
                ch,
                question=data["question"],
                detail=data["detail"],
                due_date=data["due_date"],
                project=data["project"],
                assigned_to=data["assigned_to"],
                actor=request.user,
                request=request,
            ),
        )
        if q:
            messages.success(
                request, "Question sent. The customer is notified and sees it under 'What we need from you'."
            )
            return redirect("portaladmin:challenge", pk=ch.pk)
    return _page(
        request,
        form,
        title="Ask the customer a question",
        back=reverse("portaladmin:challenge", args=[ch.pk]),
        back_label="Challenge",
        submit="Send question",
    )


@staff_required
@require_POST
def question_close(request, pk):
    q = get_object_or_404(InformationRequest, pk=pk)
    services.close_question(q, actor=request.user, request=request)
    messages.success(request, "Question closed.")
    return redirect("portaladmin:challenge", pk=q.challenge_id)


@staff_required
@require_POST
def staff_message(request, pk):
    ch = get_object_or_404(Challenge, pk=pk)
    form = StaffMessageForm(request.POST)
    if form.is_valid():
        if _guard(
            request,
            lambda: services.post_staff_message(
                ch,
                body=form.cleaned_data["body"],
                actor=request.user,
                internal=form.cleaned_data["internal"],
                request=request,
            ),
        ):
            messages.success(request, "Posted.")
    else:
        messages.error(request, "Write a message.")
    return redirect("portaladmin:challenge", pk=ch.pk)


@staff_required
@require_http_methods(["GET", "POST"])
def file_new(request, pk):
    ch = get_object_or_404(Challenge, pk=pk)
    form = StaffFileForm(request.POST or None, request.FILES or None, challenge=ch)
    if request.method == "POST" and form.is_valid():
        d = form.cleaned_data
        v = _guard(
            request,
            lambda: services.upload_staff_file(
                ch,
                d["file"],
                actor=request.user,
                project=d["project"],
                title=d["title"],
                visibility=d["visibility"],
                retention_note=d["retention_note"],
                request=request,
            ),
        )
        if v:
            messages.success(
                request,
                "File uploaded"
                + (" and visible to the customer." if d["visibility"] == "customer" else " (internal only)."),
            )
            return redirect("portaladmin:challenge", pk=ch.pk)
    return _page(
        request,
        form,
        title="Upload a file",
        back=reverse("portaladmin:challenge", args=[ch.pk]),
        back_label="Challenge",
        multipart=True,
        submit="Upload",
        intro=f"Allowed types are checked by content. Up to {portal_files.MAX_BYTES // (1024 * 1024)} MB. Internal files are never listed or downloadable by the customer.",
    )


@staff_required
@require_POST
def file_visibility(request, pk):
    f = get_object_or_404(File, pk=pk)
    services.set_file_visibility(f, request.POST.get("visibility", ""), actor=request.user, request=request)
    messages.success(request, "File visibility changed.")
    return redirect("portaladmin:challenge", pk=f.challenge_id)


@staff_required
@require_GET
def file_download(request, pk):
    v = get_object_or_404(FileVersion.objects.select_related("file"), pk=pk)
    if v.upload_status != FileVersion.Status.STORED or not v.storage_key:
        raise Http404
    record(
        "portal.file_downloaded", request=request, entity=v.file, summary=f"Staff: {v.original_name}"[:250]
    )
    response = FileResponse(
        portal_files.open_file(v.storage_key),
        as_attachment=True,
        filename=v.original_name,
        content_type=v.content_type or "application/octet-stream",
    )
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Security-Policy"] = "default-src 'none'; sandbox"
    return response


# --- Change requests, services, deliveries -------------------------------------------------------------------------------------------------


@staff_required
@require_http_methods(["GET", "POST"])
def change_review(request, pk):
    change = get_object_or_404(
        ChangeRequest.objects.select_related("project__challenge__organisation", "raised_by"), pk=pk
    )
    form = ChangeReviewForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        d = form.cleaned_data
        if _guard(
            request,
            lambda: (
                services.review_change(
                    change,
                    to_status=d["to_status"],
                    response=d["response"],
                    note=d["note"],
                    actor=request.user,
                    request=request,
                )
                or True
            ),
        ):
            messages.success(
                request,
                "Recorded. Remember: accepting a change does not edit scope, price or dates. Do that through the normal process.",
            )
            return redirect("portaladmin:project", pk=change.project_id)
    return render(
        request, "portaladmin/change.html", {"change": change, "form": form, "trail": change.trail.all()}
    )


@staff_required
@require_http_methods(["GET", "POST"])
def service_edit(request, pk=None, org_pk=None):
    service = get_object_or_404(ManagedService, pk=pk) if pk else None
    organisation = service.organisation if service else get_object_or_404(Organisation, pk=org_pk)
    initial = (
        {f: getattr(service, f) for f in ("name", "description", "project", "internal_notes")}
        if service
        else {}
    )
    form = ServiceForm(request.POST or None, initial=initial, organisation=organisation)
    if request.method == "POST" and form.is_valid():
        d = form.cleaned_data
        saved = _guard(
            request,
            lambda: services.save_service(
                organisation,
                name=d["name"],
                description=d["description"],
                project=d["project"],
                internal_notes=d["internal_notes"],
                actor=request.user,
                request=request,
                service=service,
            ),
        )
        if saved:
            messages.success(request, "Saved. Publish it, then add a status report.")
            return redirect("portaladmin:org", pk=organisation.pk)
    return _page(
        request,
        form,
        title="Edit managed service" if service else "New managed service",
        back=reverse("portaladmin:org", args=[organisation.pk]),
        back_label="Organisation",
    )


@staff_required
@require_http_methods(["GET", "POST"])
def service_report(request, pk):
    service = get_object_or_404(ManagedService, pk=pk)
    form = StatusReportForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        d = form.cleaned_data
        if _guard(
            request,
            lambda: services.report_status(
                service,
                status=d["status"],
                summary=d["summary"],
                actor=request.user,
                request=request,
                publish=service.published_at is not None,
            ),
        ):
            messages.success(
                request, "Status reported (labelled to the customer as manually reported, with its time)."
            )
            return redirect("portaladmin:org", pk=service.organisation_id)
    return _page(
        request,
        form,
        title=f"Report status: {service.name}",
        back=reverse("portaladmin:org", args=[service.organisation_id]),
        back_label="Organisation",
        submit="Report status",
        intro="No live monitoring is connected. Every report is entered by a person and shown to the customer as 'Manually reported by Vitalos' with its last-updated time. Reports older than "
        "the stale threshold are labelled stale.",
    )


@staff_required
@require_GET
def deliveries(request):
    """Notification deliveries: email and push in one list, with a summary, filters and staff actions."""
    filters = deliveries_svc.Filters.from_query(request.GET)
    context = {
        "filters": filters,
        "channel_choices": list(deliveries_svc.CHANNELS.items()),
        "status_choices": [(value, label) for value, (label, _) in deliveries_svc.STATUS_FILTERS.items()],
        "kind_choices": deliveries_svc.kind_choices(),
        "day_choices": list(deliveries_svc.DAY_FILTERS.items()),
        "bulk_cap": deliveries_svc.BULK_RETRY_CAP,
        "max_attempts": EmailDelivery.MAX_ATTEMPTS,
    }
    try:
        listing = deliveries_svc.listing(filters, request.GET.get("page"))
        page = listing.page
        context.update(
            listing=listing,
            prev_query=filters.query(page=page.previous_page_number()) if page.has_previous() else "",
            next_query=filters.query(page=page.next_page_number()) if page.has_next() else "",
            summary=deliveries_svc.summary(),
            organisations=list(deliveries_svc.organisations()),
            retention=portal_retention.policy(),
        )
    except DatabaseError:
        logger.exception("Portal deliveries page could not load its records")
        context["error"] = (
            "The delivery records could not be loaded just now. Reload the page; if it keeps happening, "
            "check the error log."
        )
    return render(request, "portaladmin/deliveries.html", context)


def _delivery_channel(channel: str) -> str:
    if channel not in deliveries_svc.CHANNELS:
        raise Http404
    return channel


def _delivery_done(request, outcome, default: str):
    """HTMX: no content, a toast and a refresh of the delivery list. Otherwise a message and a redirect back."""
    if getattr(request, "htmx", False):
        response = HttpResponse(status=204)
        response["HX-Trigger"] = json.dumps(
            {
                "vsa-changed": True,
                "vsa-toast": {"message": outcome.message, "tone": "" if outcome.ok else "error"},
            }
        )
        return response
    (messages.success if outcome.ok else messages.error)(request, outcome.message)
    return _back(request, default)


def _safe_back(request, default: str) -> str:
    target = request.GET.get("back") or ""
    if target.startswith(reverse("portaladmin:deliveries")) and url_has_allowed_host_and_scheme(
        target, allowed_hosts={request.get_host()}, require_https=request.is_secure()
    ):
        return target
    return default


@staff_required
@require_GET
def delivery(request, channel, pk):
    item = deliveries_svc.detail(_delivery_channel(channel), pk)
    if item is None:
        raise Http404
    return render(
        request,
        "portaladmin/delivery.html",
        {"item": item, "row": item.row, "back": _safe_back(request, reverse("portaladmin:deliveries"))},
    )


def _retry(request, channel, pk):
    outcome = deliveries_svc.retry(channel, pk, actor=request.user, request=request)
    if outcome is None:
        raise Http404
    return _delivery_done(request, outcome, reverse("portaladmin:deliveries"))


@staff_required
@require_POST
def delivery_retry(request, channel, pk):
    return _retry(request, _delivery_channel(channel), pk)


@staff_required
@require_POST
def delivery_retry_email(request, pk):
    """The original email-only "Retry now" address, kept so existing links and bookmarks keep working."""
    return _retry(request, deliveries_svc.EMAIL, pk)


@staff_required
@require_POST
def delivery_cancel(request, channel, pk):
    outcome = deliveries_svc.cancel(_delivery_channel(channel), pk, actor=request.user, request=request)
    if outcome is None:
        raise Http404
    return _delivery_done(request, outcome, reverse("portaladmin:deliveries"))


@staff_required
@require_POST
def deliveries_bulk_retry(request):
    """Retry every failed delivery in the posted filter (capped; the button asks first)."""
    filters = deliveries_svc.Filters.from_query(request.POST)
    result = deliveries_svc.bulk_retry(filters, actor=request.user, request=request)
    if result.attempted and not (result.failing or result.refused):
        messages.success(request, result.message)
    elif result.attempted:
        messages.warning(request, result.message)
    else:
        messages.info(request, result.message)
    query = filters.query()
    return redirect(reverse("portaladmin:deliveries") + (f"?{query}" if query else ""))


# --- Preview ------------------------------------------------------------------------------------------------------------------------


@staff_required
@require_GET
def preview_start(request, pk):
    member = get_object_or_404(Membership, pk=pk)
    return redirect("portal_preview:home", preview_member=member.pk)


@staff_required
@require_GET
def preview_item(request, kind, pk):
    """Operator preview BEFORE publishing: the item rendered as the customer would see it, banner-marked."""
    if kind == "update":
        update = get_object_or_404(Update.objects.select_related("challenge"), pk=pk)
        record(
            "portal.preview", request=request, entity=update, summary=f"Previewed draft update {update.pk}"
        )
        return render(
            request,
            "portaladmin/preview_update.html",
            {
                "update": update,
                "challenge": update.challenge,
                "back": reverse("portaladmin:challenge", args=[update.challenge_id]),
            },
        )
    if kind == "brief":
        brief = get_object_or_404(BriefVersion.objects.select_related("challenge"), pk=pk)
        record("portal.preview", request=request, entity=brief, summary=f"Previewed brief v{brief.number}")
        return render(
            request,
            "portaladmin/preview_brief.html",
            {
                "brief": brief,
                "challenge": brief.challenge,
                "back": reverse("portaladmin:challenge", args=[brief.challenge_id]),
                "draft": brief.status == BriefStatus.DRAFT,
            },
        )
    if kind == "version":
        version = get_object_or_404(
            DeliverableVersion.objects.select_related("deliverable__project__challenge"), pk=pk
        )
        record("portal.preview", request=request, entity=version, summary=f"Previewed {version}")
        return render(
            request,
            "portaladmin/preview_version.html",
            {
                "version": version,
                "deliverable": version.deliverable,
                "challenge": version.deliverable.project.challenge,
                "back": reverse("portaladmin:deliverable", args=[version.deliverable_id]),
            },
        )
    raise Http404


def _unused():
    return (PermissionDenied, Invitation)
