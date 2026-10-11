"""Shared governance fields for every architecture record."""

from django.conf import settings
from django.db import models
from django.utils import timezone
from simple_history.models import HistoricalRecords


class Classification(models.TextChoices):
    PUBLIC = "public", "Public"
    INTERNAL = "internal", "Internal"
    CONFIDENTIAL = "confidential", "Confidential"
    RESTRICTED = "restricted", "Restricted"


class BusinessMode(models.TextChoices):
    ADVISE = "ADVISE", "Advise"
    BUILD = "BUILD", "Build"
    OPERATE = "OPERATE", "Operate"
    CREATE = "CREATE", "Create"


class GovernedQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_archived=False)

    def archived(self):
        return self.filter(is_archived=True)


class GovernedModel(models.Model):
    """Audit, archive and classification fields plus full change history.

    Records are archived rather than deleted in the application; hard deletes are reserved for
    the superuser-only Django admin.
    """

    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        editable=False,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        editable=False,
    )
    is_archived = models.BooleanField(default=False, db_index=True, editable=False)
    archived_at = models.DateTimeField(null=True, blank=True, editable=False)
    classification = models.CharField(
        max_length=16, choices=Classification.choices, default=Classification.INTERNAL
    )

    history = HistoricalRecords(inherit=True)
    objects = GovernedQuerySet.as_manager()

    #: Lookup from this model to its ServiceLine, used for access and visibility rules.
    service_line_path: str | None = None

    class Meta:
        abstract = True
