# Demonstrator: supplier statement reconciliation

Status: built and evaluated offline (28 Oct 2026). Live provider evaluation (AC-14) not run: no AI & Data model key exists yet (AID-012).

| Item                | Where                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Pages               | https://admin.vitalos.co.uk/ai-data/demonstrator/ (SuperAdmin and ServiceLead)            |
| Code                | `superadmin/apps/recon_demo/` (domain modules are plain Python), `superadmin/apps/aicore/` |
| Acceptance criteria | [demonstrator-acceptance.md](demonstrator-acceptance.md) (written before any evaluation)  |
| Dataset             | `superadmin/apps/recon_demo/datasets/v1/` (27 synthetic cases: 21 dev, 6 holdout)         |
| Latest report       | [../evaluation/v1/report.md](../evaluation/v1/report.md) (JSON alongside)                 |
| AI core spec        | [ai-core.md](ai-core.md)                                                                  |

## What it does

A bookkeeper supplies a supplier statement (text: a CSV export or a printed statement) and a purchase-ledger export (CSV) for the same supplier. The demonstrator extracts the statement lines, checks each against the source, reconciles them against the ledger and routes every exception or uncertainty to a reviewer. The split between deterministic code and the model is the point: the model only reads lines the parser cannot read, it never decides a match, and nothing it says is accepted without being traced to the source text.

```text
statement + ledger
  │ 1 input validation ── empty / binary / not UTF-8 / > 64 KB / bad ledger ──> UNSUPPORTED (no model call)
  ▼
  2 deterministic parser (statement_rules@1: CSV export, printed fixed-width) ──> lines with source line numbers
  │   + injection scan (injection_rules@1) ──> "instruction-like text" review flag
  │ unparsed lines (carry an amount, match no layout)
  ▼
  3 model path (only if on; never for flagged lines) ── AI core gateway: limits → provider → JSON Schema
  │   └─ grounding: cited line was sent, reference + amount + date printed on it, not a repeat
  │      rejected lines ──> review; provider failure after retries ──> FAILED (retryable)
  │   model path off ──> each unparsed line becomes "needs manual extraction"
  ▼
  4 reconcile@1 (Decimal): matched / amount mismatch / missing from ledger / not on statement / duplicate
  │   closing balance: opening + Σ signed lines = stated closing? (incomplete while lines are unread)
  ▼
  5 COMPLETED (nothing uncertain) or REVIEW_REQUIRED (reasons + review items: accept / correct / reject)
```

## States

`CREATED → RUNNING → COMPLETED | REVIEW_REQUIRED | FAILED | UNSUPPORTED`. `CANCELLED` is used only when the kill switch turns off between the check and the run (nothing runs).

| State           | When                                                                                                                                         | Next                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| COMPLETED       | Every line read and grounded, every line matched, balance agrees (or is not stated), no instruction-like text                                | Done                                                |
| REVIEW_REQUIRED | Any exception, unread or ungrounded line, balance mismatch, instruction-like text, or a model call refused by a control                      | Reviewer accepts, corrects or rejects each item     |
| FAILED          | A provider failure after bounded retries (timeout, unavailable, rejected, schema-invalid output). Nothing from the model is kept.            | **Retry** (same mode) or **Continue without model** |
| UNSUPPORTED     | Input rejected before any parsing or model call, with a reason                                                                               | Fix the input and start a new run                   |

Every run stores: run id (uuid4) and `RUN-nnnn` reference, idempotency key (sha256 of statement, ledger and configuration versions), configuration versions (parser, reconcile, injection scanner, model mode, prompt id@version and content hash, model), the state timeline with timestamps, results, review items, model calls, tokens, estimated cost (£0 when no model call) and duration. Model calls are also metered one row per gateway execution in `ModelExecution` (no prompt or output text). Creating, retrying, continuing and every review decision write an audit event.

**Idempotency.** Submitting identical input with the same configuration returns the existing run; "Run again" creates a new one deliberately.

## Failure model (blueprint §12.5)

| Blueprint outcome              | Demonstrator                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Validated success              | COMPLETED                                                                                     |
| Review required                | REVIEW_REQUIRED with reasons and review items                                                 |
| Unsupported request            | UNSUPPORTED with a reason, before any model call                                              |
| Recoverable technical failure  | FAILED with an error category; Retry re-runs within the same caps                             |
| Permanent failure              | FAILED with category `rejected` (auth/validation); Continue without model routes to review   |

## Controls

- **Kill switch**: `AI_DATA_DISABLED=true` in the environment, or AI settings → "AI & Data enabled" off. Blocks every run and every model call. The environment value wins.
- **Model path**: off by default (`model_path_enabled`), and unavailable without `AI_DATA_LLM_API_KEY`. A run that asks for the live path when it is unavailable runs rules-only and says why.
- **Caps checked before every provider call** (AI core guard): input size, calls per run (retries count; default 6), model runs per day (default 20, live runs only), monthly budget (default £10.00, estimated spend so far plus the call's worst case).
- **Retries**: at most 2, only for timeouts, 429/5xx and malformed provider responses; exponential backoff with jitter inside a 40 s overall deadline (20 s per call). Schema-invalid output gets one more attempt, then fails.
- **Prompt injection**: statement text goes in a delimited data block marked as untrusted; instruction-like lines are flagged for review and never sent to the model; grounding means a manipulated model still cannot add a line that is not printed on the cited line.
- **Synthetic data only**: the new-run form requires confirming the data is synthetic or explicitly authorised, and warns not to paste client data. Stored text is limited to 64 KB.
- **Simulated responses** (built-in samples only) are labelled "Simulated" on every page, report and execution row. They cost £0 and do not count towards the daily cap.

## Built-in samples

Clean CSV, clean printed, missing invoice + mismatch + unmatched ledger item, duplicate invoice, balance mismatch, prompt injection, unparsed layout (rules-only or simulated model path), simulated hallucination, and a **simulated provider failure**: three attempts (two retries) end FAILED; Retry uses the sample's recovery script and completes; Continue without model routes the lines to manual review. This shows controlled failure and recovery in production without a key.

## Evaluation

```sh
cd superadmin
# Offline gate (CI runs this after pytest): exits non-zero when any of AC-1..AC-13 fails.
python manage.py recon_eval --dataset v1 --config rules-only --config rules+simulated-model --out /tmp/eval
# Publish (commit both copies; the app copy feeds the Evaluation page, docs copy is the record):
python manage.py recon_eval --dataset v1 --config rules-only --config rules+simulated-model \
  --compare rules-only,rules+simulated-model \
  --out ../docs/ai-data/evaluation/v1 --out apps/recon_demo/reports/v1 \
  --web-report ../docs/ai-data/evaluation/v1/web-summary.json
```

`--web-report` writes the website summary (`schemaVersion: 1`): `status`, `generatedAt`, `gitSha`, `datasetVersion`, `label` ("Offline evaluation on synthetic data"), `configs[]` (`id`, `label`, `simulated`, `metrics`: `cases`, `fieldAccuracy`, `lineRecall`, `linePrecision`, `exceptionRecall`, `exceptionPrecision`, `stateAccuracy`, `unsafeAccepts`, `p95DurationMs`, `costPerCaseGbp`) and `criteria[]` (`id`, `title`, `threshold`, `result` pass/fail/not-run, `detail`). The website copy is `apps/web/src/features/ai-data/demonstrator-report.json` (copied from `docs/ai-data/evaluation/v1/web-summary.json` at integration).

Configurations: `rules-only` (gated), `rules+simulated-model` (gated; the case's hand-written responses through the real gateway, schema validation, grounding, retries and limits), `rules+live-model` (not gated offline; AC-14 only). Reproducibility (AC-12) is checked by running every gated configuration twice and comparing the deterministic part (outputs, counters, metrics; timings and execution ids excluded). AC-13 runs database-free checks (sign-in redirect, 403 for no role and Viewer, POST-only, CSRF, escaping, audit calls); the audit rows themselves are asserted in `tests/test_recon_views.py`.

### Live run (AC-14), owner step

1. Create an AI & Data key with the chosen provider (paid: needs the owner, AID-012/AID-013). Never reuse another product's key.
2. GitHub → Settings → Environments → `production`: secret `AI_DATA_LLM_API_KEY`; variables `AI_DATA_LLM_BASE_URL` (e.g. `https://api.openai.com/v1`) and `AI_DATA_LLM_MODEL` (e.g. `gpt-4o-mini`). Check the model's price in `superadmin/apps/aicore/core/pricing_table.json`.
3. Actions → "AI & Data live evaluation" → Run workflow on `main`, type `LIVE`. Hard cap: 40 provider calls (the model-path cases need about 10). The report and a replay file (`replay-recordings.json`, responses with provenance) are uploaded as an artifact kept 7 days.
4. To use the live path in the Super Admin, set the same three values in the Super Admin's production environment and switch on "Live model path" in AI settings.

## What the offline results prove, and what they do not

They show, on 27 synthetic cases:

- the parser reads the two supported layouts in the dataset correctly, and the reconciliation and balance arithmetic give the expected classes and verdicts;
- malformed input is rejected before any model call; the kill switch and every cap stop calls before they are made;
- the gateway, schema validation and grounding reject fabricated and wrong lines (simulated hallucinations), provider failures end FAILED with a category after at most two retries, and a retry after recovery completes;
- instruction-like text is flagged and changes no result (compared with a clean twin);
- the same dataset and configuration give identical results.

They do **not** show:

- that any real model extracts statement lines well: the simulated responses were written by hand to exercise the controls (AC-14 needs the live run);
- that the provider adapter works against a real provider: it is tested against a local fake HTTP server, which proves the request, error mapping and parsing code only;
- robustness on real supplier statements: the dataset is small, synthetic and was written by the same team that wrote the parser, so 100% on parser-supported layouts says the parser handles these layouts, not that it generalises. The holdout split was written at the same time as the dev split;
- anything about customer value or time saved.

The cost and latency figures are local estimates (pricing table labelled "estimate"; p95 measured on the machine that ran the report).

## Known limits and next steps

- Corrections made in the review queue are recorded but not re-reconciled automatically.
- Runs execute in the request (fine for the demonstrator's size: the gateway deadline is 40 s, gunicorn's timeout 60 s). A client deployment would use a background worker (CORE-02).
- Two layouts only; a third (PDF text) needs real samples first.
- Pricing figures are unverified estimates until a provider account exists.
