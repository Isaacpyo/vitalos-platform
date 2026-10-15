"""Site-wide content changes: opening and closing sections, resync, page copy and homepage sections.

Each runs in one transaction with its audit row and sync event.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record

from . import sections, sync
from .models import SiteSection, SiteSettings, SyncEvent


def set_site_state(*, insights_open: bool, careers_open: bool, actor, request=None) -> SiteSettings:
    with transaction.atomic():
        site = SiteSettings.objects.select_for_update().get(pk=SiteSettings.load().pk)
        changes = []
        if site.insights_open != insights_open:
            changes.append(("Insights", insights_open))
        if site.careers_open != careers_open:
            changes.append(("Careers", careers_open))
        if not changes:
            return site
        site.insights_open = insights_open
        site.careers_open = careers_open
        site.updated_at = timezone.now()
        site.updated_by = actor
        site.save()
        for section, opened in changes:
            record(
                "content.site_opened" if opened else "content.site_closed",
                request=request,
                actor=actor,
                entity=site,
                summary=f"{section} {'opened' if opened else 'closed'} on the website",
                section=section.lower(),
            )
        any_opened = any(opened for _, opened in changes)
        any_closed = any(not opened for _, opened in changes)
        if any_closed:
            sync.emit("site", "", "site.closed", "Website sections closed")
        if any_opened:
            sync.emit("site", "", "site.opened", "Website sections opened")
    return site


def resync_everything(actor, *, request=None) -> SyncEvent:
    with transaction.atomic():
        event = sync.emit("site", "", "site.resync", "Resync everything")
        record("content.resynced", request=request, actor=actor, summary="Resynced the website")
    return event


def retry_event(event: SyncEvent, actor, *, request=None) -> bool:
    record(
        "content.sync_retried",
        request=request,
        actor=actor,
        entity_type="content_sync.syncevent",
        entity_id=str(event.pk),
        summary=event.title or event.action,
    )
    return sync.retry(event)


def update_insights_copy(
    *, heading: str, intro: str, editorial_note: str, actor, request=None
) -> SiteSettings:
    errors = {}
    values = {"heading": heading.strip(), "intro": intro.strip(), "editorial_note": editorial_note.strip()}
    for name, limit in (("heading", 200), ("intro", 500), ("editorial_note", 1000)):
        if not values[name]:
            errors[name] = "Enter a value."
        elif len(values[name]) > limit:
            errors[name] = f"Must be {limit} characters or fewer."
    if errors:
        raise ValidationError(errors)
    with transaction.atomic():
        site = SiteSettings.objects.select_for_update().get(pk=SiteSettings.load().pk)
        site.insights_heading = values["heading"]
        site.insights_intro = values["intro"]
        site.insights_editorial_note = values["editorial_note"]
        site.updated_at = timezone.now()
        site.updated_by = actor
        site.save()
        record(
            "content.insights_copy_updated",
            request=request,
            actor=actor,
            entity=site,
            summary="Insights page copy",
        )
        # The copy is served by site-state (tag "site"); every Insights read carries "insights".
        sync.emit("site", "", "site.updated", "Insights page copy")
    return site


def update_section(key: str, data: dict, *, actor, request=None) -> SiteSection:
    config = sections.clean(key, data)
    with transaction.atomic():
        section, _ = SiteSection.objects.select_for_update().get_or_create(key=key)
        section.config = config
        section.updated_at = timezone.now()
        section.updated_by = actor
        section.save()
        record(
            "content.home_section_updated",
            request=request,
            actor=actor,
            entity=section,
            summary=section.get_key_display(),
        )
        sync.emit("home_section", key, "home_section.updated", section.get_key_display())
    return section
