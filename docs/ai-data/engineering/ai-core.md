# Vitalos AI Engineering Core: component interface specification

Blueprint §10.9 and §11. Version 1 (28 Oct 2026). Owner: Vitalos AI & Data engineering.

| Classification | Value                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Reuse level    | **R2** (documented with automated tests). Not R3: not yet reused in an independent engagement.                       |
| IP             | Vitalos-created reusable IP. Open-source dependencies: Django (BSD-3), jsonschema (MIT), Python stdlib.              |
| Location       | `superadmin/apps/aicore/core/` (pure Python, imports nothing from Django) + `superadmin/apps/aicore/` (Django layer) |
| Tests          | `superadmin/tests/test_aicore_gateway.py`, `test_aicore_provider_http.py`, `test_recon_eval.py`                      |
| Decisions      | AID-009 (inside the Super Admin), AID-011 (one OpenAI-compatible adapter), AID-012 (no key yet), AID-013 (caps)      |

The pure core can be mounted in another service (for example FastAPI for a client engagement) by supplying its own usage ledger, recorder and settings. Model calls in the Super Admin go only through `apps.aicore.services.build_gateway`.

## Tenant and permission context

This milestone has one tenant (Vitalos itself, synthetic data). The core takes no tenant id; the Django layer authorises on the server (SuperAdmin and ServiceLead for the demonstrator; SuperAdmin for settings). A client deployment adds the tenant to `RunContext` and `ModelExecution` before reuse (blueprint §10.5).

## CORE-01 Model gateway (`core/gateway.py`, `core/providers.py`, `core/prompts.py`)

**Purpose.** One structured model call: render a versioned prompt with untrusted data delimited, check limits, call the provider with timeouts and bounded retries, validate the output against a JSON Schema, meter it.

**Contracts.**

- `ModelProvider.complete(ModelRequest) -> ModelResponse`. Request: chat messages, temperature, max output tokens, JSON output flag, timeout, prompt ref, input hash. Response: text, model, input/output tokens, finish reason, latency, `simulated`, provenance.
- Implementations: `OpenAICompatibleProvider` (`POST {base}/chat/completions`, Bearer key, `response_format: json_object`, https only except localhost, redirects refused, 1 MB response cap), `SimulatedProvider` (hand-written scripts; every response `simulated=True`), `ReplayProvider` (recorded live responses keyed by `prompt id@version#input sha256`, with provenance provider/model/date; never invents a response), `RecordingProvider` (wraps a live provider during a live evaluation and exports a replay file).
- `PromptConfig` (`core/prompt_configs/<id>@<version>.json`): id, version, description, system, template (must contain `{data_block}`), output JSON Schema, model params. `content_hash` = sha256 of the canonical JSON; recorded on every execution. Released versions are never edited: a change is a new version. Current: `statement_extraction@1`, `@2` (the demonstrator uses `@2`).
- `ModelGateway.run_structured(prompt, data=..., ctx=RunContext) -> GatewayResult`: execution id (uuid4), workflow, run ref, prompt id/version/hash, provider, model, simulated, outcome, validated output (only on success), validation errors, attempts and per-attempt log, tokens, estimated cost GBP (Decimal), latency, error category, limit, detail.

**Error categories and outcomes.** Provider errors: `ProviderTimeout` (timeout, retryable), `ProviderUnavailable` (network, HTTP 429, 5xx; retryable), `ProviderResponseInvalid` (body not a chat completion; retryable), `ProviderRejected` (other 4xx, refused redirect, missing replay; permanent). Outcomes: `success`, `invalid_output` (schema-invalid after the extra attempt, or malformed responses exhausted), `timeout` (incl. `deadline_exceeded`), `unavailable`, `rejected`, `disabled` (kill switch), `limit_exceeded`.

**Retry, timeout, idempotency.** At most 2 retries (3 attempts), only for retryable errors; backoff `min(4 s, 0.5 s × 2^(n-1))` plus jitter up to 0.5 s; per-call timeout 20 s, capped by the remaining overall deadline of 40 s; schema-invalid output gets one more attempt. Limits are re-checked before every attempt. The gateway performs no side effects other than the provider call and the recorders, so a retry cannot duplicate a consequential action; workflow-level idempotency is the caller's run key.

**Data processing and retention.** Prompts and outputs are not stored by the core and never logged. The demonstrator stores its own synthetic input (≤ 64 KB) with the run. Provider-side retention follows the provider's API terms, which must be checked before any client data is sent (blueprint §13).

**Logs and tracing.** `aicore.gateway` logs per execution: execution id, workflow, prompt ref, outcome, attempts, tokens, cost (INFO) and per failed attempt the error category (WARNING). No prompt, output or key, ever. `redaction.redact` masks emails, phones, IBAN-like strings and long digit runs for any free text that must be logged. Request ids come from the Super Admin middleware.

## Limits and kill switch (`core/limits.py`, `apps/aicore/services.py`)

**Purpose.** Stop spend and runaway calls in the application (a cloud budget alert is not a cap).

**Contract.** `ExecutionLimits(max_input_chars, max_calls_per_run, per_call_timeout_s, max_retries ≤ 2, overall_deadline_s, daily_run_cap, monthly_budget_gbp)`; `LimitGuard(limits, usage, enabled).check_call(ctx, input_chars, worst_case_gbp) -> GuardDecision(allowed, outcome, limit, reason)`. Checked in order before every provider call: kill switch, input size, per-run calls (retries count), daily runs (first call of a run only), the workflow's share of the daily runs (first call only; see below), monthly budget (spent ≥ budget, or spent + worst case > budget; worst case = input chars ÷ 3 tokens in + max output tokens out at the model's price).

**Workflow shares (review finding M2).** Website brief assist (`aidata.brief_*`) can be triggered by anyone who reaches the website and the portal assistant (`portal.*`) by any customer member, so each is held to a percentage of `daily_run_cap`, counted from live `ModelExecution` runs of that workflow today and rounded down (guard limit `workflow_daily_cap`). Defaults: 30% each (`AI_DATA_BRIEF_ASSIST_DAILY_SHARE_PERCENT`, `AI_DATA_PORTAL_DAILY_SHARE_PERCENT`), so staff workflows always keep at least 40% of the pool. Each portal assistant answer is its own run, and a member is also throttled to `PORTAL_AI_PER_MEMBER_PER_HOUR` (10) answers an hour, after which the answer is the compiled non-AI one with a note saying the limit was reached.

**Configuration.** `AiSettings` singleton (SuperAdmin, audited `aicore.settings_changed`): `enabled` (default on), `model_path_enabled` (default off), `daily_run_cap` (20), `monthly_budget_gbp` (£10.00), `max_calls_per_run` (6). Environment: `AI_DATA_DISABLED` (overrides `enabled`), `AI_DATA_LLM_BASE_URL`, `AI_DATA_LLM_MODEL`, `AI_DATA_LLM_API_KEY` (secret; empty = live path unavailable).

## CORE-06 Metering (`apps/aicore/models.py`, `core/pricing.py`)

**Contract.** One `ModelExecution` row per gateway execution, written by the recorder whatever the outcome (refusals too): execution id, workflow, run ref, prompt id/version/hash, provider, model, outcome, attempts, tokens, cost GBP (Decimal 12,6), latency ms, error category, simulated, created_at. `DbUsage` reads spend for the calendar month and distinct live runs for the day (Europe/London).

**Pricing.** `pricing_table.json`: per 1M input/output tokens in the provider's currency, FX to GBP as a stated assumption, a "last checked / estimate" label, and a deliberately high default for unknown models. All prices are unverified estimates until a provider account exists. `simulated` costs £0.

**Retention.** Execution rows hold no content; they are kept with the Super Admin database (no separate retention job needed while they hold no personal data).

## CORE-04 Evaluation (`core/evaluation.py`)

**Purpose.** Versioned datasets, objective scoring, comparison of configurations and a release gate.

**Contracts.**

- `load_dataset(root, version)`: `<root>/<version>/<split>/<case>/` with `case.json` (id, description, tags, optional simulated script), `expected.json` and input files; content hash over every file.
- `EvalConfig(id, label, runner, description, simulated, gated)`; `config_hash` = sha256 of the description (versions, prompt hash, limits).
- Scorers `(case, output, config) -> counters`; a metrics function turns summed counters into metrics; `Criterion(id, title, threshold, per_config | overall, gating)`.
- `evaluate(...) -> Report`: runs each configuration (gated ones twice, to prove determinism), applies criteria, `gate_passed()` / `failed_criteria()`, `to_json()` (deterministic part + separate timings and volatile ids), `to_markdown(compare=(a, b))`.
- Reports name dataset version and content hash, configuration hashes, git SHA (`GITHUB_SHA` or read from `.git` without running git) and label simulated configurations everywhere.

**Errors.** An exception inside a runner is recorded as an `unhandled_error` output for that case (and fails AC-1/AC-6), never a crash of the harness.

**Tests and evaluation requirements.** The demonstrator gate (`recon_eval`) runs in CI after pytest. Tests include a deliberately broken configuration (grounding disabled, a runner that always says COMPLETED) that must fail the gate.

## Dependency and compatibility policy

- No new runtime dependency: stdlib `urllib`, `jsonschema` (already pinned), Django for the outer layer.
- `PromptConfig` versions and `ExecutionLimits` defaults are part of the contract: changing them changes the configuration hash and needs a new evaluation report.
- Dataset changes create a new version (`v2`); thresholds change only through a dated revision of the acceptance criteria.
- The provider interface stays OpenAI-compatible until a provider needs a native feature (AID-011).
