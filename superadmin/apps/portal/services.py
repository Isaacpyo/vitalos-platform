"""Client portal writes. Business rules live here, never in views or templates.

Two groups:

* Customer actions take a ``Membership`` and re-check the role and visibility themselves (answer, comment,
  review a brief, approve or request changes on a specific version, accept contractually, request a change,
  upload). They can never change scope, price, milestones or dates: a change is only ever *requested*.
* Staff actions take the acting staff user. Publication is always one of these explicit actions.

Everything customer-relevant writes an ``Event`` (customer-safe activity feed, built from published fields
only), may notify live members, and leaves an audit record. Refusals raise ``PortalError`` with a message that
is safe to show.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.accounts.roles import user_roles
from apps.audit.services import record
from apps.core.http import client_ip

from . import continuity, notifications, selectors
from . import files as portal_files
from .models import (
    Approval,
    BriefReview,
    BriefStatus,
    BriefVersion,
    Challenge,
    ChangeRequest,
    ChangeReview,
    ChangeStatus,
    Deliverable,
    DeliverableVersion,
    Event,
    File,
    FileVersion,
    FileVisibility,
    InformationRequest,
    InformationResponse,
    Invitation,
    ManagedService,
    Membership,
    Message,
    Milestone,
    Organisation,
    Project,
    ProjectItem,
    Role,
    ServiceStatusReport,
    Thread,
    Update,
    validate_segments,
)

User = get_user_model()
MAX_TEXT = 4000

ACCEPTANCE_STATEMENT = (
    "I am authorised to accept this on behalf of {organisation}. I understand this is a contractual "
    "acceptance of {title}, version {number}. It is separate from a review approval and it applies to this "
    "version only."
)


class PortalError(Exception):
    """A refusal with a message safe to show to the person who asked."""


def _now():
    return timezone.now()


def _clean_text(text: str, *, field: str = "Text", required: bool = True, limit: int = MAX_TEXT) -> str:
    text = (text or "").replace("\x00", "").strip()
    if required and not text:
        raise PortalError(f"{field} cannot be empty.")
    if len(text) > limit:
        raise PortalError(f"{field} is longer than {limit:,} characters.")
    return text


def event(
    challenge,
    kind: str,
    summary: str,
    *,
    project=None,
    actor=None,
    customer=False,
    url_name="",
    url_kwargs=None,
    version=None,
    milestone=None,
) -> Event:
    return Event.objects.create(
        challenge=challenge,
        project=project,
        version=version,
        milestone=milestone,
        kind=kind,
        summary=summary[:300],
        actor_is_customer=customer,
        actor_user=actor,
        url_name=url_name,
        url_kwargs=url_kwargs or {},
    )


# ============================================================================================================
# Organisations, members, invitations (staff)
# ============================================================================================================


def create_organisation(*, name: str, actor, request=None, synthetic=False) -> Organisation:
    name = _clean_text(name, field="Name", limit=200)
    base = slugify(name)[:70] or "organisation"
    slug, n = base, 1
    while Organisation.objects.filter(slug=slug).exists():
        n += 1
        slug = f"{base}-{n}"
    org = Organisation.objects.create(name=name, slug=slug, is_synthetic=synthetic)
    record("portal.org_created", request=request, actor=actor, entity=org, summary=f"Created {org.name}")
    return org


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _issue_invitation(member: Membership, actor, request=None) -> str:
    """Revoke older pending invitations and create a new single-use one. Returns the raw token (never stored)."""
    now = _now()
    member.invitations.filter(used_at__isnull=True, revoked_at__isnull=True).update(revoked_at=now)
    token = secrets.token_urlsafe(32)
    Invitation.objects.create(
        membership=member,
        token_hash=hash_token(token),
        created_by=actor,
        expires_at=now + dt.timedelta(hours=settings.PORTAL_INVITE_TTL_HOURS),
    )
    return token


def _send_invitation(member: Membership, token: str) -> None:
    from apps.mailer import system

    from .access import portal_absolute

    link = portal_absolute("invitation", {"token": token})
    org = member.organisation.name
    subject = f"You are invited to the Vitalos client portal for {org}"
    doc = {
        "title": subject,
        "preheader": "Set your password to open the portal. The link works once.",
        "headerLabel": "Client portal",
        "blocks": [
            {"type": "heading", "text": f"Your Vitalos portal for {org}"},
            {
                "type": "text",
                "text": "Vitalos has invited you to follow the work we are doing with your organisation: "
                "your challenges, project progress, questions and deliverables, in one place.",
            },
            {"type": "button", "label": "Set your password", "url": link},
            system.link_fallback(link),
            {
                "type": "details",
                "rows": [
                    {"label": "Role", "value": member.get_role_display()},
                    {
                        "label": "Link expires",
                        "value": f"{settings.PORTAL_INVITE_TTL_HOURS} hours, works once",
                    },
                ],
            },
            {
                "type": "text",
                "tone": "muted",
                "text": "If you were not expecting this, ignore this email: nothing happens until the link is used.",
            },
        ],
        "footer": system.footer(),
    }
    system.send(
        doc,
        kind="portal.invitation",
        subject=subject,
        to=[member.user.email],
        from_email=f"Vitalos <{settings.NOTIFY_FROM}>",
    )


def invite_member(
    *, organisation: Organisation, email: str, full_name: str, role: str, actor, request=None, send=True
) -> Membership:
    email = (email or "").strip().lower()
    if not email or "@" not in email:
        raise PortalError("Enter a valid email address.")
    if role not in Role.values:
        raise PortalError("Choose a role.")
    user = User.objects.filter(email__iexact=email).first()
    if user is not None and user_roles(user):
        raise PortalError("That address belongs to a Vitalos staff account. Staff cannot be portal members.")
    with transaction.atomic():
        if user is None:
            user = User(email=email, full_name=(full_name or "").strip()[:150])
            user.set_unusable_password()
            user.save()
        member, created = Membership.objects.get_or_create(
            organisation=organisation,
            user=user,
            defaults={"role": role, "invited_by": actor, "is_active": True},
        )
        if not created:
            if member.accepted_at and member.revoked_at is None and member.is_active:
                raise PortalError("That person is already a member.")
            member.role, member.is_active, member.revoked_at = role, True, None
            member.invited_by = actor
            member.save()
        token = _issue_invitation(member, actor, request)
    record(
        "portal.member_invited",
        request=request,
        actor=actor,
        entity=member,
        summary=f"Invited {email} to {organisation.name} as {role}",
    )
    if send:
        try:
            _send_invitation(member, token)
        except Exception:  # noqa: BLE001 - the invitation exists; staff can re-send
            record("portal.email_failed", request=request, entity=member, summary="Invitation email failed")
    member._raw_token = token  # available to callers/tests; never persisted
    return member


def resend_invitation(member: Membership, *, actor, request=None, send=True) -> str:
    if member.accepted_at:
        raise PortalError("This member has already accepted their invitation.")
    token = _issue_invitation(member, actor, request)
    record(
        "portal.invitation_resent",
        request=request,
        actor=actor,
        entity=member,
        summary=f"For {member.user.email}",
    )
    if send:
        _send_invitation(member, token)
    return token


def lookup_invitation(token: str) -> Invitation | None:
    if not token or len(token) > 200:
        return None
    return (
        Invitation.objects.select_related("membership__user", "membership__organisation")
        .filter(token_hash=hash_token(token))
        .first()
    )


def accept_invitation(invitation: Invitation, *, password: str | None, request=None) -> Membership:
    """Redeem once: set the password (or, for a user who already has one, confirm it) and activate the member."""
    with transaction.atomic():
        inv = Invitation.objects.select_for_update().select_related("membership__user").get(pk=invitation.pk)
        if not inv.is_usable:
            raise PortalError("This invitation has expired or was already used.")
        member = inv.membership
        if not member.is_active or member.revoked_at is not None:
            raise PortalError("This invitation is no longer valid.")
        user = member.user
        if user_roles(user):
            raise PortalError("This invitation is no longer valid.")
        if password is not None:
            user.set_password(password)
            user.save(update_fields=["password"])
        inv.used_at = _now()
        inv.save(update_fields=["used_at"])
        member.accepted_at = member.accepted_at or _now()
        member.save(update_fields=["accepted_at"])
    record(
        "portal.invitation_accepted",
        request=request,
        actor=member.user,
        entity=member,
        summary=f"{member.organisation.name}",
    )
    return member


def change_role(member: Membership, role: str, *, actor, request=None) -> None:
    if role not in Role.values:
        raise PortalError("Choose a role.")
    before = member.role
    member.role = role
    member.save(update_fields=["role"])
    record(
        "portal.member_role_changed",
        request=request,
        actor=actor,
        entity=member,
        summary=f"{member.user.email}: {before} to {role}",
    )


def revoke_member(member: Membership, *, actor, request=None) -> None:
    """Immediate: access is evaluated from the membership on every request."""
    member.is_active = False
    member.revoked_at = _now()
    member.save(update_fields=["is_active", "revoked_at"])
    member.invitations.filter(used_at__isnull=True, revoked_at__isnull=True).update(revoked_at=_now())
    record("portal.member_revoked", request=request, actor=actor, entity=member, summary=member.user.email)


def restore_member(member: Membership, *, actor, request=None) -> None:
    member.is_active = True
    member.revoked_at = None
    member.save(update_fields=["is_active", "revoked_at"])
    record("portal.member_restored", request=request, actor=actor, entity=member, summary=member.user.email)


# ============================================================================================================
# Challenges and briefs (staff)
# ============================================================================================================


def link_challenge(
    *, opportunity, organisation: Organisation, actor, request=None, title: str = ""
) -> Challenge:
    """Explicitly link an existing opportunity to an organisation. Snapshots the customer's own words; the
    opportunity is not modified. The challenge stays private until ``share_challenge``."""
    if hasattr(opportunity, "portal_challenge"):
        raise PortalError("This opportunity is already linked to a portal challenge.")
    words = continuity.submitted_words(opportunity)
    with transaction.atomic():
        challenge = Challenge.objects.create(
            organisation=organisation,
            opportunity=opportunity,
            title=(title or opportunity.title)[:200],
            submitted_problem=words["problem"],
            submitted_outcome=words["outcome"],
            submitted_at=opportunity.created_at,
            created_by=actor,
        )
        # An APPROVED workspace brief (and only that) is carried over, as a DRAFT version: the customer's own
        # words as customer statements, the approved fields tagged agreed fact or AI suggestion. Without one,
        # the first version holds the customer's own words, or (no source enquiry) what Vitalos wrote.
        carried = continuity.carried_brief_segments(opportunity)
        segments = continuity.first_segments(opportunity) if carried is None else carried
        BriefVersion.objects.create(
            challenge=challenge,
            number=1,
            summary="Starting point: what you told us"
            if carried is None
            else "What you told us, and the brief we prepared",
            segments=segments,
            created_by=actor,
        )
    record(
        "portal.challenge_linked",
        request=request,
        actor=actor,
        entity=challenge,
        summary=f"{opportunity.ref} linked to {organisation.name}",
    )
    return challenge


def update_challenge(challenge: Challenge, *, actor, request=None, **fields) -> Challenge:
    allowed = {
        "title",
        "submitted_problem",
        "submitted_outcome",
        "journey_stage",
        "status_note",
        "internal_notes",
    }
    changed = []
    for name, value in fields.items():
        if name in allowed and getattr(challenge, name) != value:
            setattr(challenge, name, value)
            changed.append(name)
    if changed:
        challenge.save()
        if "journey_stage" in changed and challenge.is_shared:
            event(
                challenge,
                "journey",
                f"Your challenge moved to: {challenge.get_journey_stage_display()}",
                url_name="challenge",
                url_kwargs={"pk": challenge.pk},
            )
        record(
            "portal.challenge_updated",
            request=request,
            actor=actor,
            entity=challenge,
            summary=f"Changed {', '.join(changed)}",
        )
    return challenge


def share_challenge(challenge: Challenge, *, actor, request=None) -> None:
    if challenge.is_shared:
        return
    challenge.shared_at = _now()
    challenge.save(update_fields=["shared_at"])
    event(
        challenge,
        "challenge_shared",
        f"Your challenge '{challenge.title}' is now in your portal",
        url_name="challenge",
        url_kwargs={"pk": challenge.pk},
    )
    record("portal.challenge_shared", request=request, actor=actor, entity=challenge, summary=challenge.title)


def save_brief(
    challenge: Challenge,
    *,
    segments,
    summary="",
    change_note="",
    actor,
    request=None,
    brief: BriefVersion | None = None,
) -> BriefVersion:
    try:
        validate_segments(segments)
    except ValidationError as exc:
        raise PortalError(" ".join(exc.messages)) from exc
    with transaction.atomic():
        if brief is not None:
            if brief.status != BriefStatus.DRAFT:
                raise PortalError("Only a draft can be edited. Create a new version instead.")
        else:
            brief = BriefVersion(
                challenge=challenge, number=selectors.next_number(BriefVersion, {"challenge": challenge})
            )
            brief.created_by = actor
        brief.segments = segments
        brief.summary = summary[:300]
        brief.change_note = change_note[:300]
        brief.save()
    record(
        "portal.brief_saved",
        request=request,
        actor=actor,
        entity=brief,
        summary=f"{challenge.title} v{brief.number}",
    )
    return brief


def propose_brief(brief: BriefVersion, *, actor, request=None) -> None:
    if brief.status != BriefStatus.DRAFT:
        raise PortalError("Only a draft can be proposed.")
    if not brief.segments:
        raise PortalError("Add at least one segment before proposing.")
    challenge = brief.challenge
    if not challenge.is_shared:
        raise PortalError("Share the challenge with the customer first.")
    brief.status = BriefStatus.PROPOSED
    brief.proposed_at = _now()
    brief.save(update_fields=["status", "proposed_at"])
    event(
        challenge,
        "brief_proposed",
        f"A new brief (version {brief.number}) is ready for you to review",
        url_name="challenge",
        url_kwargs={"pk": challenge.pk},
    )
    notifications.notify(
        challenge.organisation,
        kind="brief",
        title=f"Brief version {brief.number} is ready for your review",
        body=f"For: {challenge.title}",
        url_name="challenge",
        url_kwargs={"pk": challenge.pk},
        key=f"brief:{brief.pk}",
    )
    record(
        "portal.brief_proposed",
        request=request,
        actor=actor,
        entity=brief,
        summary=f"{challenge.title} v{brief.number}",
    )


def _lock_brief(brief: BriefVersion) -> BriefVersion:
    """Lock the brief row and re-check, on the fresh row, that it is still the proposed version under review."""
    fresh = BriefVersion.objects.select_for_update().select_related("challenge").get(pk=brief.pk)
    if fresh.status != BriefStatus.PROPOSED:
        raise PortalError("This brief is not waiting for review.")
    if BriefVersion.objects.filter(
        challenge_id=fresh.challenge_id, number__gt=fresh.number, proposed_at__isnull=False
    ).exists():
        raise PortalError("A newer brief has been proposed. Please review the latest version.")
    return fresh


def review_brief(
    member: Membership, brief: BriefVersion, *, accept: bool, comment: str, request=None
) -> BriefReview:
    if brief.challenge.organisation_id != member.organisation_id:
        raise PortalError("Not available.")
    if brief.status != BriefStatus.PROPOSED:
        raise PortalError("This brief is not waiting for review.")
    comment = _clean_text(comment, field="Comment", required=not accept, limit=2000)
    if accept and not member.can_approve:
        raise PortalError(
            "Your role can comment on a brief but not accept it. Ask an approver, or request changes."
        )
    if not accept and not member.can_comment:
        raise PortalError("Your role is read-only.")
    with transaction.atomic():
        brief = _lock_brief(brief)
        review = BriefReview.objects.create(
            brief=brief,
            user=member.user,
            decision=BriefReview.Decision.ACCEPTED if accept else BriefReview.Decision.CHANGES,
            comment=comment,
        )
        if accept:
            BriefVersion.objects.filter(challenge=brief.challenge, status=BriefStatus.AGREED).update(
                status=BriefStatus.SUPERSEDED
            )
            brief.status = BriefStatus.AGREED
            brief.agreed_at = _now()
            brief.agreed_by = member.user
        else:
            brief.status = BriefStatus.CHANGES_REQUESTED
        brief.save()
    summary = (
        f"{member.name} accepted brief version {brief.number}"
        if accept
        else f"{member.name} asked for changes to brief version {brief.number}"
    )
    event(
        brief.challenge,
        "brief_reviewed",
        summary,
        actor=member.user,
        customer=True,
        url_name="challenge",
        url_kwargs={"pk": brief.challenge_id},
    )
    record("portal.brief_reviewed", request=request, actor=member.user, entity=brief, summary=summary)
    return review


# ============================================================================================================
# Projects, milestones, deliverables (staff)
# ============================================================================================================


def set_published(obj, published: bool, *, actor, request=None) -> None:
    """Explicit publication of a record that has ``published_at`` (project, milestone, deliverable, item,
    question, service, report)."""
    if published and obj.published_at is None:
        obj.published_at = _now()
        obj.save(update_fields=["published_at"])
        record("portal.published", request=request, actor=actor, entity=obj, summary=str(obj)[:200])
    elif not published and obj.published_at is not None:
        obj.published_at = None
        obj.save(update_fields=["published_at"])
        record("portal.unpublished", request=request, actor=actor, entity=obj, summary=str(obj)[:200])


def save_project(
    challenge: Challenge, *, actor, request=None, project: Project | None = None, **fields
) -> Project:
    project = project or Project(challenge=challenge)
    scope_before = project.agreed_scope
    for name in ("name", "summary", "agreed_scope", "status", "target_date", "internal_notes"):
        if name in fields:
            setattr(project, name, fields[name])
    project.save()
    summary = project.name + (
        " (agreed scope changed)" if scope_before != project.agreed_scope and project.pk else ""
    )
    record("portal.project_saved", request=request, actor=actor, entity=project, summary=summary[:250])
    return project


def save_item(
    project: Project, *, actor, request=None, item: ProjectItem | None = None, **fields
) -> ProjectItem:
    item = item or ProjectItem(project=project)
    for name in ("kind", "party", "text", "due_date", "is_done", "internal_notes"):
        if name in fields:
            setattr(item, name, fields[name])
    item.save()
    record(
        "portal.item_saved",
        request=request,
        actor=actor,
        entity=item,
        summary=f"{item.kind}: {item.text}"[:250],
    )
    return item


def save_milestone(
    project: Project, *, actor, request=None, milestone: Milestone | None = None, **fields
) -> Milestone:
    milestone = milestone or Milestone(project=project)
    before = (milestone.status, milestone.target_date)
    for name in ("title", "description", "status", "target_date", "position", "internal_notes"):
        if name in fields:
            setattr(milestone, name, fields[name])
    if milestone.status == "complete" and milestone.completed_on is None:
        milestone.completed_on = timezone.localdate()
    if milestone.status != "complete":
        milestone.completed_on = None
    milestone.save()
    if milestone.published_at and milestone.pk and before != (milestone.status, milestone.target_date):
        event(
            project.challenge,
            "milestone",
            f"Milestone '{milestone.title}': {milestone.get_status_display()}",
            project=project,
            milestone=milestone,
            url_name="project",
            url_kwargs={"pk": project.pk},
        )
    record("portal.milestone_saved", request=request, actor=actor, entity=milestone, summary=milestone.title)
    return milestone


def save_deliverable(
    project: Project, *, actor, request=None, deliverable: Deliverable | None = None, **fields
) -> Deliverable:
    deliverable = deliverable or Deliverable(project=project)
    for name in ("title", "description", "milestone", "internal_notes"):
        if name in fields:
            setattr(deliverable, name, fields[name])
    deliverable.save()
    record(
        "portal.deliverable_saved",
        request=request,
        actor=actor,
        entity=deliverable,
        summary=deliverable.title,
    )
    return deliverable


def create_version(
    deliverable: Deliverable,
    *,
    actor,
    request=None,
    summary="",
    body="",
    file_version=None,
    requires_approval=True,
    is_contractual=False,
    internal_notes="",
) -> DeliverableVersion:
    """A new version always starts unshared and unapproved. It inherits nothing from earlier versions."""
    with transaction.atomic():
        version = DeliverableVersion.objects.create(
            deliverable=deliverable,
            number=selectors.next_number(DeliverableVersion, {"deliverable": deliverable}),
            summary=summary[:300],
            body=body,
            file_version=file_version,
            requires_approval=requires_approval,
            is_contractual=is_contractual,
            internal_notes=internal_notes,
            created_by=actor,
        )
    record("portal.version_created", request=request, actor=actor, entity=version, summary=str(version))
    return version


def share_version(version: DeliverableVersion, *, actor, request=None) -> None:
    """Explicit staff action: the version (and its file) becomes visible and approvers are asked to review."""
    if version.shared_at is not None and version.withdrawn_at is None:
        return
    deliverable = version.deliverable
    project = deliverable.project
    if project.published_at is None or not project.challenge.is_shared:
        raise PortalError(
            "Publish the project (and share its challenge) before sharing a deliverable version."
        )
    with transaction.atomic():
        Deliverable.objects.select_for_update().get(pk=deliverable.pk)
        if deliverable.published_at is None:
            deliverable.published_at = _now()
            deliverable.save(update_fields=["published_at"])
        if version.file_version_id:
            # Only the pinned file version becomes visible; earlier or later versions stay internal.
            File.objects.filter(pk=version.file_version.file_id).update(visibility=FileVisibility.CUSTOMER)
            FileVersion.objects.filter(pk=version.file_version_id).update(customer_visible=True)
        version.shared_at = _now()
        version.withdrawn_at = None
        version.save(update_fields=["shared_at", "withdrawn_at"])
    event(
        project.challenge,
        "deliverable_shared",
        f"{deliverable.title}: version {version.number} is ready to review",
        project=project,
        version=version,
        url_name="deliverable",
        url_kwargs={"pk": deliverable.pk},
    )
    notifications.notify(
        project.challenge.organisation,
        kind="approval" if version.requires_approval else "deliverable",
        title=f"{deliverable.title} version {version.number} is ready to review",
        body=version.summary or f"Project: {project.name}",
        url_name="deliverable",
        url_kwargs={"pk": deliverable.pk},
        key=f"version:{version.pk}",
    )
    record("portal.version_shared", request=request, actor=actor, entity=version, summary=str(version))


def withdraw_version(version: DeliverableVersion, *, actor, request=None) -> None:
    if version.withdrawn_at is None:
        version.withdrawn_at = _now()
        version.save(update_fields=["withdrawn_at"])
        record("portal.version_withdrawn", request=request, actor=actor, entity=version, summary=str(version))


# --- Updates ---------------------------------------------------------------------------------------------------------------


def save_update(
    challenge: Challenge, *, title, body, project=None, internal_notes="", actor, request=None, update=None
) -> Update:
    if update is not None and update.status == Update.Status.PUBLISHED:
        raise PortalError("A published update cannot be edited. Prepare a new one.")
    update = update or Update(challenge=challenge, prepared_by=actor)
    update.title = _clean_text(title, field="Title", limit=200)
    update.body = _clean_text(body, field="Body", limit=8000)
    update.project = project
    update.internal_notes = internal_notes
    update.save()
    record("portal.update_saved", request=request, actor=actor, entity=update, summary=update.title)
    return update


def publish_update(update: Update, *, actor, request=None) -> None:
    if update.status == Update.Status.PUBLISHED:
        raise PortalError("Already published.")
    if not update.challenge.is_shared:
        raise PortalError("Share the challenge with the customer first.")
    if update.project_id and update.project.published_at is None:
        raise PortalError("This update is linked to a project that is not published.")
    update.status = Update.Status.PUBLISHED
    update.published_at = _now()
    update.published_by = actor
    update.save()
    event(
        update.challenge,
        "update",
        f"Update: {update.title}",
        project=update.project,
        url_name="update",
        url_kwargs={"pk": update.pk},
    )
    notifications.notify(
        update.challenge.organisation,
        kind="update",
        title=update.title,
        body=update.body[:200],
        url_name="update",
        url_kwargs={"pk": update.pk},
        key=f"update:{update.pk}",
    )
    record("portal.update_published", request=request, actor=actor, entity=update, summary=update.title)


# --- Questions --------------------------------------------------------------------------------------------------------------


def ask_question(
    challenge: Challenge,
    *,
    question,
    detail="",
    due_date=None,
    project=None,
    assigned_to=None,
    actor,
    request=None,
    publish=True,
) -> InformationRequest:
    q = InformationRequest.objects.create(
        challenge=challenge,
        project=project,
        question=_clean_text(question, field="Question", limit=400),
        detail=_clean_text(detail, field="Detail", required=False, limit=2000),
        owner=actor,
        assigned_to=assigned_to,
        due_date=due_date,
    )
    record(
        "portal.question_asked",
        request=request,
        actor=actor,
        entity=q,
        summary=f"{challenge.title}: {q.question}"[:250],
    )
    if publish:
        publish_question(q, actor=actor, request=request)
    return q


def publish_question(q: InformationRequest, *, actor, request=None) -> None:
    if q.published_at is not None:
        return
    if not q.challenge.is_shared:
        raise PortalError("Share the challenge with the customer first.")
    q.published_at = _now()
    q.save(update_fields=["published_at"])
    event(
        q.challenge,
        "question",
        f"Vitalos asked: {q.question}",
        project=q.project,
        url_name="question",
        url_kwargs={"pk": q.pk},
    )
    recipients = [q.assigned_to] if q.assigned_to_id else None
    notifications.notify(
        q.challenge.organisation,
        kind="question",
        title="A question for you",
        body=q.question,
        url_name="question",
        url_kwargs={"pk": q.pk},
        key=f"question:{q.pk}",
        recipients=recipients,
        min_level=2,
    )


def close_question(q: InformationRequest, *, actor, request=None) -> None:
    q.status = InformationRequest.Status.CLOSED
    q.save(update_fields=["status"])
    record("portal.question_closed", request=request, actor=actor, entity=q, summary=q.question[:200])


def answer_question(
    member: Membership, q: InformationRequest, *, body: str, request=None
) -> InformationResponse:
    if not member.can_comment:
        raise PortalError("Your role is read-only. Ask a contributor to answer.")
    if q.challenge.organisation_id != member.organisation_id or q.published_at is None:
        raise PortalError("Not available.")
    if q.status == InformationRequest.Status.CLOSED:
        raise PortalError("This question is closed.")
    body = _clean_text(body, field="Answer", limit=4000)
    with transaction.atomic():
        response = InformationResponse.objects.create(request=q, user=member.user, body=body)
        q.status = InformationRequest.Status.ANSWERED
        q.answered_at = _now()
        q.save(update_fields=["status", "answered_at"])
    event(
        q.challenge,
        "question_answered",
        f"{member.name} answered: {q.question}",
        project=q.project,
        actor=member.user,
        customer=True,
        url_name="question",
        url_kwargs={"pk": q.pk},
    )
    record("portal.question_answered", request=request, actor=member.user, entity=q, summary=q.question[:200])
    return response


# --- Discussion --------------------------------------------------------------------------------------------------------------


def _thread(challenge, *, milestone=None, deliverable=None, internal=False) -> Thread:
    thread = Thread.objects.filter(
        challenge=challenge, milestone=milestone, deliverable=deliverable, is_internal=internal
    ).first()
    if thread is None:
        title = "Internal discussion" if internal else (deliverable or milestone or challenge).__str__()
        thread = Thread.objects.create(
            challenge=challenge,
            milestone=milestone,
            deliverable=deliverable,
            is_internal=internal,
            title=str(title)[:200],
        )
    return thread


def post_customer_message(
    member: Membership,
    challenge: Challenge,
    *,
    body: str,
    milestone=None,
    deliverable=None,
    upload=None,
    request=None,
) -> Message:
    if not member.can_comment:
        raise PortalError("Your role is read-only.")
    if challenge.organisation_id != member.organisation_id or not challenge.is_shared:
        raise PortalError("Not available.")
    body = _clean_text(body, field="Message", limit=4000)
    with transaction.atomic():
        thread = _thread(challenge, milestone=milestone, deliverable=deliverable)
        message = Message.objects.create(thread=thread, author=member.user, author_is_staff=False, body=body)
        if upload is not None:
            upload_customer_file(member, challenge, upload, message=message, request=request)
    event(
        challenge,
        "message",
        f"{member.name} posted in {thread.title or 'the discussion'}",
        actor=member.user,
        customer=True,
        url_name="challenge",
        url_kwargs={"pk": challenge.pk},
    )
    record(
        "portal.message_posted",
        request=request,
        actor=member.user,
        entity=message,
        summary=f"In {thread.title}"[:200],
    )
    return message


def post_staff_message(
    challenge: Challenge, *, body: str, actor, internal=False, milestone=None, deliverable=None, request=None
) -> Message:
    body = _clean_text(body, field="Message", limit=4000)
    if not internal and not challenge.is_shared:
        raise PortalError("Share the challenge with the customer first.")
    thread = _thread(challenge, milestone=milestone, deliverable=deliverable, internal=internal)
    message = Message.objects.create(thread=thread, author=actor, author_is_staff=True, body=body)
    if not internal:
        event(
            challenge,
            "message",
            "Vitalos replied in the discussion",
            actor=actor,
            url_name="challenge",
            url_kwargs={"pk": challenge.pk},
        )
        notifications.notify(
            challenge.organisation,
            kind="message",
            title="New message from Vitalos",
            body=body[:200],
            url_name="challenge",
            url_kwargs={"pk": challenge.pk},
            key=f"message:{message.pk}",
        )
    record(
        "portal.message_posted",
        request=request,
        actor=actor,
        entity=message,
        summary=("Internal note" if internal else "Reply") + f" on {challenge.title}",
    )
    return message


# --- Approvals ----------------------------------------------------------------------------------------------------------------


def _version_for_decision(member: Membership, version: DeliverableVersion) -> None:
    deliverable = version.deliverable
    if (
        deliverable.project.challenge.organisation_id != member.organisation_id
        or version.shared_at is None
        or version.withdrawn_at is not None
        or deliverable.published_at is None
        or deliverable.project.published_at is None
    ):
        raise PortalError("Not available.")
    if selectors.has_newer_version(version):
        raise PortalError(
            "A newer version has been shared. Decisions are recorded against the version you are reviewing, "
            "so please review the latest version."
        )


def _lock_version(member: Membership, version: DeliverableVersion) -> DeliverableVersion:
    """Inside a transaction: lock the deliverable (which also serialises ``share_version`` and
    ``withdraw_version``), reload the version and re-run the checks on the fresh rows, so a decision never
    lands on a version that a concurrent request has just superseded or withdrawn."""
    Deliverable.objects.select_for_update().get(pk=version.deliverable_id)
    fresh = DeliverableVersion.objects.select_related("deliverable__project__challenge").get(pk=version.pk)
    _version_for_decision(member, fresh)
    return fresh


def approve_version(member: Membership, version: DeliverableVersion, *, comment="", request=None) -> Approval:
    if not member.can_approve:
        raise PortalError("Your role cannot approve. Ask an approver in your organisation.")
    _version_for_decision(member, version)
    if not version.requires_approval:
        raise PortalError("This version is shared for information and does not need approval.")
    comment = _clean_text(comment, field="Comment", required=False, limit=2000)
    try:
        with transaction.atomic():
            version = _lock_version(member, version)
            approval = Approval.objects.create(
                version=version,
                kind=Approval.Kind.REVIEW,
                decision=Approval.Decision.APPROVED,
                user=member.user,
                user_email=member.user.email,
                user_name=member.user.full_name,
                role=member.role,
                comment=comment,
                ip=client_ip(request) or None if request is not None else None,
            )
    except IntegrityError as exc:
        raise PortalError("This version has already been approved.") from exc
    _decision_side_effects(member, version, approval, "approved")
    return approval


def request_version_changes(
    member: Membership, version: DeliverableVersion, *, comment: str, request=None
) -> Approval:
    if not member.can_approve:
        raise PortalError(
            "Your role cannot record a review decision. You can still comment in the discussion."
        )
    _version_for_decision(member, version)
    if selectors.version_state(version) == "approved":
        raise PortalError(
            "This version is already approved. Ask Vitalos for a new version if something must change."
        )
    comment = _clean_text(comment, field="What needs to change", limit=2000)
    with transaction.atomic():
        version = _lock_version(member, version)
        if selectors.version_state(version) == "approved":
            raise PortalError(
                "This version is already approved. Ask Vitalos for a new version if something must change."
            )
        approval = Approval.objects.create(
            version=version,
            kind=Approval.Kind.REVIEW,
            decision=Approval.Decision.CHANGES,
            user=member.user,
            user_email=member.user.email,
            user_name=member.user.full_name,
            role=member.role,
            comment=comment,
            ip=client_ip(request) or None if request is not None else None,
        )
    _decision_side_effects(member, version, approval, "asked for changes to")
    return approval


def accept_contract(
    member: Membership, version: DeliverableVersion, *, confirmed: bool, request=None
) -> Approval:
    """Contractual acceptance: distinct from a review approval, signatories only, explicit confirmation."""
    if not member.can_accept_contract:
        raise PortalError("Only an authorised signatory can record contractual acceptance.")
    _version_for_decision(member, version)
    if not version.is_contractual:
        raise PortalError("This version is not a contractual document.")
    if not confirmed:
        raise PortalError("Tick the confirmation to record contractual acceptance.")
    statement = ACCEPTANCE_STATEMENT.format(
        organisation=member.organisation.name, title=version.deliverable.title, number=version.number
    )
    try:
        with transaction.atomic():
            version = _lock_version(member, version)
            approval = Approval.objects.create(
                version=version,
                kind=Approval.Kind.CONTRACTUAL,
                decision=Approval.Decision.ACCEPTED,
                user=member.user,
                user_email=member.user.email,
                user_name=member.user.full_name,
                role=member.role,
                statement=statement,
                ip=client_ip(request) or None if request is not None else None,
            )
    except IntegrityError as exc:
        raise PortalError("Contractual acceptance is already recorded for this version.") from exc
    _decision_side_effects(member, version, approval, "contractually accepted", contract=True)
    return approval


def _decision_side_effects(member, version, approval, verb: str, contract=False) -> None:
    deliverable = version.deliverable
    project = deliverable.project
    summary = f"{member.name} {verb} {deliverable.title} (version {version.number})"
    event(
        project.challenge,
        "decision",
        summary,
        project=project,
        version=version,
        actor=member.user,
        customer=True,
        url_name="deliverable",
        url_kwargs={"pk": deliverable.pk},
    )
    notifications.notify(
        project.challenge.organisation,
        kind="decision",
        title="Decision recorded",
        body=summary,
        url_name="deliverable",
        url_kwargs={"pk": deliverable.pk},
        key=f"decision:{approval.pk}",
        exclude_user=member.user,
        send_email=False,
    )
    record(
        "portal.contract_accepted" if contract else "portal.approval_recorded",
        actor=member.user,
        entity=approval,
        summary=f"{summary}: {approval.decision}"[:290],
    )


# --- Change requests ----------------------------------------------------------------------------------------------------------


def request_change(
    member: Membership, project: Project, *, title: str, description: str, affects: str, request=None
) -> ChangeRequest:
    """The portal can only ask. Scope, price and dates change only through the staff change process."""
    if not member.can_comment:
        raise PortalError("Your role is read-only.")
    if project.challenge.organisation_id != member.organisation_id or project.published_at is None:
        raise PortalError("Not available.")
    change = ChangeRequest.objects.create(
        project=project,
        raised_by=member.user,
        title=_clean_text(title, field="Title", limit=200),
        description=_clean_text(description, field="Description", limit=4000),
        affects=(affects or "")[:60],
    )
    ChangeReview.objects.create(
        change=change,
        from_status="",
        to_status=ChangeStatus.SUBMITTED,
        actor=member.user,
        actor_email=member.user.email,
        note="Submitted by the customer",
    )
    event(
        project.challenge,
        "change_requested",
        f"{member.name} requested a change: {change.title}",
        project=project,
        actor=member.user,
        customer=True,
        url_name="change",
        url_kwargs={"pk": change.pk},
    )
    record("portal.change_requested", request=request, actor=member.user, entity=change, summary=change.title)
    return change


_ALLOWED_TRANSITIONS = {
    ChangeStatus.SUBMITTED: {ChangeStatus.UNDER_REVIEW, ChangeStatus.ACCEPTED, ChangeStatus.DECLINED},
    ChangeStatus.UNDER_REVIEW: {ChangeStatus.ACCEPTED, ChangeStatus.DECLINED},
    ChangeStatus.ACCEPTED: set(),
    ChangeStatus.DECLINED: set(),
    ChangeStatus.WITHDRAWN: set(),
}


def review_change(
    change: ChangeRequest, *, to_status: str, response: str, note: str, actor, request=None
) -> None:
    """Staff review trail: who moved it to which state and when. Accepting records the decision only; any scope,
    price or date change is made separately through the normal staff process (and published explicitly)."""
    if to_status not in _ALLOWED_TRANSITIONS.get(change.status, set()):
        raise PortalError(
            f"A change request that is {change.get_status_display().lower()} cannot move to that state."
        )
    if to_status in (ChangeStatus.ACCEPTED, ChangeStatus.DECLINED) and not response.strip():
        raise PortalError("Write the response the customer will see.")
    previous = change.status
    change.status = to_status
    if response.strip():
        change.customer_response = response.strip()[:4000]
    if note.strip():
        stamp = timezone.localtime().strftime("%Y-%m-%d %H:%M")
        change.internal_notes = (
            f"{change.internal_notes}\n[{stamp} {getattr(actor, 'email', '')}] {note.strip()}".strip()
        )
    change.save()
    ChangeReview.objects.create(
        change=change,
        from_status=previous,
        to_status=to_status,
        actor=actor,
        actor_email=getattr(actor, "email", ""),
        note=(response.strip() or f"Moved to {change.get_status_display().lower()}")[:500],
        customer_visible=True,
    )
    project = change.project
    event(
        project.challenge,
        "change_reviewed",
        f"Your change request '{change.title}' is now: {change.get_status_display()}",
        project=project,
        url_name="change",
        url_kwargs={"pk": change.pk},
    )
    notifications.notify(
        project.challenge.organisation,
        kind="change",
        title=f"Change request {change.get_status_display().lower()}",
        body=change.title,
        url_name="change",
        url_kwargs={"pk": change.pk},
        key=f"change:{change.pk}:{to_status}",
        recipients=list(
            selectors.live_member_users(project.challenge.organisation).filter(user=change.raised_by)
        ),
    )
    record(
        "portal.change_reviewed",
        request=request,
        actor=actor,
        entity=change,
        summary=f"{change.title}: {previous} to {to_status}"[:250],
    )


# --- Files --------------------------------------------------------------------------------------------------------------------


def _add_file_version(
    file: File, checked, *, user, organisation_id: int, customer_visible: bool = False
) -> FileVersion:
    key = portal_files.store(organisation_id, checked)
    if checked.refused_reason:
        raise PortalError(checked.refused_reason)
    status = FileVersion.Status.STORED if key else FileVersion.Status.UNAVAILABLE
    return FileVersion.objects.create(
        file=file,
        number=selectors.next_number(FileVersion, {"file": file}),
        storage_key=key,
        original_name=checked.filename,
        content_type=checked.content_type,
        size=len(checked.data),
        sha256=checked.sha256,
        upload_status=status,
        reason="" if key else "File storage is not configured, so the file's contents were not kept.",
        uploaded_by=user,
        customer_visible=customer_visible,
    )


def upload_customer_file(
    member: Membership,
    challenge: Challenge,
    upload,
    *,
    project=None,
    message=None,
    file: File | None = None,
    title="",
    request=None,
) -> FileVersion:
    if not member.can_comment:
        raise PortalError("Your role is read-only.")
    if challenge.organisation_id != member.organisation_id or not challenge.is_shared:
        raise PortalError("Not available.")
    data = upload.read(portal_files.MAX_BYTES + 1)
    checked = portal_files.check(upload.name, getattr(upload, "content_type", ""), data)
    if checked.refused_reason:
        record(
            "portal.file_rejected",
            request=request,
            actor=member.user,
            entity=challenge,
            summary=f"{checked.filename}: {checked.refused_reason}"[:250],
        )
        raise PortalError(checked.refused_reason)
    with transaction.atomic():
        if file is None:
            file = File.objects.create(
                challenge=challenge,
                project=project,
                message=message,
                title=(title or checked.filename)[:200],
                visibility=FileVisibility.CUSTOMER,
                uploaded_by_customer=True,
                created_by=member.user,
            )
        elif (
            file.challenge_id != challenge.pk
            or file.visibility != FileVisibility.CUSTOMER
            or not file.uploaded_by_customer
        ):
            # A customer may add a version only to a file a customer uploaded, never to one staff published.
            raise PortalError("Not available.")
        version = _add_file_version(
            file, checked, user=member.user, organisation_id=member.organisation_id, customer_visible=True
        )
    event(
        challenge,
        "file",
        f"{member.name} uploaded {checked.filename}",
        actor=member.user,
        customer=True,
        url_name="file",
        url_kwargs={"pk": file.pk},
    )
    record(
        "portal.file_uploaded",
        request=request,
        actor=member.user,
        entity=file,
        summary=f"{checked.filename} ({len(checked.data)} bytes)"[:250],
    )
    return version


def upload_staff_file(
    challenge: Challenge,
    upload,
    *,
    actor,
    project=None,
    title="",
    visibility=FileVisibility.INTERNAL,
    retention_note="",
    request=None,
) -> FileVersion:
    data = upload.read(portal_files.MAX_BYTES + 1)
    checked = portal_files.check(upload.name, getattr(upload, "content_type", ""), data)
    if checked.refused_reason:
        record(
            "portal.file_rejected",
            request=request,
            actor=actor,
            entity=challenge,
            summary=checked.refused_reason,
        )
        raise PortalError(checked.refused_reason)
    with transaction.atomic():
        file = File.objects.create(
            challenge=challenge,
            project=project,
            title=(title or checked.filename)[:200],
            visibility=visibility,
            retention_note=retention_note[:300],
            created_by=actor,
        )
        version = _add_file_version(
            file,
            checked,
            user=actor,
            organisation_id=challenge.organisation_id,
            customer_visible=visibility == FileVisibility.CUSTOMER,
        )
    record(
        "portal.file_uploaded", request=request, actor=actor, entity=file, summary=f"{checked.filename}"[:250]
    )
    return version


def set_file_visibility(file: File, visibility: str, *, actor, request=None) -> None:
    if visibility not in FileVisibility.values:
        raise PortalError("Unknown visibility.")
    if file.visibility != visibility:
        file.visibility = visibility
        file.save(update_fields=["visibility"])
        if visibility == FileVisibility.CUSTOMER:
            # Explicit staff action on the whole file: its versions up to now become visible.
            file.versions.update(customer_visible=True)
        record(
            "portal.file_visibility",
            request=request,
            actor=actor,
            entity=file,
            summary=f"{file.title}: {visibility}"[:250],
        )
        if visibility == FileVisibility.CUSTOMER and file.challenge.is_shared:
            event(
                file.challenge,
                "file",
                f"Vitalos shared a file: {file.title}",
                url_name="file",
                url_kwargs={"pk": file.pk},
            )


# --- Managed services ---------------------------------------------------------------------------------------------------------


def save_service(
    organisation: Organisation,
    *,
    name,
    description="",
    project=None,
    actor,
    request=None,
    service=None,
    internal_notes="",
) -> ManagedService:
    service = service or ManagedService(organisation=organisation)
    service.name = _clean_text(name, field="Name", limit=200)
    service.description = description[:500]
    service.project = project
    service.internal_notes = internal_notes
    service.save()
    record("portal.service_saved", request=request, actor=actor, entity=service, summary=service.name)
    return service


def report_status(
    service: ManagedService, *, status: str, summary: str, actor, request=None, publish=True, reported_at=None
) -> ServiceStatusReport:
    """No live integrations exist: every report is a manual one, labelled as such to the customer."""
    if status not in ServiceStatusReport.Status.values:
        raise PortalError("Choose a status.")
    report = ServiceStatusReport.objects.create(
        service=service,
        status=status,
        source=ServiceStatusReport.Source.MANUAL,
        summary=summary[:500],
        reported_by=actor,
        reported_at=reported_at or _now(),
        published_at=_now() if publish else None,
    )
    record(
        "portal.status_reported",
        request=request,
        actor=actor,
        entity=report,
        summary=f"{service.name}: {status}",
    )
    return report
