"""Working applications in the admin (brief 7.5): stage, reviewer, notes, CV access and deletion.
Every change writes an ``ApplicationEvent`` and an audit row; no candidate data goes to the logs."""

import io

from django.core.exceptions import ValidationError
from django.core.files.storage import storages
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record

from . import access, retention
from .models import Application, ApplicationEvent, ApplicationEventType, ApplicationNote, ApplicationStage

DECIDED = (ApplicationStage.HIRED, ApplicationStage.REJECTED, ApplicationStage.WITHDRAWN)
CV_URL_SECONDS = 60


def mark_seen(application: Application) -> None:
    if application.seen_at is None:
        Application.objects.filter(pk=application.pk, seen_at__isnull=True).update(seen_at=timezone.now())
        application.seen_at = timezone.now()


def set_stage(application: Application, stage: str, *, actor, request=None) -> Application:
    if stage not in ApplicationStage.values:
        raise ValidationError("Choose a stage.")
    if stage == application.stage:
        return application
    with transaction.atomic():
        previous = application.stage
        application.stage = stage
        application.decided_at = timezone.now() if stage in DECIDED else None
        application.updated_at = timezone.now()
        application.save(update_fields=["stage", "decided_at", "updated_at"])
        ApplicationEvent.objects.create(
            application=application,
            actor_admin=actor,
            type=ApplicationEventType.STAGE_CHANGED,
            meta={"from": previous, "to": stage},
        )
        record(
            "careers.application_stage",
            request=request,
            actor=actor,
            entity=application,
            summary=f"Stage {previous} to {stage}",
        )
    return application


def assign(application: Application, assignee, *, actor, request=None) -> Application:
    if assignee is not None and not access.can_view_applications(assignee):
        raise ValidationError("That person cannot read applications.")
    with transaction.atomic():
        application.assigned_admin = assignee
        application.save(update_fields=["assigned_admin"])
        ApplicationEvent.objects.create(
            application=application,
            actor_admin=actor,
            type=ApplicationEventType.ASSIGNED,
            meta={"assignee": assignee.pk if assignee else None},
        )
        record(
            "careers.application_assigned",
            request=request,
            actor=actor,
            entity=application,
            summary="Reviewer assigned",
        )
    return application


def add_note(application: Application, body: str, *, actor, request=None) -> ApplicationNote:
    body = (body or "").strip()
    if not body:
        raise ValidationError("Write a note.")
    if len(body) > 5000:
        raise ValidationError("Notes must be 5,000 characters or fewer.")
    with transaction.atomic():
        note = ApplicationNote.objects.create(application=application, admin=actor, body=body)
        ApplicationEvent.objects.create(
            application=application, actor_admin=actor, type=ApplicationEventType.NOTE_ADDED
        )
        record(
            "careers.application_noted",
            request=request,
            actor=actor,
            entity=application,
            summary="Note added",
        )
    return note


def cv_access(application: Application, *, actor, request=None):
    """('url', signed URL) on object storage, or ('bytes', file) for local storage. Logged every time."""
    if not application.cv_path:
        raise ValidationError("This application has no CV.")
    storage = storages["careers_cvs"]
    with transaction.atomic():
        ApplicationEvent.objects.create(
            application=application, actor_admin=actor, type=ApplicationEventType.CV_VIEWED
        )
        record("careers.cv_viewed", request=request, actor=actor, entity=application, summary="CV downloaded")
    if getattr(storage, "querystring_auth", False):
        filename = application.cv_filename or f"cv.{application.cv_path.rsplit('.', 1)[-1]}"
        safe = filename.replace('"', "")
        url = storage.url(
            application.cv_path,
            parameters={
                "ResponseContentDisposition": f'attachment; filename="{safe}"',
                "ResponseContentType": "application/octet-stream",
            },
            expire=CV_URL_SECONDS,
        )
        return "url", url
    with storage.open(application.cv_path, "rb") as handle:
        return "bytes", io.BytesIO(handle.read())


def delete(application: Application, *, actor, request=None) -> None:
    retention.delete_application(
        application, actor=actor, request=request, reason="Deleted by an administrator"
    )
