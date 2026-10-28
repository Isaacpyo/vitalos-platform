"""Demonstrator records: a reconciliation run and its review items. Synthetic data only.

Statement and ledger text are kept (size-limited) so a reviewer sees the source next to every
extracted line; the new-run form requires confirming the data is synthetic or explicitly authorised.
"""

import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils import timezone

from . import workflow

TEXT_LIMIT = workflow.MAX_STATEMENT_BYTES


class ReconRun(models.Model):
    class State(models.TextChoices):
        CREATED = workflow.CREATED, "Created"
        RUNNING = workflow.RUNNING, "Running"
        COMPLETED = workflow.COMPLETED, "Completed"
        REVIEW_REQUIRED = workflow.REVIEW_REQUIRED, "Review required"
        FAILED = workflow.FAILED, "Failed"
        UNSUPPORTED = workflow.UNSUPPORTED, "Unsupported"
        CANCELLED = workflow.CANCELLED, "Cancelled"

    class ModelMode(models.TextChoices):
        OFF = "off", "Rules only"
        SIMULATED = "simulated", "Simulated model responses"
        LIVE = "live", "Live model provider"

    number = models.PositiveIntegerField(unique=True)
    run_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    run_key = models.CharField(max_length=64, db_index=True)
    state = models.CharField(max_length=20, choices=State.choices, default=State.CREATED, db_index=True)
    statement_text = models.TextField(blank=True)
    ledger_text = models.TextField(blank=True)
    input_truncated = models.BooleanField(default=False)
    sample_key = models.CharField(max_length=40, blank=True)
    model_mode = models.CharField(max_length=12, choices=ModelMode.choices, default=ModelMode.OFF)
    config_versions = models.JSONField(default=dict, blank=True)
    results = models.JSONField(default=dict, blank=True)
    reasons = models.JSONField(default=list, blank=True)
    simulated = models.BooleanField(default=False)
    model_calls = models.PositiveIntegerField(default=0)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    cost_gbp = models.DecimalField(max_digits=12, decimal_places=6, default=Decimal("0"))
    duration_ms = models.PositiveIntegerField(default=0)
    error_category = models.CharField(max_length=40, blank=True)
    error_detail = models.CharField(max_length=300, blank=True)
    retries = models.PositiveSmallIntegerField(default=0)
    timeline = models.JSONField(default=list, blank=True)
    synthetic_data_confirmed = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-number"]

    def __str__(self):
        return f"{self.ref} {self.state}"

    def get_absolute_url(self):
        return reverse("recon_demo:detail", args=[self.ref])

    @property
    def ref(self) -> str:
        return f"RUN-{self.number:04d}"

    @property
    def is_final(self) -> bool:
        return self.state in workflow.FINAL_STATES


class ReviewItem(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ACCEPTED = "accepted", "Accepted"
        CORRECTED = "corrected", "Corrected"
        REJECTED = "rejected", "Rejected"

    KIND_LABELS = {
        "exception": "Reconciliation exception",
        "manual_extraction": "Needs manual extraction",
        "ungrounded_line": "Ungrounded model line (rejected)",
        "instruction_like_text": "Instruction-like text",
        "balance_mismatch": "Closing balance mismatch",
    }

    run = models.ForeignKey(ReconRun, on_delete=models.CASCADE, related_name="review_items")
    position = models.PositiveSmallIntegerField(default=0)
    kind = models.CharField(max_length=32)
    source_lines = models.JSONField(default=list, blank=True)
    detail = models.CharField(max_length=400)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    correction = models.JSONField(default=dict, blank=True)
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    note = models.CharField(max_length=500, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["run", "position", "id"]

    def __str__(self):
        return f"{self.run.ref} #{self.position} {self.kind}"

    @property
    def kind_label(self) -> str:
        return self.KIND_LABELS.get(self.kind, self.kind)
