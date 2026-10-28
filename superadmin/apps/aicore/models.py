"""Metering and settings for the AI Engineering Core (CORE-06, AID-013).

``ModelExecution`` is one gateway call (with its retries): what ran, against which prompt version,
the outcome, usage and estimated cost. It never stores prompts or outputs. ``AiSettings`` is the
singleton holding the kill switch and the caps, editable by a SuperAdmin with an audit event.
"""

from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class ModelExecution(models.Model):
    class Outcome(models.TextChoices):
        SUCCESS = "success", "Success"
        INVALID_OUTPUT = "invalid_output", "Invalid output"
        TIMEOUT = "timeout", "Timeout"
        UNAVAILABLE = "unavailable", "Provider unavailable"
        REJECTED = "rejected", "Rejected by provider"
        DISABLED = "disabled", "Disabled (kill switch)"
        LIMIT_EXCEEDED = "limit_exceeded", "Limit reached"

    execution_id = models.UUIDField(unique=True)
    workflow = models.CharField(max_length=80)
    run_ref = models.CharField(max_length=40, blank=True, db_index=True)
    prompt_id = models.CharField(max_length=80)
    prompt_version = models.PositiveIntegerField()
    prompt_hash = models.CharField(max_length=64)
    provider = models.CharField(max_length=40)
    model = models.CharField(max_length=100)
    outcome = models.CharField(max_length=20, choices=Outcome.choices)
    attempts = models.PositiveSmallIntegerField(default=0)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    cost_gbp = models.DecimalField(max_digits=12, decimal_places=6, default=Decimal("0"))
    latency_ms = models.PositiveIntegerField(default=0)
    error_category = models.CharField(max_length=40, blank=True)
    simulated = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.execution_id} {self.prompt_id}@{self.prompt_version} {self.outcome}"


class AiSettings(models.Model):
    """Singleton (pk=1). ``AI_DATA_DISABLED=true`` in the environment overrides ``enabled``."""

    enabled = models.BooleanField(
        default=True,
        help_text="Kill switch. Off blocks every demonstrator run and every model call.",
    )
    model_path_enabled = models.BooleanField(
        default=False,
        help_text="Send statement lines the parser cannot read to the live model provider. "
        "Needs AI_DATA_LLM_API_KEY in the environment.",
    )
    brief_assist_enabled = models.BooleanField(
        default=False,
        verbose_name="Website brief assist",
        help_text="Let the website's guided brief ask the Super Admin for suggested questions and a draft "
        "brief (signed requests only). Off by default. Also needs the kill switch on and a model key.",
    )
    daily_run_cap = models.PositiveIntegerField(
        default=20, validators=[MaxValueValidator(1000)], help_text="Live model runs per day (Europe/London)."
    )
    monthly_budget_gbp = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("10.00"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("1000"))],
        help_text="Estimated model spend allowed per calendar month.",
    )
    max_calls_per_run = models.PositiveSmallIntegerField(
        default=6,
        validators=[MinValueValidator(0), MaxValueValidator(20)],
        help_text="Model calls one run may make, retries included.",
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        verbose_name = "AI settings"
        verbose_name_plural = "AI settings"

    def __str__(self):
        return "AI settings"

    @classmethod
    def load(cls) -> "AiSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
