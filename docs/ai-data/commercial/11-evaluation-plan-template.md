# 11 — AI evaluation plan (Template E)

Status: draft v0.1, 28 Oct 2026 · Supports: VAD-009, VAD-014, VAD-015 · FDE-05 Design → FDE-07 Evaluate

_Write the evaluation plan **before** building, and fix the thresholds before any result is known; change a threshold only by a dated revision with the reason. A worked example is the demonstrator's criteria: [engineering/demonstrator-acceptance.md](../engineering/demonstrator-acceptance.md). A plausible model answer is not a validated business outcome; there is no universal accuracy number — set thresholds that matter for this workflow._

---

# AI Evaluation Plan

| Field                     | Value                                             |
| ------------------------- | ------------------------------------------------- |
| Use case                  | [workflow, one sentence]                          |
| Engagement ID             | [ID]                                              |
| Workflow owner (customer) | [name, role]                                      |
| Evaluator / approver      | [Vitalos technical owner] / [customer acceptor]   |
| Model / prompt version    | [provider, model id, prompt version, config hash] |
| Dataset version           | [v1 — location in the engagement's private store] |
| Approved data source      | [source; permission reference from 09]            |
| Plan version / date       | v[n] · [date]                                     |

## 1. Business acceptance thresholds

| ID   | Metric               | Threshold | Why this level                   | Release blocker? |
| ---- | -------------------- | --------- | -------------------------------- | ---------------- |
| M1   | [metric 1]           | [ ]       | [business consequence of misses] | [Y/N]            |
| M2   | [metric 2]           | [ ]       | [ ]                              | [ ]              |
| M3   | [metric 3]           | [ ]       | [ ]                              | [ ]              |
| LAT  | Latency target (p95) | [ ] s     | [ ]                              | [ ]              |
| COST | Cost-per-task limit  | £[ ]      | [ ]                              | [ ]              |

_Choose from the menu in §5. Separate offline gates from live-provider gates; an offline result with simulated responses never proves that a live provider works._

## 2. Human review and fallback

| Outcome (blueprint §12.5)     | Trigger in this workflow                              | What happens                                  |
| ----------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| Validated success             | [e.g. all checks pass, nothing uncertain]             | [result accepted; still auditable]            |
| Review required               | [e.g. any exception, ungrounded field, low agreement] | [routed to [role] with reasons]               |
| Unsupported request           | [e.g. wrong file type, out-of-scope document]         | [rejected with a clear reason, no model call] |
| Recoverable technical failure | [e.g. provider timeout]                               | [retry at most [n] times, then review/failed] |
| Permanent failure             | [e.g. repeated schema-invalid output]                 | [clear error; remediation route]              |

A model-generated confidence number is not treated as calibrated unless this plan tests it.

## 3. Dataset

- [ ] From an authorised source (09 §6); minimum personal data.
- [ ] Normal cases: [n]. Difficult edge cases: [n]. Adversarial/malformed: [n].
- [ ] Representative of the customer's real workflow (layouts, volumes, exception rates).
- [ ] Versioned inputs and expected outputs; changes create a new version.
- [ ] Development set and held-out set separated; thresholds judged on held-out only.
- [ ] Labelling by [who]; disagreements resolved by [who]; disagreements recorded.
- [ ] Each case traceable to the business outcome it tests.

## 4. Known adversarial and failure cases

| Case                                    | Expected behaviour                                  |
| --------------------------------------- | --------------------------------------------------- |
| Instruction-like text inside a document | Results unchanged vs clean twin; flagged for review |
| Malformed or empty input                | Rejected as unsupported; no model call              |
| Provider timeout / 5xx / invalid JSON   | Bounded retries; never accepted unvalidated         |
| [workflow-specific case]                | [ ]                                                 |

## 5. Metric menu (blueprint §12.2)

Pick what fits; no single score decides safety or usefulness.

- Exact-match correctness · field-level extraction accuracy · classification precision/recall
- Task completion and business-rule satisfaction · factual grounding and source validity
- Exception detection (recall and precision) · rate and severity of unsafe/invalid actions
- Human-review rate · end-to-end and p95 latency · cost per successful task
- Robustness to malformed input · prompt-injection resistance · failure handling under provider/network errors
- False-positive vs false-negative consequences (say which is worse here) · operational value vs baseline

## 6. Regression procedure

- Re-run the full held-out set when the model, prompt, workflow rules or data source changes (risk-proportionate).
- Same dataset version + configuration must give identical metrics (timings excluded); the report names dataset version, configuration hash and code version.
- Compare against the previous accepted run; any blocker metric worse than threshold fails the release.

## 7. Release blocker conditions (blueprint §12.4)

The feature does not ship if any is true:

- [ ] A contracted quality threshold is missed.
- [ ] Material failure modes are not understood.
- [ ] Relevant security tests fail.
- [ ] Review or fallback paths do not work.
- [ ] Operating cost is unmeasured or unbounded.
- [ ] A consequential action lacks an approval boundary.
- [ ] Business UAT has not passed.
- [ ] The technical owner has not authorised the release.
- [ ] The feature cannot be rolled back or disabled.

## 8. Results (fill after running)

| Run | Date | Dataset / config | M1  | M2  | M3  | p95 | Cost/task | Pass? | Report link (private) |
| --- | ---- | ---------------- | --- | --- | --- | --- | --------- | ----- | --------------------- |
|     |      |                  |     |     |     |     |           |       |                       |

Approved by: [evaluator, date] · [customer acceptor, date]

## Revisions

| Date | Change | Reason | Made before results were known? |
| ---- | ------ | ------ | ------------------------------- |
|      |        |        |                                 |
