# 14 — Monthly Managed AI Operations report (Template G)

Status: draft v0.1, 28 Oct 2026 · Supports: VAD-017 · FDE-09 Operate

_Send monthly to the customer contact within [n] working days of month end. Report what was measured; write "not measured" rather than estimate. Value figures must say whether they are cash, released capacity or revenue, and how they were measured. Keep the filled-in report in the customer's private record, never in this repository._

---

# Monthly Managed AI Operations Report

| Field                        | Value                |
| ---------------------------- | -------------------- |
| Customer                     | [organisation]       |
| Service                      | [system, tier]       |
| Reporting period             | [1–30/31 Month YYYY] |
| Technical / operations owner | [name]               |
| Release(s) in service        | [identifier(s)]      |

## 1. Summary

[Three sentences: was the service healthy, what changed, what the customer needs to decide.]

## 2. Usage

| Measure           | This period | Previous period | Note          |
| ----------------- | ----------: | --------------: | ------------- |
| Workload volume   |         [ ] |             [ ] |               |
| Successful tasks  |         [ ] |             [ ] |               |
| Failed tasks      |         [ ] |             [ ] | [main causes] |
| Human review rate |        [ ]% |            [ ]% |               |

## 3. Reliability and quality

| Measure                     | This period | Target (if contracted) | Note                         |
| --------------------------- | ----------: | ---------------------- | ---------------------------- |
| Service availability        |        [ ]% | [ ]                    | [how measured]               |
| P95 latency (relevant step) |       [ ] s | [ ]                    |                              |
| AI evaluation metrics       |         [ ] | [ ]                    | [dataset version]            |
| Regression results          | [pass/fail] | —                      | [runs this period, triggers] |

## 4. Financial

| Measure                     | This period | Cap / budget | Note            |
| --------------------------- | ----------: | -----------: | --------------- |
| Model / API usage           |        £[ ] |         £[ ] | [calls, tokens] |
| Cloud and storage costs     |        £[ ] |            — |                 |
| Total direct operating cost |        £[ ] |            — |                 |
| Cost per successful task    |        £[ ] |         £[ ] |                 |

## 5. Value delivered

| Outcome measure              | Baseline | This period | Kind (cash / capacity / revenue / quality) | How measured        |
| ---------------------------- | -------: | ----------: | ------------------------------------------ | ------------------- |
| [e.g. minutes per statement] |      [ ] |         [ ] | [capacity]                                 | [timed sample of n] |
| Measured time / cost savings |        — |         [ ] | [ ]                                        | [ ]                 |

Adoption and user feedback: [who used it, how much, what they said].

## 6. Incidents and changes

| Incident ID | Severity | Summary | Root cause | Remediation | Status |
| ----------- | -------- | ------- | ---------- | ----------- | ------ |
|             |          |         |            |             |        |

Changes deployed:

| Date | Release | Change | Approved by |
| ---- | ------- | ------ | ----------- |
|      |         |        |             |

Support hours used: [n] of [allowance].

## 7. Next period

- Priority improvements: [ ]
- Risks: [ ]
- Customer decisions required: [ ]

---

_Internal (not sent): monthly contribution for this service = fee − direct operating cost − support hours × loaded hourly cost = £[ ] ([ ]%; internal threshold ≥ 60% once stabilised). Record in the Super Admin._
