"""The workspace's one door to a model: availability, provider choice and a gateway call.

Every call goes through ``apps.aicore.services.build_gateway`` (kill switch, per-run, daily and monthly
caps, metering, schema validation). Nothing here calls a provider directly. The live provider is used
only when the kill switch is on, "Live model path" is on in AI settings and a key is configured; a
local simulated provider exists for development only (``DEBUG`` and ``AI_DATA_SIMULATED_PROVIDER``)
and for tests, and every response from it is labelled simulated.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings

from apps.aicore import services as aicore
from apps.aicore.core.gateway import GatewayResult
from apps.aicore.core.limits import RunContext
from apps.aicore.core.prompts import load_prompt
from apps.aicore.core.providers import ModelProvider
from apps.aicore.models import AiSettings

#: Tests install a provider here (a SimulatedProvider or ReplayProvider). Never set in production.
_override: ModelProvider | None = None


def set_provider_override(provider: ModelProvider | None) -> None:
    global _override
    _override = provider


@dataclass(frozen=True)
class Availability:
    available: bool
    #: "live", "simulated" or "off".
    kind: str
    reason: str = ""

    @property
    def label(self) -> str:
        if self.kind == "live":
            return "AI available"
        if self.kind == "simulated":
            return "Simulated AI (test double, not a live model)"
        return "AI unavailable"


def _simulated_allowed() -> bool:
    return bool(settings.DEBUG and getattr(settings, "AI_DATA_SIMULATED_PROVIDER", False))


def provider_and_status() -> tuple[ModelProvider | None, Availability]:
    ai = AiSettings.load()
    if aicore.env_disabled():
        return None, Availability(False, "off", "AI is switched off in the environment (AI_DATA_DISABLED).")
    if not ai.enabled:
        return None, Availability(False, "off", "The AI & Data kill switch is off.")
    if _override is not None:
        kind = "simulated" if getattr(_override, "simulated", False) else "live"
        return _override, Availability(True, kind)
    if _simulated_allowed():
        from .simulated import WorkspaceSimulatedProvider

        return WorkspaceSimulatedProvider(), Availability(True, "simulated")
    if not ai.model_path_enabled:
        return None, Availability(False, "off", "The live model path is switched off in AI settings.")
    provider, reason = aicore.live_provider_status()
    if provider is None:
        return None, Availability(False, "off", reason or "No model provider is configured.")
    return provider, Availability(True, "live")


def availability() -> Availability:
    return provider_and_status()[1]


class AiUnavailable(Exception):
    """No model can be used right now (switch, key or a cap): use the non-AI path."""


class AiFailed(Exception):
    """The model was tried and did not produce a valid answer; safe to retry."""

    def __init__(self, category: str, detail: str, result: GatewayResult):
        super().__init__(f"{category}: {detail}")
        self.category, self.detail, self.result = category, detail, result


def run_prompt(
    prompt_id: str, version: int, *, data: str, run_ref: str, workflow: str, variables: dict | None = None
) -> GatewayResult:
    """One validated structured call. Raises AiUnavailable (no call made / refused) or AiFailed."""
    provider, status = provider_and_status()
    if provider is None:
        raise AiUnavailable(status.reason)
    prompt = load_prompt(prompt_id, version)
    gateway = aicore.build_gateway(provider)
    result = gateway.run_structured(
        prompt, data=data, ctx=RunContext(workflow, run_ref), variables=variables or {}
    )
    if result.ok:
        return result
    if result.outcome in ("disabled", "limit_exceeded"):
        raise AiUnavailable(result.detail or "A limit stopped the model call.")
    raise AiFailed(result.error_category or result.outcome, result.detail, result)
