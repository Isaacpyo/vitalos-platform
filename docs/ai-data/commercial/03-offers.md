# 03 — Standard offers

Status: draft v0.1, 28 Oct 2026 · Owner: Business Lead · Supports: VAD-005 · FDE-03, FDE-04 · Decisions: AID-006, AID-013

Four offers form a ladder. A customer can stop after any step; each step ends with a decision the customer can make on evidence. Offer keys match the website form and the Super Admin.

> **Prices are proposed commercial assumptions.** Every figure below is a _proposed list price, configured in the Super Admin (AI & Data › Offers); not validated market rates; not published._ The website says fees are fixed and agreed in writing before work starts. Each quote is priced from its own cost estimate ([15-cost-tracker.md](15-cost-tracker.md)); the list price is a starting point, not a commitment.

## 1. The ladder at a glance

| Offer                     | Key                         | Proposed list price _(proposed; not validated; not published)_ | Typical duration _(assumption)_    | Ends with                                        |
| ------------------------- | --------------------------- | -------------------------------------------------------------: | ---------------------------------- | ------------------------------------------------ |
| AI Opportunity Assessment | `ai-opportunity-assessment` |                                                           £350 | 1–2 weeks elapsed                  | A sound fund / don't fund decision               |
| AI Proof of Value         | `ai-proof-of-value`         |                                                    from £1,500 | 2–4 weeks elapsed                  | Evaluated bounded demo + go/no-go for production |
| Production AI Engineering | `production-ai-engineering` |                                                    from £3,000 | 4–8 weeks elapsed (scope-driven)   | Accepted production system + handover            |
| Managed AI Operations     | `managed-ai-operations`     |                                                from £250/month | Monthly, minimum term per contract | Monthly report; system kept within agreed limits |

_Prices exclude VAT; whether VAT applies depends on the business's registration status — confirm before quoting (owner decision). Durations are planning assumptions until real engagements give actuals._

## 2. Offer 1 — AI Opportunity Assessment

| Field           | Content                                                                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Purpose         | Decide whether and how **one specific operational workflow** can be improved — with AI, ordinary software, or not at all.                                                                                                                                                |
| Customer inputs | Description of the current process; access to the people who do it (one observed run where possible); systems used; volumes and time estimates; constraints; non-sensitive or approved sample information.                                                               |
| Deliverables    | Problem definition; baseline workflow map; baseline measures; value hypothesis (cash vs capacity vs revenue, separated); feasibility assessment including non-AI alternatives; security and data concerns; recommended next step with an indicative cost.                |
| Exit criteria   | The customer can decide to fund a proof of value, buy an off-the-shelf tool, change the process, or stop — and the reasoning is written down.                                                                                                                            |
| Exclusions      | Building anything; processing production data at scale; integrations; legal or regulatory advice; assessing more than one workflow (each extra workflow is a separate assessment).                                                                                       |
| Effort guide    | At the proposed £350 and a ≥40% contribution target, the effort budget is small: `max hours = (price × (1 − 0.40) − non-labour costs) ÷ loaded hourly cost` ([15](15-cost-tracker.md) §4). _The owner sets the loaded hourly cost; keep assessments tightly time-boxed._ |
| Payment         | Before work starts, where appropriate (blueprint §7.5).                                                                                                                                                                                                                  |
| What it is NOT  | Not free consulting with a sales pitch at the end. Not a promise that AI is the answer. Not a report padded to look substantial — a short honest "don't automate this" is a valid result.                                                                                |

## 3. Offer 2 — AI Proof of Value

| Field           | Content                                                                                                                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose         | Test the **critical part** of the workflow on authorised data, with measured results, **without pretending the prototype is production ready**.                                                                                                                                         |
| Customer inputs | Signed scope (charter [06](06-proof-of-value-charter.md) + SOW [08](08-statement-of-work-template.md)); authorised, representative test data via an approved route; a person to label expected results; agreed success criteria.                                                        |
| Deliverables    | Working bounded demonstration in a Vitalos-controlled environment; evaluation report against the agreed metrics ([11](11-evaluation-plan-template.md)); technical risks; projected operating cost per task and per month; implementation recommendation and indicative production cost. |
| Exit criteria   | Agreed metrics measured on a held-out set; customer sponsor makes a recorded go / no-go / change decision.                                                                                                                                                                              |
| Exclusions      | Production deployment; live integrations writing to customer systems; user accounts for customer staff (unless stated); support; guarantees of production accuracy.                                                                                                                     |
| Payment         | Proposed default: 50% on signature, 50% on delivery of the evaluation report. _Negotiable; record what was agreed._                                                                                                                                                                     |
| What it is NOT  | Not a production system. Not proof that a live model provider performs as the demo did unless the evaluation used that provider. Not an open-ended prototype that grows by email.                                                                                                       |

## 4. Offer 3 — Production AI Engineering

| Field           | Content                                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose         | Implement an approved workflow in the customer's real operating environment, with the controls needed to run it safely.                                                                                                                                                                                 |
| Customer inputs | Signed SOW; completed onboarding ([09](09-onboarding-and-data-access-checklist.md)); named sponsor and operator; business rules; access via least-privilege named identities; UAT participation.                                                                                                        |
| Deliverables    | Integrated application or service; identity and access controls; security and AI evaluation evidence; human review and fallback paths; deploy, rollback and disable procedures; monitoring; runbook and operational handover; production readiness record ([12](12-production-readiness-checklist.md)). |
| Exit criteria   | Contractual acceptance tests pass; customer UAT signed; production readiness approved with business, technical and operational approvals recorded separately.                                                                                                                                           |
| Exclusions      | Ongoing support beyond the warranty period stated in the SOW; new workflows; changes in third-party systems; data clean-up beyond the agreed sample; autonomous financial actions (payments, postings) without human approval.                                                                          |
| Qualification   | **Validate the value first.** An organisation with only a small monthly benefit may not justify even an entry-price build (see §7).                                                                                                                                                                     |
| Payment         | Proposed default **40% on signature, 40% at an agreed technical milestone, 20% on acceptance** — a negotiable starting point, subject to delivery risk and customer requirements.                                                                                                                       |
| What it is NOT  | Not an ERP replacement. Not unlimited revisions. Not a promise of zero errors. Not a transfer of Vitalos's pre-existing components unless the contract says so.                                                                                                                                         |

## 5. Offer 4 — Managed AI Operations

| Field           | Content                                                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose         | Operate, monitor, maintain and improve a deployed solution within defined service terms.                                                                                                                                      |
| Customer inputs | Accepted production system; named customer contact; agreement on coverage hours, alert routing and change approvals.                                                                                                          |
| Deliverables    | Defined support coverage; monitoring and alerting; incident procedure; monthly report ([14](14-monthly-managed-ai-report.md)); agreed maintenance; bounded improvement allowance. Tiers in [13](13-managed-service-scope.md). |
| Exit criteria   | Monthly: report delivered, incidents handled per contract. On termination: offboarding completed ([13](13-managed-service-scope.md) §8).                                                                                      |
| Exclusions      | Unlimited support; round-the-clock staffed response unless separately funded and actually staffed; new features beyond the improvement allowance; third-party subscription costs unless stated.                               |
| What it is NOT  | **Not 24/7 support.** Not an SLA unless one is written into the contract with response times Vitalos can actually meet.                                                                                                       |

## 6. Funding structure and payment

| Offer                     | Proposed default (negotiable)                                            | Notes                                                       |
| ------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| AI Opportunity Assessment | 100% before work                                                         | Short paid discovery: seek payment first where appropriate. |
| AI Proof of Value         | 50% on signature / 50% on evaluation report                              | Spending cap for third-party costs stated in the charter.   |
| Production AI Engineering | 40% on signature / 40% at agreed technical milestone / 20% on acceptance | Milestone must be objectively testable.                     |
| Managed AI Operations     | Monthly in advance                                                       | Minimum term and notice period per contract.                |

**Policy:** unfunded out-of-scope requests are not free implementation obligations. Third-party costs (model usage, hosting) are either included up to a stated cap or passed through at cost — say which in the proposal.

## 7. Value test before proposing production

Run this before recommending Offer 3. _Fictional illustration from the blueprint (§17.6), showing arithmetic, not viability._

| Input                                                  | Example                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Current manual effort                                  | 30 hours/month                                                                   |
| Expected reduction                                     | 15 hours/month                                                                   |
| Customer's loaded labour cost                          | £25/hour                                                                         |
| Released capacity                                      | 15 × £25 = **£375/month of capacity** — not cash unless the customer converts it |
| Upfront fees (assessment + PoV + production, proposed) | £350 + £1,500 + £3,000 = £4,850                                                  |
| Capacity payback, ignoring managed fees                | £4,850 ÷ £375 ≈ 13 months                                                        |

**Reading it:** a customer realising only £375/month of capacity may not justify a £4,850 upfront commitment. Either choose a higher-value workflow, standardise the build so it costs less, or say no. Record the calculation in the problem brief.

## 8. Change control

Any change to the following needs a written change request **before** work proceeds:

- Fees or payment conditions.
- Delivery dates or milestone dependencies.
- Scope, workflow or business rules.
- Integrations or data sources.
- Security or privacy posture (new data categories, new providers or subprocessors).
- Operating costs or support obligations.
- External actions the system may take.

### Change request record

| Field                                | Value                                             |
| ------------------------------------ | ------------------------------------------------- |
| Change reference                     | [CR-nnn]                                          |
| Engagement                           | [engagement ID]                                   |
| Requested by / date                  | [role] · [date]                                   |
| Description                          | [what changes]                                    |
| Reason                               | [why]                                             |
| Impact: scope / dates / fees / costs | [text] / [text] / [£ or none] / [£ or none]       |
| Impact: data, security, support      | [text — re-run the risk screen if data changes]   |
| Documents to update                  | [SOW / charter / evaluation plan / task register] |
| Decision                             | [Approved / Rejected / Deferred]                  |
| Approved by (customer) / (Vitalos)   | [name, role, date] / [name, role, date]           |

_If a request is small and in scope, record it anyway and mark "no impact". Silence is how scope creeps._
