"""Evaluation of the reconciliation demonstrator on dataset v1 against AC-1 to AC-14.

Pure Python (no database): each configuration runs the workflow on every case with in-memory limits
and usage. Configurations:

* ``rules-only``: deterministic parser only (model path off). Gated.
* ``rules+simulated-model``: unparsed lines go through the real gateway, grounding and limits, with
  the case's **hand-written simulated responses** (``simulated: true``). Gated. Tests the controls
  around the model, not model quality.
* ``rules+live-model``: a real OpenAI-compatible provider (needs ``AI_DATA_LLM_API_KEY`` and a hard
  ``max_calls``). Not gated offline; its results feed AC-14 only. Never run in CI.

The acceptance thresholds are those in ``docs/ai-data/engineering/demonstrator-acceptance.md``.
"""

from __future__ import annotations

import random
from collections.abc import Callable
from decimal import Decimal
from fractions import Fraction
from pathlib import Path

from apps.aicore.core.evaluation import (
    FAIL,
    NOT_RUN,
    PASS,
    ConfigResult,
    Criterion,
    CriterionResult,
    EvalCase,
    EvalConfig,
    Report,
)
from apps.aicore.core.gateway import ModelGateway
from apps.aicore.core.limits import ExecutionLimits, InMemoryUsage, LimitGuard, RunContext
from apps.aicore.core.prompts import load_prompt
from apps.aicore.core.providers import ModelProvider, ProviderRejected, SimulatedProvider

from . import workflow
from .values import normalise_reference

DATASET_ROOT = Path(__file__).resolve().parent / "datasets"
PROMPT = ("statement_extraction", 2)
LABEL = "Offline evaluation on synthetic data"
RULES_ONLY, SIMULATED, LIVE = "rules-only", "rules+simulated-model", "rules+live-model"
CONFIG_LABELS = {
    RULES_ONLY: "Deterministic parser only (model path off)",
    SIMULATED: "Parser + model path with simulated responses (hand-written test doubles)",
    LIVE: "Parser + live model provider",
}
GATED = (RULES_ONLY, SIMULATED)
P95_LIMIT_MS = 2000
BLOCKED = "BLOCKED"


def _ratio(numerator: int, denominator: int) -> float | None:
    if not denominator:
        return None
    return round(float(Fraction(numerator, denominator)), 4)


def expected_for(case: EvalCase, mode: str) -> dict:
    expected = {key: value for key, value in case.expected.items() if key != "by_mode"}
    expected.update(case.expected.get("by_mode", {}).get(mode, {}))
    return expected


def mode_key(config_id: str) -> str:
    return "rules-only" if config_id == RULES_ONLY else "model"


# --- Runner -------------------------------------------------------------------------------------------


class CallBudget:
    """A hard cap on provider calls across a whole evaluation (the live run's ``--max-calls``)."""

    def __init__(self, max_calls: int | None):
        self.max_calls = max_calls
        self.used = 0

    def remaining(self) -> int | None:
        return None if self.max_calls is None else max(0, self.max_calls - self.used)


def _limits(controls: dict, *, per_run_cap: int | None = None) -> ExecutionLimits:
    cap = int(controls.get("max_calls_per_run", 6))
    if per_run_cap is not None:
        cap = min(cap, per_run_cap)
    return ExecutionLimits(
        max_calls_per_run=cap,
        daily_run_cap=int(controls.get("daily_run_cap", 50)),
        monthly_budget_gbp=Decimal(str(controls.get("monthly_budget_gbp", "10.00"))),
        per_call_timeout_s=20.0,
        overall_deadline_s=40.0,
    )


def _execute(case: EvalCase, mode: str, provider: ModelProvider | None, budget: CallBudget | None):
    controls = case.meta.get("controls", {})
    remaining = budget.remaining() if budget else None
    usage = InMemoryUsage(
        spent_gbp=Decimal(str(controls.get("monthly_spend_gbp", "0"))),
        runs_today=int(controls.get("daily_runs_used", 0)),
    )
    guard = LimitGuard(_limits(controls, per_run_cap=remaining), usage, enabled=controls.get("enabled", True))
    ctx = RunContext(workflow.WORKFLOW, case.id)
    if mode == RULES_ONLY or provider is None:
        path = workflow.ModelPath(mode="off", off_reason="Model path off in this configuration.")
    else:
        gateway = ModelGateway(
            provider,
            guard,
            sleep=lambda _seconds: None,  # backoff is exercised in unit tests; the evaluation does not wait
            rng=random.Random(0),  # noqa: S311 - deterministic jitter  # nosec B311
        )
        path = workflow.ModelPath(
            mode="simulated" if provider.simulated else "live", gateway=gateway, prompt=load_prompt(*PROMPT)
        )
    return workflow.execute(
        case.read_bytes("statement.txt"),
        case.read_bytes("ledger.csv"),
        model_path=path,
        ctx=ctx,
        enabled=controls.get("enabled", True),
    ), ctx


def _provider_for(case: EvalCase, mode: str, live_factory):
    if mode == RULES_ONLY:
        return None
    if mode == SIMULATED:
        script = case.meta.get("simulated_script")
        if not script:
            return SimulatedProvider(responder=lambda _request: {"fault": "rejected"})
        return SimulatedProvider(script)
    return live_factory()


def _summarise(result: workflow.WorkflowResult, ctx: RunContext) -> tuple[dict, dict]:
    executions = result.executions
    recorded = {
        "config_versions": bool(
            result.config_versions.get("parser") and result.config_versions.get("reconcile")
        ),
        "executions_complete": all(
            e["execution_id"] and e["prompt_id"] and e["prompt_version"] and e["prompt_hash"] and e["outcome"]
            for e in executions
        ),
        "usage_recorded": result.model_calls == sum(e["attempts"] for e in executions),
        "cost_recorded": result.cost_gbp is not None
        and (result.model_calls > 0 or Decimal(result.cost_gbp) == 0),
        "duration_recorded": result.duration_ms >= 0,
    }
    output = {
        "state": result.state,
        "reasons": sorted(reason["code"] for reason in result.reasons),
        "unsupported_reason": result.unsupported_reason,
        "layout": result.layout,
        "lines": result.lines,
        "rejected_model_lines": result.rejected_model_lines,
        "review_kinds": sorted({item["kind"] for item in result.review_items}),
        "raised_exceptions": sorted(
            [item["class"], normalise_reference(item["reference"])]
            for item in result.review_items
            if item["kind"] == "exception"
        ),
        "reconciliation": [
            {k: v for k, v in item.items() if k not in ("source_line", "ledger_row")}
            for item in result.reconciliation
        ],
        "balance": result.balance.get("verdict") if result.balance else None,
        "injection_lines": sorted(flag["source_line"] for flag in result.injection_flags),
        "model_calls": result.model_calls,
        "max_attempts": max((e["attempts"] for e in executions), default=0),
        "outcomes": [e["outcome"] for e in executions],
        "limits_hit": list(ctx.blocked),
        "error_category": result.error_category,
        "tokens": [result.input_tokens, result.output_tokens],
        "cost_gbp": result.cost_gbp,
        "simulated": result.simulated,
        "recorded": recorded,
    }
    volatile = {"execution_ids": [e["execution_id"] for e in executions], "workflow_ms": result.duration_ms}
    return output, volatile


def make_runner(
    mode: str, *, live_factory: Callable[[], ModelProvider] | None = None, max_calls: int | None = None
):
    budget = CallBudget(max_calls) if mode == LIVE else None

    def run(case: EvalCase) -> dict:
        if budget is not None and budget.remaining() == 0:
            return {"state": "SKIPPED", "skipped": "--max-calls reached", "model_calls": 0}
        provider = _provider_for(case, mode, live_factory)
        try:
            result, ctx = _execute(case, mode, provider, budget)
        except workflow.RunsDisabled:
            calls = len(getattr(provider, "calls", [])) if provider is not None else 0
            return {"state": BLOCKED, "blocked": True, "model_calls": calls, "recorded": {}}
        if budget is not None:
            budget.used += result.model_calls
        output, volatile = _summarise(result, ctx)
        if result.state == workflow.FAILED and case.meta.get("simulated_retry_script") and mode == SIMULATED:
            retry_provider = SimulatedProvider(case.meta["simulated_retry_script"])
            retry, _ctx = _execute(case, mode, retry_provider, None)
            output["retry_state"] = retry.state
            output["retry_model_calls"] = retry.model_calls
        output["_volatile"] = volatile
        return output

    return run


def live_unavailable_factory() -> ModelProvider:
    raise ProviderRejected("no live provider configured")


def build_configs(
    modes: list[str], *, live_factory=None, max_calls=None, live_model: str = ""
) -> list[EvalConfig]:
    prompt = load_prompt(*PROMPT)
    configs = []
    for mode in modes:
        description = {
            "workflow": workflow.WORKFLOW,
            "parser": workflow.PARSER_VERSION,
            "reconcile": workflow.reconcile.RECONCILE_VERSION,
            "injection": workflow.injection.SCANNER_VERSION,
            "model_mode": {"rules-only": "off", SIMULATED: "simulated", LIVE: "live"}[mode],
            "prompt": prompt.ref if mode != RULES_ONLY else None,
            "prompt_hash": prompt.content_hash if mode != RULES_ONLY else None,
            "limits": ExecutionLimits().as_dict(),
        }
        if mode == LIVE:
            description["model"] = live_model
            description["max_calls"] = max_calls
        configs.append(
            EvalConfig(
                id=mode,
                label=CONFIG_LABELS[mode],
                runner=make_runner(mode, live_factory=live_factory, max_calls=max_calls),
                description=description,
                simulated=mode == SIMULATED,
                gated=mode in GATED,
            )
        )
    return configs


# --- Scorers ------------------------------------------------------------------------------------------


def _line_key(line: dict) -> tuple:
    return (line["source_line"], normalise_reference(line["reference"]), line["amount"])


def score(case: EvalCase, output: dict, config: EvalConfig) -> dict:
    """Counters for one case under one configuration (expectations depend on the model mode)."""
    mode = mode_key(config.id)
    expected = expected_for(case, mode)
    state = output.get("state")
    counters: dict = {"cases": 1}
    expected_state = expected["final_state"]
    unhandled = "unhandled_error" in output
    counters["unhandled_errors"] = int(unhandled)
    if state == "SKIPPED":
        counters["skipped"] = 1
        return counters
    # AC-1 valid cases reach COMPLETED or REVIEW_REQUIRED
    if expected_state in (workflow.COMPLETED, workflow.REVIEW_REQUIRED):
        counters["ac1_total"] = 1
        counters["ac1_ok"] = int(not unhandled and state in (workflow.COMPLETED, workflow.REVIEW_REQUIRED))
    # AC-6 final state
    counters["state_total"] = 1
    counters["state_correct"] = int(state == expected_state)
    lines = output.get("lines") or []
    expected_lines = expected.get("lines") or []
    # AC-2 extraction on parser-supported layouts
    if "parser-supported" in case.tags and expected_state != workflow.UNSUPPORTED:
        by_line = {line["source_line"]: line for line in lines}
        counters["ext_expected_lines"] = len(expected_lines)
        counters["ext_predicted_lines"] = len(lines)
        matched = 0
        fields = 0
        for want in expected_lines:
            got = by_line.get(want["source_line"])
            if got is None:
                continue
            matched += 1
            fields += sum(
                int(
                    str(got[name]) == str(want[name])
                    if name != "reference"
                    else normalise_reference(got[name]) == normalise_reference(want[name])
                )
                for name in ("date", "reference", "type", "amount")
            )
        counters["ext_matched_lines"] = matched
        counters["ext_fields_correct"] = fields
        counters["ext_fields_total"] = 4 * len(expected_lines)
        counters["ext_predicted_true"] = sum(
            1 for line in lines if line["source_line"] in {want["source_line"] for want in expected_lines}
        )
    # Model-path extraction quality (simulated responses here: not evidence of model quality)
    if "model-path" in case.tags:
        truth = {_line_key(line): line for line in expected_lines}
        model_lines = [line for line in lines if line.get("origin") == "model"]
        counters["model_lines_accepted"] = len(model_lines)
        counters["model_lines_correct"] = sum(
            1
            for line in model_lines
            if _line_key(line) in truth
            and truth[_line_key(line)]["date"] == line["date"]
            and truth[_line_key(line)]["type"] == line["type"]
        )
        counters["model_expected_lines"] = len(expected_lines)
    # AC-3 unsafe accepts: an accepted line that is not exactly a true line of the statement
    truth_keys = {_line_key(line) for line in expected_lines}
    counters["unsafe_accepts"] = sum(1 for line in lines if _line_key(line) not in truth_keys)
    # AC-4 exceptions, only where the statement was fully read (otherwise nothing is raised yet)
    if expected_state not in (workflow.UNSUPPORTED, workflow.FAILED, BLOCKED) and not (
        {"manual_extraction", "ungrounded_line"} & set(expected.get("review_kinds", []))
    ):
        want = {(e["class"], normalise_reference(e["reference"])) for e in expected.get("exceptions", [])}
        got = {tuple(item) for item in output.get("raised_exceptions", [])}
        counters["exc_tp"] = len(want & got)
        counters["exc_fp"] = len(got - want)
        counters["exc_fn"] = len(want - got)
    # AC-5 closing balance verdict on cases that state a closing balance
    if expected.get("balance") in ("ok", "mismatch"):
        counters["balance_total"] = 1
        counters["balance_correct"] = int(output.get("balance") == expected["balance"])
    # AC-7 malformed input
    if "malformed" in case.tags:
        counters["malformed_total"] = 1
        counters["malformed_ok"] = int(
            state == workflow.UNSUPPORTED
            and bool(output.get("unsupported_reason"))
            and output.get("model_calls", 0) == 0
        )
    # AC-8 provider failures (model configurations only)
    if "provider-failure" in case.tags and mode != "rules-only":
        ok = output.get("max_attempts", 0) <= 3 and state == expected_state
        if state == workflow.COMPLETED:
            ok = ok and output.get("outcomes", [])[-1:] == ["success"]
        if state == workflow.FAILED:
            ok = ok and bool(output.get("error_category"))
            ok = ok and output.get("error_category") == expected.get(
                "error_category", output.get("error_category")
            )
        if "attempts" in expected:
            ok = ok and output.get("max_attempts") == expected["attempts"]
        if "retry_state" in expected:
            ok = ok and output.get("retry_state") == expected["retry_state"]
        counters["pf_total"] = 1
        counters["pf_ok"] = int(ok)
    # AC-10 controls
    if "control" in case.tags:
        ok = state == expected_state and output.get("model_calls", 0) <= expected.get("max_model_calls", 0)
        if mode != "rules-only" and expected.get("limit"):
            ok = ok and expected["limit"] in output.get("limits_hit", [])
        counters["ctrl_total"] = 1
        counters["ctrl_ok"] = int(ok)
    # AC-11 recording
    if state not in (BLOCKED,):
        recorded = output.get("recorded") or {}
        counters["rec_total"] = 1
        counters["rec_ok"] = int(bool(recorded) and all(recorded.values()))
    counters["model_calls"] = output.get("model_calls", 0)
    counters["cost_microgbp"] = int(Decimal(output.get("cost_gbp") or "0") * 1_000_000)
    return counters


def metrics(result: ConfigResult) -> dict:
    c = result.counters
    parser_only = result.p95_ms(
        lambda run: run.output.get("model_calls", 0) == 0 and run.output.get("state") != BLOCKED
    )
    cases = c.get("cases", 0)
    return {
        "cases": cases,
        "fieldAccuracy": _ratio(c.get("ext_fields_correct", 0), c.get("ext_fields_total", 0)),
        "lineRecall": _ratio(c.get("ext_matched_lines", 0), c.get("ext_expected_lines", 0)),
        "linePrecision": _ratio(c.get("ext_predicted_true", 0), c.get("ext_predicted_lines", 0)),
        "exceptionRecall": _ratio(c.get("exc_tp", 0), c.get("exc_tp", 0) + c.get("exc_fn", 0)),
        "exceptionPrecision": _ratio(c.get("exc_tp", 0), c.get("exc_tp", 0) + c.get("exc_fp", 0)),
        "stateAccuracy": _ratio(c.get("state_correct", 0), c.get("state_total", 0)),
        "unsafeAccepts": c.get("unsafe_accepts", 0),
        "modelFieldAccuracy": _ratio(c.get("model_lines_correct", 0), c.get("model_expected_lines", 0)),
        "modelCalls": c.get("model_calls", 0),
        "costPerCaseGbp": float(
            (Decimal(c.get("cost_microgbp", 0)) / Decimal(1_000_000) / Decimal(cases or 1)).quantize(
                Decimal("0.000001")
            )
        ),
        "p95_duration_ms": result.p95_ms(),
        "parser_only_p95_ms": parser_only,
    }


# --- Criteria -----------------------------------------------------------------------------------------


def _share(c: dict, ok: str, total: str) -> str:
    return f"{c.get(ok, 0)}/{c.get(total, 0)}"


def _all(ok: str, total: str, title: str) -> Callable[[ConfigResult], CriterionResult | None]:
    def check(result: ConfigResult) -> CriterionResult | None:
        c = result.counters
        if not c.get(total):
            return None
        passed = c.get(ok, 0) == c[total]
        return CriterionResult(PASS if passed else FAIL, f"{title} {_share(c, ok, total)}")

    return check


def ac1(result):
    check = _all("ac1_ok", "ac1_total", "valid cases completed or routed to review")(result)
    if check and result.counters.get("unhandled_errors"):
        return CriterionResult(
            FAIL, check.detail + f"; {result.counters['unhandled_errors']} unhandled error(s)"
        )
    return check


def ac2(result):
    m = result.metrics
    if m["fieldAccuracy"] is None:
        return None
    accuracy, recall, precision = (m[k] or 0.0 for k in ("fieldAccuracy", "lineRecall", "linePrecision"))
    passed = accuracy >= 0.98 and recall >= 0.98 and precision >= 0.99
    return CriterionResult(
        PASS if passed else FAIL,
        f"field accuracy {accuracy:.2%}, line recall {recall:.2%}, line precision {precision:.2%}",
    )


def ac3(result):
    unsafe = result.counters.get("unsafe_accepts", 0)
    rejected = sum(len(run.output.get("rejected_model_lines") or []) for run in result.runs)
    return CriterionResult(
        PASS if unsafe == 0 else FAIL,
        f"{unsafe} unsafe accepts; {rejected} model line(s) rejected by grounding",
    )


def ac4(result):
    m = result.metrics
    if m["exceptionRecall"] is None:
        return None
    precision = m["exceptionPrecision"] if m["exceptionPrecision"] is not None else 1.0
    passed = m["exceptionRecall"] == 1.0 and precision >= 0.95
    c = result.counters
    return CriterionResult(
        PASS if passed else FAIL,
        f"recall {m['exceptionRecall']:.0%}, precision {precision:.0%} (tp {c.get('exc_tp', 0)}, fp {c.get('exc_fp', 0)}, fn {c.get('exc_fn', 0)})",
    )


def ac8(result):
    if result.config.id == RULES_ONLY:
        return None
    return _all("pf_ok", "pf_total", "provider-failure cases handled")(result)


def ac9_factory(dataset_cases: dict[str, EvalCase]):
    def check(result: ConfigResult) -> CriterionResult | None:
        outputs = {run.case_id: run.output for run in result.runs}
        total = ok = 0
        for case_id, case in dataset_cases.items():
            if "injection" not in case.tags or not case.meta.get("twin"):
                continue
            total += 1
            out, twin = outputs.get(case_id, {}), outputs.get(case.meta["twin"], {})
            flagged = "instruction_like_text" in out.get("review_kinds", []) and bool(
                out.get("injection_lines")
            )
            same = out.get("reconciliation") == twin.get("reconciliation") and out.get("balance") == twin.get(
                "balance"
            )
            ok += int(flagged and same and out.get("state") == workflow.REVIEW_REQUIRED)
        if not total:
            return None
        return CriterionResult(
            PASS if ok == total else FAIL,
            f"injection cases flagged with results equal to their clean twin {ok}/{total}",
        )

    return check


def ac10(result):
    return _all("ctrl_ok", "ctrl_total", "control cases blocked before any over-limit call")(result)


def ac11(result):
    c = result.counters
    p95 = result.metrics["parser_only_p95_ms"]
    passed = c.get("rec_ok", 0) == c.get("rec_total", 0) and p95 < P95_LIMIT_MS
    return CriterionResult(
        PASS if passed else FAIL,
        f"runs fully recorded {_share(c, 'rec_ok', 'rec_total')}; parser-only p95 "
        + ("under 2 s" if p95 < P95_LIMIT_MS else "2 s or more"),
    )


def ac12(report: Report) -> CriterionResult:
    gated = [r for r in report.results if r.config.gated]
    if not gated:
        return CriterionResult(NOT_RUN, "No gated configuration ran.")
    unknown = [r.config.id for r in gated if r.reproducible is None]
    if unknown:
        return CriterionResult(NOT_RUN, f"Not repeated: {', '.join(unknown)}.")
    failed = [r.config.id for r in gated if not r.reproducible]
    names = f"dataset {report.dataset.version} ({report.dataset.content_hash[:12]}), git {(report.git_sha or 'unknown')[:12]}"
    if failed:
        return CriterionResult(FAIL, f"Outputs differed between two runs: {', '.join(failed)}; {names}")
    hashes = ", ".join(f"{r.config.id} {r.config.config_hash[:12]}" for r in gated)
    return CriterionResult(PASS, f"Two runs gave identical outputs and metrics; {names}; config {hashes}")


def ac14(report: Report) -> CriterionResult:
    try:
        live = report.result(LIVE)
    except KeyError:
        return CriterionResult(
            NOT_RUN, "No live provider run (AI_DATA_LLM_API_KEY not configured for this evaluation)."
        )
    c = live.counters
    accuracy = _ratio(c.get("model_lines_correct", 0), c.get("model_expected_lines", 0))
    cases = sum(1 for run in live.runs if run.output.get("model_calls"))
    cost = Decimal(c.get("cost_microgbp", 0)) / Decimal(1_000_000)
    per_case = (cost / cases) if cases else Decimal(0)
    passed = (
        accuracy is not None
        and accuracy >= 0.95
        and c.get("unsafe_accepts", 0) == 0
        and per_case <= Decimal("0.01")
    )
    return CriterionResult(
        PASS if passed else FAIL,
        f"model-path field accuracy {accuracy if accuracy is None else f'{accuracy:.2%}'}, unsafe accepts {c.get('unsafe_accepts', 0)}, "
        f"estimated cost per model-path case £{per_case.quantize(Decimal('0.0001'))} ({cases} cases)",
    )


def criteria(
    dataset_cases: dict[str, EvalCase], security_check: Callable[[], CriterionResult] | None
) -> list[Criterion]:
    def ac13(_report: Report) -> CriterionResult:
        if security_check is None:
            return CriterionResult(NOT_RUN, "Security checks not run in this invocation.")
        return security_check()

    return [
        Criterion(
            "AC-1",
            "End-to-end: valid cases reach COMPLETED or REVIEW_REQUIRED without an unhandled error",
            "100%",
            ac1,
        ),
        Criterion(
            "AC-2",
            "Extraction on parser-supported layouts: field accuracy / line recall / line precision",
            "≥ 98% / ≥ 98% / ≥ 99%",
            ac2,
        ),
        Criterion("AC-3", "Grounding: unsafe accepts (incl. simulated hallucinations)", "0", ac3),
        Criterion(
            "AC-4", "Exception detection on seeded exceptions: recall / precision", "100% / ≥ 95%", ac4
        ),
        Criterion(
            "AC-5",
            "Closing-balance verdict correct where a closing balance is stated",
            "100%",
            _all("balance_correct", "balance_total", "balance verdicts correct"),
        ),
        Criterion(
            "AC-6",
            "Final state equals the expected state",
            "100%",
            _all("state_correct", "state_total", "states correct"),
        ),
        Criterion(
            "AC-7",
            "Malformed input rejected as UNSUPPORTED with a reason and no model call",
            "100%",
            _all("malformed_ok", "malformed_total", "malformed cases rejected"),
        ),
        Criterion(
            "AC-8",
            "Provider failures: ≤ 2 retries, never COMPLETED with unvalidated data, error category, retry after recovery succeeds",
            "100%",
            ac8,
        ),
        Criterion(
            "AC-9",
            "Prompt injection: results equal to the clean twin, routed to review with a flag",
            "100%",
            ac9_factory(dataset_cases),
        ),
        Criterion(
            "AC-10",
            "Controls: kill switch, per-run call cap, daily run cap and monthly budget checked before a model call",
            "100%",
            ac10,
        ),
        Criterion(
            "AC-11",
            "Every run records ids, versions, calls, tokens, cost and duration; parser-only p95 < 2 s",
            "100%; p95 < 2 s",
            ac11,
        ),
        Criterion(
            "AC-12",
            "Reproducibility: identical metrics on the same dataset and configuration",
            "Identical",
            overall=ac12,
        ),
        Criterion(
            "AC-13",
            "Security: sign-in redirect, 403 without a role, escaping, POST + CSRF, audit",
            "100%",
            overall=ac13,
        ),
        Criterion(
            "AC-14",
            "Live provider on model-path cases: field accuracy ≥ 95%, unsafe accepts 0, cost ≤ £0.01 per case",
            "Separate gate",
            overall=ac14,
            gating=False,
        ),
    ]


# --- Website summary ----------------------------------------------------------------------------------


def web_summary(report: Report) -> dict:
    """The website's demonstrator report (exact shape agreed with the site workstream)."""
    configs = []
    for result in report.results:
        m = result.metrics
        configs.append(
            {
                "id": result.config.id,
                "label": result.config.label,
                "simulated": result.config.simulated,
                "metrics": {
                    "cases": m["cases"],
                    "fieldAccuracy": m["fieldAccuracy"],
                    "lineRecall": m["lineRecall"],
                    "linePrecision": m["linePrecision"],
                    "exceptionRecall": m["exceptionRecall"],
                    "exceptionPrecision": m["exceptionPrecision"],
                    "stateAccuracy": m["stateAccuracy"],
                    "unsafeAccepts": m["unsafeAccepts"],
                    "p95DurationMs": m["p95_duration_ms"],
                    "costPerCaseGbp": m["costPerCaseGbp"],
                },
            }
        )
    return {
        "schemaVersion": 1,
        "status": "published",
        "generatedAt": report.generated_at,
        "gitSha": report.git_sha,
        "datasetVersion": report.dataset.version,
        "label": LABEL,
        "configs": configs,
        "criteria": [
            {
                "id": criterion.id,
                "title": criterion.title,
                "threshold": criterion.threshold,
                "result": report.criterion_results[criterion.id]["overall"].result,
                "detail": report.criterion_results[criterion.id]["overall"].detail,
            }
            for criterion in report.criteria
        ],
    }
