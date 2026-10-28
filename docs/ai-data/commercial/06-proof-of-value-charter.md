# 06 — AI Proof-of-Value charter (Template B)

Status: draft v0.1, 28 Oct 2026 · Supports: VAD-005, VAD-012, VAD-014 · FDE-03 Assess → FDE-05 Design

_Agree the charter with the customer sponsor before writing the proposal for an AI Proof of Value. It becomes the scope annex of the SOW ([08](08-statement-of-work-template.md)). A proof of value tests the critical part of a workflow; it does not pretend to be production ready. Store the filled-in charter in the Super Admin, never in this repository._

---

# AI Proof-of-Value Charter

| Field                         | Value                   |
| ----------------------------- | ----------------------- |
| Client                        | [organisation]          |
| Engagement ID                 | [ID]                    |
| Commercial sponsor (customer) | [name, role]            |
| Engineering owner (Vitalos)   | [name]                  |
| Go/No-Go decision owner       | [name, role — customer] |
| Version / date                | v[n] · [date]           |

## 1. Hypotheses

| Item                 | Statement                                                                                                | _Guidance_                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Business hypothesis  | [If we …, then [metric] improves from [baseline] to [target], worth [£ / hours] per month.]              | _Use the baseline from the problem brief. State cash vs capacity separately._ |
| Technical hypothesis | [A [deterministic parser + model for variable layouts] can [extract/match] with [metric ≥ x] on [data].] | _Say what is deterministic and what uses a model._                            |

## 2. Scope

| Item                   | Detail                                                                          |
| ---------------------- | ------------------------------------------------------------------------------- |
| Defined workflow       | [start → end, one workflow]                                                     |
| Included functionality | [bullets]                                                                       |
| Explicit exclusions    | [production deployment; writing to customer systems; user accounts; support; …] |
| Required integrations  | [none — file exports only / list]                                               |
| Environment            | [Vitalos-controlled environment; region; who can access]                        |

## 3. Data

| Item                   | Detail                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Approved test data     | [description, volume, period]                                                        |
| How it is provided     | [approved route from 09 — never informal chat or personal email]                     |
| Personal data          | [categories or "none"; minimisation applied]                                         |
| Model provider(s) used | [provider, assessed in 10 §7; or "deterministic only"]                               |
| Retention and deletion | [delete within [n] days of the go/no-go decision unless agreed otherwise in writing] |
| Labelling              | [who labels expected results; how disagreements are resolved]                        |

## 4. Responsibilities

| Customer                                             | Vitalos                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| Provide authorised, representative samples by [date] | Build the bounded demonstration                            |
| Label expected outcomes for the held-out set         | Run the evaluation and report honestly, including failures |
| Attend review sessions on [dates]                    | Keep within the spending cap; report usage                 |
| Make the go/no-go decision by [date]                 | Delete data per §3                                         |

## 5. Measures and acceptance

| Metric                                 | Baseline   | Target / threshold | How measured              |
| -------------------------------------- | ---------- | ------------------ | ------------------------- |
| [e.g. field-level extraction accuracy] | n/a        | [≥ x%]             | [held-out set of n items] |
| [e.g. exception recall]                | [ ]        | [ ]                | [ ]                       |
| [e.g. unsafe accepts]                  | n/a        | 0                  | [grounding check]         |
| [e.g. human-review rate]               | [ ]        | [≤ x%]             | [ ]                       |
| [e.g. minutes per item, with review]   | [baseline] | [target]           | [timed sample]            |
| Cost per task                          | n/a        | [≤ £x]             | [metered usage]           |

_Targeted operational improvement: [one sentence]. There is no universal accuracy number; agree thresholds that matter for this workflow. Full plan: [11](11-evaluation-plan-template.md)._

## 6. Risk and security assumptions

- Risk class: [Low / Moderate / High] — from [10](10-security-and-data-processing-checklist.md); high-risk work is not taken on as a proof of value without explicit acceptance.
- [Assumption, e.g. no customer system credentials are needed]
- [Assumption, e.g. outputs are reviewed by a person before any use]

## 7. Commercials and timeline

| Item                     | Detail                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Fee                      | [£ amount] — _proposed list price "from £1,500" is a proposed assumption, configured in the Super Admin; quote from the cost estimate_ |
| Third-party spending cap | [£ cap for model/API and hosting; what happens when reached: pause and ask]                                                            |
| Payment                  | [as agreed, e.g. 50% on signature / 50% on report]                                                                                     |
| Milestones               | [kick-off · data received · build complete · evaluation · decision — dates]                                                            |
| Acceptance method        | [evaluation report delivered and reviewed in a session; sponsor records decision]                                                      |

## 8. Go / No-Go

| Outcome | Condition                                                      | Next step                                                      |
| ------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| Go      | Thresholds met; value case holds; risks acceptable             | Production proposal (Offer 3)                                  |
| Change  | Partly met; a narrower scope or different approach is credible | Change request or new charter                                  |
| No-Go   | Thresholds not met, or value case does not hold                | Close; record learning in [17](17-engagement-retrospective.md) |

Decision: [Go / Change / No-Go] · Decided by [name, role] · Date [ ] · Evidence [report reference]
