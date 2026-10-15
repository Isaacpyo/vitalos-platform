"""Recruitment data retention (brief section 9, ADR-041), run nightly by the content tick.

- Applications and their CVs are deleted ``retention_months`` (default 6) after the later of the
  decision (``decided_at``) and the role's ``closed_at``. While the role is still open (no closing
  date yet) nothing is due. ``hired`` applications are flagged for manual handling, never deleted.
- Pending CV uploads and unused upload tickets older than 24 hours are deleted.
- Every deletion is audited with a hashed id. Like the enquiry retention job, this is a dry run that
  only logs the affected counts until ``RETENTION_ENFORCE=true`` is set by a person.
"""

import calendar
import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.core.files.storage import storages
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from apps.audit.services import record

from . import config as careers_config
from .models import Application, ApplicationStage, UploadTicket

logger = logging.getLogger(__name__)

UPLOAD_MAX_AGE = timedelta(hours=24)


def hashed_id(pk) -> str:
    """A stable, non-reversible id for audit rows about deleted personal data."""
    return salted_hmac("careers.deleted", str(pk), algorithm="sha256").hexdigest()[:32]


def add_months(moment: datetime, months: int) -> datetime:
    month = moment.month - 1 + months
    year = moment.year + month // 12
    month = month % 12 + 1
    day = min(moment.day, calendar.monthrange(year, month)[1])
    return moment.replace(year=year, month=month, day=day)


def anchor(application: Application) -> datetime | None:
    """The later of the decision and the role's closing; None while either is still to come."""
    role = application.role
    if role is not None and role.closed_at is None:
        return None
    moments = [m for m in (application.decided_at, role.closed_at if role else None) if m is not None]
    return max(moments) if moments else None


def due(now=None) -> tuple[list[Application], list[Application]]:
    """(applications to delete, hired applications to flag)."""
    now = now or timezone.now()
    months = careers_config.load()["retention_months"]
    delete, flag = [], []
    for application in Application.objects.select_related("role").order_by("created_at"):
        start = anchor(application)
        if start is None or add_months(start, months) > now:
            continue
        if application.stage == ApplicationStage.HIRED:
            if application.retention_flagged_at is None:
                flag.append(application)
        else:
            delete.append(application)
    return delete, flag


def remove_object(key: str) -> bool:
    """Delete one object from CV storage. True when it is gone (a missing object counts as gone).

    Any storage error (botocore raises its own exceptions, not OSError) is logged with a code and
    reported as False, so callers keep the database row and carry on with the next item.
    """
    if not key:
        return True
    try:
        storages["careers_cvs"].delete(key)
    except FileNotFoundError:
        return True
    except Exception:  # noqa: BLE001 - any backend failure: keep the row, try again next run
        logger.error("CV storage delete failed", extra={"code": "cv_delete_failed"})
        return False
    return True


def delete_application(application: Application, *, actor=None, request=None, reason: str = "") -> bool:
    """Hard delete of the CV, then the row (notes and events cascade), audited with a hashed id.

    The object goes first: if storage refuses, the row stays (so the CV is never orphaned) and this
    returns False.
    """
    if not remove_object(application.cv_path):
        return False
    with transaction.atomic():
        record(
            "careers.application_deleted",
            request=request,
            actor=actor,
            entity_type="careers.application",
            entity_id=hashed_id(application.pk),
            summary=reason or "Application deleted",
        )
        Application.objects.filter(duplicate_of=application).update(duplicate_of=None)
        application.delete()
    return True


def run(now=None, *, enforce: bool | None = None) -> int:
    """Returns how many applications were deleted (or would be, in a dry run)."""
    now = now or timezone.now()
    enforce = settings.RETENTION_ENFORCE if enforce is None else enforce
    delete, flag = due(now)
    if not enforce:
        logger.info("Careers retention dry run", extra={"would_delete": len(delete), "would_flag": len(flag)})
        return len(delete)
    for application in flag:
        Application.objects.filter(pk=application.pk).update(retention_flagged_at=now)
        record(
            "careers.application_flagged",
            entity_type="careers.application",
            entity_id=hashed_id(application.pk),
            summary="Hired application past retention: handle manually",
        )
    deleted = failed = 0
    for application in delete:
        if delete_application(application, reason="Retention period ended"):
            deleted += 1
        else:
            failed += 1
    log = logger.error if failed else logger.info
    log("Careers retention", extra={"deleted": deleted, "failed": failed, "flagged": len(flag)})
    return deleted


def purge_uploads(now=None) -> int:
    """Delete pending CV uploads and unused tickets older than 24 hours, for real.

    Abandoned uploads are not retention-policy data, so this does not wait for RETENTION_ENFORCE
    (docs/content/README.md promises pending uploads are gone within 24 hours). Spent tickets' rows
    (no personal data) are removed too. A storage failure keeps that ticket for the next run.
    """
    now = now or timezone.now()
    stale = list(UploadTicket.objects.filter(created_at__lt=now - UPLOAD_MAX_AGE))
    purged = failed = 0
    for ticket in stale:
        if ticket.consumed_at is None:
            if not remove_object(ticket.key):
                failed += 1
                continue
            record(
                "careers.upload_purged",
                entity_type="careers.uploadticket",
                entity_id=hashed_id(ticket.pk),
                summary="Unused CV upload older than 24 hours",
            )
            purged += 1
        UploadTicket.objects.filter(pk=ticket.pk).delete()
    log = logger.error if failed else logger.info
    log("Upload purge", extra={"deleted": purged, "failed": failed, "tickets": len(stale)})
    return purged
