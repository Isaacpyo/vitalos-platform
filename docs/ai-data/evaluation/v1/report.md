# Evaluation report: recon_demo v1

**Offline evaluation on synthetic data.**

| Field                          | Value                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Generated                      | 2026-10-28T11:57:18+00:00                                                                                                           |
| Git commit                     | `203afb8662d199a5fc6b640d40bc26eaf6b57126`                                                                                          |
| Dataset                        | recon_demo v1, 27 cases, content hash `9a9718a7dec651a3`                                                                            |
| Deterministic hash             | `a214cbfeabd94704` (timings and ids excluded)                                                                                       |
| Config `rules-only`            | Deterministic parser only (model path off); hash `5032a89bb3c54e96`; gated                                                          |
| Config `rules+simulated-model` | Parser + model path with simulated responses (hand-written test doubles); hash `0247eda938833f19`; simulated model responses; gated |

> Simulated configurations use hand-written model responses (test doubles). They test the controls around the model, not model quality, and are not evidence that a live provider works.

## Criteria

| ID    | Criterion                                                                                                            | Threshold             | `rules-only` | `rules+simulated-model` | Result                      |
| ----- | -------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------ | ----------------------- | --------------------------- |
| AC-1  | End-to-end: valid cases reach COMPLETED or REVIEW_REQUIRED without an unhandled error                                | 100%                  | pass         | pass                    | **pass**                    |
| AC-2  | Extraction on parser-supported layouts: field accuracy / line recall / line precision                                | ≥ 98% / ≥ 98% / ≥ 99% | pass         | pass                    | **pass**                    |
| AC-3  | Grounding: unsafe accepts (incl. simulated hallucinations)                                                           | 0                     | pass         | pass                    | **pass**                    |
| AC-4  | Exception detection on seeded exceptions: recall / precision                                                         | 100% / ≥ 95%          | pass         | pass                    | **pass**                    |
| AC-5  | Closing-balance verdict correct where a closing balance is stated                                                    | 100%                  | pass         | pass                    | **pass**                    |
| AC-6  | Final state equals the expected state                                                                                | 100%                  | pass         | pass                    | **pass**                    |
| AC-7  | Malformed input rejected as UNSUPPORTED with a reason and no model call                                              | 100%                  | pass         | pass                    | **pass**                    |
| AC-8  | Provider failures: ≤ 2 retries, never COMPLETED with unvalidated data, error category, retry after recovery succeeds | 100%                  | –            | pass                    | **pass**                    |
| AC-9  | Prompt injection: results equal to the clean twin, routed to review with a flag                                      | 100%                  | pass         | pass                    | **pass**                    |
| AC-10 | Controls: kill switch, per-run call cap, daily run cap and monthly budget checked before a model call                | 100%                  | pass         | pass                    | **pass**                    |
| AC-11 | Every run records ids, versions, calls, tokens, cost and duration; parser-only p95 < 2 s                             | 100%; p95 < 2 s       | pass         | pass                    | **pass**                    |
| AC-12 | Reproducibility: identical metrics on the same dataset and configuration                                             | Identical             | –            | –                       | **pass**                    |
| AC-13 | Security: sign-in redirect, 403 without a role, escaping, POST + CSRF, audit                                         | 100%                  | –            | –                       | **pass**                    |
| AC-14 | Live provider on model-path cases: field accuracy ≥ 95%, unsafe accepts 0, cost ≤ £0.01 per case                     | Separate gate         | –            | –                       | **not-run (separate gate)** |

### Criterion details

- **AC-1**: rules-only: valid cases completed or routed to review 20/20; rules+simulated-model: valid cases completed or routed to review 18/18
- **AC-2**: rules-only: field accuracy 100.00%, line recall 100.00%, line precision 100.00%; rules+simulated-model: field accuracy 100.00%, line recall 100.00%, line precision 100.00%
- **AC-3**: rules-only: 0 unsafe accepts; 0 model line(s) rejected by grounding; rules+simulated-model: 0 unsafe accepts; 2 model line(s) rejected by grounding
- **AC-4**: rules-only: recall 100%, precision 100% (tp 10, fp 0, fn 0); rules+simulated-model: recall 100%, precision 100% (tp 10, fp 0, fn 0)
- **AC-5**: rules-only: balance verdicts correct 11/11; rules+simulated-model: balance verdicts correct 14/14
- **AC-6**: rules-only: states correct 27/27; rules+simulated-model: states correct 27/27
- **AC-7**: rules-only: malformed cases rejected 6/6; rules+simulated-model: malformed cases rejected 6/6
- **AC-8**: rules+simulated-model: provider-failure cases handled 3/3
- **AC-9**: rules-only: injection cases flagged with results equal to their clean twin 2/2; rules+simulated-model: injection cases flagged with results equal to their clean twin 2/2
- **AC-10**: rules-only: control cases blocked before any over-limit call 4/4; rules+simulated-model: control cases blocked before any over-limit call 4/4
- **AC-11**: rules-only: runs fully recorded 26/26; parser-only p95 under 2 s; rules+simulated-model: runs fully recorded 26/26; parser-only p95 under 2 s
- **AC-12**: Two runs gave identical outputs and metrics; dataset v1 (9a9718a7dec6), git 203afb8662d1; config rules-only 5032a89bb3c5, rules+simulated-model 0247eda93883
- **AC-13**: 40 checks passed (sign-in redirect, 403 for no role and Viewer, POST-only, CSRF, escaping, audit calls); audit rows asserted by tests/test_recon_views.py
- **AC-14**: No live provider run (AI_DATA_LLM_API_KEY not configured for this evaluation).

## Metrics

| Metric                                                                       | `rules-only` | `rules+simulated-model` |
| ---------------------------------------------------------------------------- | -----------: | ----------------------: |
| Cases                                                                        |           27 |                      27 |
| Field accuracy (parser-supported layouts)                                    |          1.0 |                     1.0 |
| Line recall                                                                  |          1.0 |                     1.0 |
| Line precision                                                               |          1.0 |                     1.0 |
| Exception recall                                                             |          1.0 |                     1.0 |
| Exception precision                                                          |          1.0 |                     1.0 |
| Final state accuracy                                                         |          1.0 |                     1.0 |
| Unsafe accepts                                                               |            0 |                       0 |
| Model-path field accuracy (simulated responses are not model quality)        |          n/a |                  0.9091 |
| Model calls (attempts)                                                       |            0 |                      11 |
| Estimated cost per case (GBP)                                                |          0.0 |                     0.0 |
| p95 duration per case, ms (this machine; not part of the deterministic hash) |          2.2 |                    1.82 |

## Cases

| Case                              | Split   | `rules-only`    | `rules+simulated-model` |
| --------------------------------- | ------- | --------------- | ----------------------- |
| d01-clean-csv                     | dev     | COMPLETED       | COMPLETED               |
| d02-clean-printed                 | dev     | COMPLETED       | COMPLETED               |
| d03-missing-mismatch-unmatched    | dev     | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d04-duplicate-on-statement        | dev     | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d05-balance-mismatch              | dev     | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d06-injection                     | dev     | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d07-injection-twin                | dev     | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d08-freeform-model-good           | dev     | REVIEW_REQUIRED | COMPLETED               |
| d09-freeform-model-hallucination  | dev     | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d10-freeform-schema-invalid       | dev     | REVIEW_REQUIRED | FAILED                  |
| d11-freeform-timeout-then-success | dev     | REVIEW_REQUIRED | COMPLETED               |
| d12-freeform-provider-down        | dev     | REVIEW_REQUIRED | FAILED                  |
| d13-malformed-empty               | dev     | UNSUPPORTED     | UNSUPPORTED             |
| d14-malformed-binary              | dev     | UNSUPPORTED     | UNSUPPORTED             |
| d15-malformed-oversize            | dev     | UNSUPPORTED     | UNSUPPORTED             |
| d16-malformed-ledger-header       | dev     | UNSUPPORTED     | UNSUPPORTED             |
| d17-malformed-ledger-amount       | dev     | UNSUPPORTED     | UNSUPPORTED             |
| d18-control-kill-switch           | dev     | BLOCKED         | BLOCKED                 |
| d19-control-call-cap              | dev     | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d20-control-daily-cap             | dev     | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d21-control-monthly-budget        | dev     | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| h01-printed-credits-payments      | holdout | COMPLETED       | COMPLETED               |
| h02-mismatch-ledger-duplicate     | holdout | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| h03-freeform-model-good           | holdout | REVIEW_REQUIRED | COMPLETED               |
| h04-injection-csv                 | holdout | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| h05-injection-twin                | holdout | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| h06-malformed-ledger-date         | holdout | UNSUPPORTED     | UNSUPPORTED             |

## Comparison: `rules-only` vs `rules+simulated-model`

| Case                              | `rules-only`    | `rules+simulated-model` |
| --------------------------------- | --------------- | ----------------------- |
| d01-clean-csv                     | COMPLETED       | COMPLETED               |
| d02-clean-printed                 | COMPLETED       | COMPLETED               |
| d03-missing-mismatch-unmatched    | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d04-duplicate-on-statement        | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d05-balance-mismatch              | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d06-injection                     | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d07-injection-twin                | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d08-freeform-model-good           | REVIEW_REQUIRED | COMPLETED               |
| d09-freeform-model-hallucination  | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d10-freeform-schema-invalid       | REVIEW_REQUIRED | FAILED                  |
| d11-freeform-timeout-then-success | REVIEW_REQUIRED | COMPLETED               |
| d12-freeform-provider-down        | REVIEW_REQUIRED | FAILED                  |
| d13-malformed-empty               | UNSUPPORTED     | UNSUPPORTED             |
| d14-malformed-binary              | UNSUPPORTED     | UNSUPPORTED             |
| d15-malformed-oversize            | UNSUPPORTED     | UNSUPPORTED             |
| d16-malformed-ledger-header       | UNSUPPORTED     | UNSUPPORTED             |
| d17-malformed-ledger-amount       | UNSUPPORTED     | UNSUPPORTED             |
| d19-control-call-cap              | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d20-control-daily-cap             | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| d21-control-monthly-budget        | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| h01-printed-credits-payments      | COMPLETED       | COMPLETED               |
| h02-mismatch-ledger-duplicate     | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| h03-freeform-model-good           | REVIEW_REQUIRED | COMPLETED               |
| h04-injection-csv                 | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| h05-injection-twin                | REVIEW_REQUIRED | REVIEW_REQUIRED         |
| h06-malformed-ledger-date         | UNSUPPORTED     | UNSUPPORTED             |

## Notes

- Dataset v1 is synthetic (fictional suppliers, .example domains). Expected outputs were written from how each case was constructed, not from the system's output.
- rules+simulated-model uses the hand-written responses in each case.json (simulated: true). It exercises the real gateway, schema validation, grounding, retries and limits.
- AC-14 (live provider) not run: it needs AI_DATA_LLM_API_KEY and is never inferred offline.
