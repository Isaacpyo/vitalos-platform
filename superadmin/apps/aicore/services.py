"""Django side of the AI core: settings, the live provider, metering storage and the gateway factory.

Every model call in the Super Admin goes through ``build_gateway``: it wires the kill switch (the
``AI_DATA_DISABLED`` environment variable overrides the database switch), the caps from
``AiSettings``, the usage ledger read from ``ModelExecution`` and the recorder that stores each
execution. The API key is read from settings at call time and never stored, logged or rendered.
"""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

from apps.audit.services import record

from .core.gateway import GatewayResult, ModelGateway
from .core.limits import ExecutionLimits, LimitGuard
from .core.providers import ModelProvider, OpenAICompatibleProvider
from .models import AiSettings, ModelExecution


def env_disabled() -> bool:
    return bool(getattr(settings, "AI_DATA_DISABLED", False))


def is_enabled(ai: AiSettings | None = None) -> bool:
    """The kill switch: false when the environment disables AI & Data or the setting is off."""
    if env_disabled():
        return False
    return (ai or AiSettings.load()).enabled


def limits(ai: AiSettings | None = None) -> ExecutionLimits:
    ai = ai or AiSettings.load()
    return ExecutionLimits(
        max_calls_per_run=ai.max_calls_per_run,
        daily_run_cap=ai.daily_run_cap,
        monthly_budget_gbp=ai.monthly_budget_gbp,
    )


def _month_start():
    now = timezone.localtime()
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _day_start():
    return timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)


class DbUsage:
    """Usage ledger read from ``ModelExecution`` (Europe/London calendar day and month).

    Spend counts every execution; the daily cap counts runs that made at least one live (not
    simulated) provider call.
    """

    def spent_this_month_gbp(self) -> Decimal:
        total = ModelExecution.objects.filter(created_at__gte=_month_start()).aggregate(total=Sum("cost_gbp"))
        return total["total"] or Decimal("0")

    def model_runs_today(self) -> int:
        return (
            ModelExecution.objects.filter(created_at__gte=_day_start(), simulated=False, attempts__gt=0)
            .exclude(run_ref="")
            .values("run_ref")
            .distinct()
            .count()
        )


def record_execution(result: GatewayResult) -> ModelExecution:
    return ModelExecution.objects.create(
        execution_id=result.execution_id,
        workflow=result.workflow[:80],
        run_ref=result.run_ref[:40],
        prompt_id=result.prompt_id,
        prompt_version=result.prompt_version,
        prompt_hash=result.prompt_hash,
        provider=result.provider[:40],
        model=result.model[:100],
        outcome=result.outcome,
        attempts=result.attempts,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        cost_gbp=result.cost_gbp,
        latency_ms=result.latency_ms,
        error_category=result.error_category[:40],
        simulated=result.simulated,
    )


def live_provider_status() -> tuple[ModelProvider | None, str]:
    """The configured live provider, or (None, why it is unavailable). Never reveals the key."""
    key = getattr(settings, "AI_DATA_LLM_API_KEY", "")
    base_url = getattr(settings, "AI_DATA_LLM_BASE_URL", "")
    model = getattr(settings, "AI_DATA_LLM_MODEL", "")
    if not key:
        return (
            None,
            "No model API key is configured (AI_DATA_LLM_API_KEY), so the live model path is unavailable.",
        )
    if not base_url or not model:
        return None, "AI_DATA_LLM_BASE_URL and AI_DATA_LLM_MODEL must both be set for the live model path."
    try:
        return OpenAICompatibleProvider(base_url=base_url, model=model, api_key=key), ""
    except ValueError as error:
        return None, f"The live model configuration is invalid: {error}"


def build_gateway(provider: ModelProvider, ai: AiSettings | None = None, **kwargs) -> ModelGateway:
    ai = ai or AiSettings.load()
    guard = LimitGuard(limits(ai), DbUsage(), enabled=lambda: is_enabled())
    return ModelGateway(provider, guard, recorders=[record_execution], **kwargs)


SETTINGS_FIELDS = (
    "enabled",
    "model_path_enabled",
    "daily_run_cap",
    "monthly_budget_gbp",
    "max_calls_per_run",
)


def update_settings(ai: AiSettings, *, request, changes: dict) -> list[str]:
    """Apply ``changes`` and write one audit event naming the changed fields (values are not secret)."""
    changed = []
    before = {}
    for name in SETTINGS_FIELDS:
        if name in changes and getattr(ai, name) != changes[name]:
            before[name] = str(getattr(ai, name))
            setattr(ai, name, changes[name])
            changed.append(name)
    if not changed:
        return []
    ai.updated_by = request.user
    ai.save()
    record(
        "aicore.settings_changed",
        request=request,
        entity=ai,
        summary="Changed AI & Data settings: " + ", ".join(changed),
        before=before,
        after={name: str(getattr(ai, name)) for name in changed},
    )
    return changed


def usage_summary() -> dict:
    usage = DbUsage()
    ai = AiSettings.load()
    return {
        "spent_month_gbp": usage.spent_this_month_gbp(),
        "runs_today": usage.model_runs_today(),
        "executions_month": ModelExecution.objects.filter(created_at__gte=_month_start()).count(),
        "budget_gbp": ai.monthly_budget_gbp,
        "daily_cap": ai.daily_run_cap,
    }
