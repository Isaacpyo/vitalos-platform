"""Execution limits and the guard checked BEFORE every model call (CORE-01, AID-013).

The guard refuses a call when, in this order:

1. the kill switch is off (outcome ``disabled``);
2. the input is longer than ``max_input_chars``;
3. this run has already made ``max_calls_per_run`` calls (retries count as calls);
4. this is the run's first call and ``daily_run_cap`` runs have already used the model today;
4b. this is the run's first call and its workflow has a share of the daily cap (``workflow_shares``, a
   workflow prefix mapped to a percentage) that is already used: public and customer-facing workflows
   can never take the whole pool, so staff workflows keep headroom (outcome ``limit_exceeded``,
   limit ``workflow_daily_cap``);
5. the monthly budget is used up, or this call's worst-case cost would take the month over it.

A cloud budget alert is not a cap: these checks are what stops spend. ``UsageLedger`` supplies spend
and run counts (the Django layer reads them from ``ModelExecution``; tests use ``InMemoryUsage``).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Protocol


@dataclass(frozen=True)
class ExecutionLimits:
    max_input_chars: int = 20_000
    max_calls_per_run: int = 6
    per_call_timeout_s: float = 20.0
    max_retries: int = 2
    overall_deadline_s: float = 40.0
    daily_run_cap: int = 50
    monthly_budget_gbp: Decimal = Decimal("10.00")
    backoff_base_s: float = 0.5
    backoff_max_s: float = 4.0

    def __post_init__(self):
        if self.max_retries < 0 or self.max_retries > 2:
            raise ValueError("max_retries must be between 0 and 2.")
        if self.max_calls_per_run < 0 or self.daily_run_cap < 0:
            raise ValueError("Caps cannot be negative.")
        if Decimal(self.monthly_budget_gbp) < 0:
            raise ValueError("The monthly budget cannot be negative.")

    def as_dict(self) -> dict:
        return {
            "max_input_chars": self.max_input_chars,
            "max_calls_per_run": self.max_calls_per_run,
            "per_call_timeout_s": self.per_call_timeout_s,
            "max_retries": self.max_retries,
            "overall_deadline_s": self.overall_deadline_s,
            "daily_run_cap": self.daily_run_cap,
            "monthly_budget_gbp": str(self.monthly_budget_gbp),
        }


class UsageLedger(Protocol):
    def spent_this_month_gbp(self) -> Decimal: ...

    def model_runs_today(self, workflow_prefix: str = "") -> int: ...


@dataclass
class InMemoryUsage:
    """Usage for tests and the offline evaluation."""

    spent_gbp: Decimal = Decimal("0")
    runs_today: int = 0

    def spent_this_month_gbp(self) -> Decimal:
        return self.spent_gbp

    def model_runs_today(self, workflow_prefix: str = "") -> int:
        return self.runs_today  # the offline ledger does not split runs by workflow

    def add(self, cost_gbp: Decimal, *, new_run: bool) -> None:
        self.spent_gbp += Decimal(cost_gbp)
        if new_run:
            self.runs_today += 1


@dataclass
class RunContext:
    """One workflow run's view of the limits: calls so far and whether it has used the model yet."""

    workflow: str
    run_ref: str
    calls_made: int = 0
    spent_gbp: Decimal = Decimal("0")
    started_model: bool = False
    blocked: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class GuardDecision:
    allowed: bool
    outcome: str = ""  # "disabled" or "limit_exceeded" when refused
    limit: str = ""  # which control refused the call
    reason: str = ""


ALLOW = GuardDecision(allowed=True)


class LimitGuard:
    def __init__(
        self,
        limits: ExecutionLimits,
        usage: UsageLedger,
        enabled: Callable[[], bool] | bool = True,
        workflow_shares: dict[str, int] | None = None,
    ):
        self.limits = limits
        self.usage = usage
        self._enabled = enabled
        self.workflow_shares = dict(workflow_shares or {})

    def workflow_cap(self, workflow: str) -> tuple[str, int] | None:
        """(prefix, run cap today) for the workflow's share of the daily cap, or None when it has none.
        The cap rounds down, so a share can never reach the whole pool."""
        for prefix, percent in self.workflow_shares.items():
            if workflow.startswith(prefix):
                percent = min(100, max(0, int(percent)))
                return prefix, (self.limits.daily_run_cap * percent) // 100
        return None

    def enabled(self) -> bool:
        return bool(self._enabled() if callable(self._enabled) else self._enabled)

    def check_call(self, ctx: RunContext, *, input_chars: int, worst_case_gbp: Decimal) -> GuardDecision:
        limits = self.limits
        if not self.enabled():
            return GuardDecision(
                False, "disabled", "kill_switch", "AI execution is switched off (kill switch)."
            )
        if input_chars > limits.max_input_chars:
            return GuardDecision(
                False,
                "limit_exceeded",
                "max_input_chars",
                f"Input is {input_chars} characters; the limit is {limits.max_input_chars}.",
            )
        if ctx.calls_made >= limits.max_calls_per_run:
            return GuardDecision(
                False,
                "limit_exceeded",
                "max_calls_per_run",
                f"This run has made {ctx.calls_made} model calls; the per-run cap is {limits.max_calls_per_run}.",
            )
        if not ctx.started_model and self.usage.model_runs_today() >= limits.daily_run_cap:
            return GuardDecision(
                False,
                "limit_exceeded",
                "daily_run_cap",
                f"The daily cap of {limits.daily_run_cap} model runs has been reached.",
            )
        if not ctx.started_model and (share := self.workflow_cap(ctx.workflow)) is not None:
            prefix, cap = share
            if self.usage.model_runs_today(prefix) >= cap:
                return GuardDecision(
                    False,
                    "limit_exceeded",
                    "workflow_daily_cap",
                    f"The daily share of {cap} model runs for this workflow has been reached.",
                )
        spent = Decimal(self.usage.spent_this_month_gbp())
        budget = Decimal(limits.monthly_budget_gbp)
        if spent >= budget or spent + Decimal(worst_case_gbp) > budget:
            return GuardDecision(
                False,
                "limit_exceeded",
                "monthly_budget",
                f"The monthly budget of £{budget} would be exceeded (estimated spend so far £{spent}).",
            )
        return ALLOW
