# 16 — Product candidate review (Template H) and reusable-asset classification

Status: draft v0.1, 28 Oct 2026 · Owner: Business Lead / Product Owner · Supports: VAD-018, VAD-019 · FDE-10 Learn · Blueprint DEC-009, DEC-010

_Do not build products before customers fund them. A product review is triggered by repeated, independent, paid demand — not by a good idea or a finished feature. The first completed pilot alone never authorises a SaaS build. Thresholds below are Vitalos decision-policy thresholds, not market facts._

## 1. Trigger conditions (blueprint §16.3)

Start a full review only when all five are met. Record evidence for each.

| #   | Condition                                                                                     | Met? | Evidence (private references) |
| --- | --------------------------------------------------------------------------------------------- | ---- | ----------------------------- |
| T1  | **Three or more independent businesses** show the same meaningful problem                     | [ ]  | [ ]                           |
| T2  | **At least two** have paid for a relevant solution or made credible paid purchase commitments | [ ]  | [ ]                           |
| T3  | Roughly **70% or more** of intended features are truly reusable                               | [ ]  | [ ]                           |
| T4  | Customer economics stay viable after AI, infrastructure, support and acquisition costs        | [ ]  | [ ]                           |
| T5  | Vitalos has the legal right to use the relevant assets and authority to use all data          | [ ]  | [ ]                           |

If fewer than five are met, record the candidate at stage P0 or P1 and the evidence still needed.

## 2. Investment stages (blueprint §16.4)

| Stage  | Name      | Evidence required to enter                                                                         | Typical spend authorised              |
| ------ | --------- | -------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **P0** | Observe   | Consistent discovery notes of recurring pain                                                       | None                                  |
| **P1** | Validate  | Buyer interviews, willingness to pay, early commitments                                            | Founder time only                     |
| **P2** | Prototype | Testable, tightly scoped common workflow                                                           | Small, time-boxed, owner-approved     |
| **P3** | Paid Beta | Independent paying users and usage evidence                                                        | Funded by beta revenue where possible |
| **P4** | Release   | Production security, evaluation and support readiness ([12](12-production-readiness-checklist.md)) | Owner decision                        |
| **P5** | Scale     | Retention, healthy margins, repeatable acquisition                                                 | Owner decision                        |

Do not advance a stage on feature completion alone.

## 3. Weighted scoring rubric (blueprint §16.5)

`Score = Σ (factor score ÷ 5 × weight)`

| Factor                                  |  Weight | 0                              | 1                                   | 3                                                         | 5                                                         | Score   |
| --------------------------------------- | ------: | ------------------------------ | ----------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- | ------- |
| Verified willingness to pay             |      25 | No evidence                    | Verbal interest only                | One paid engagement or written commitment                 | Several independent payments or signed commitments        | [ ]     |
| Repeatability across customers          |      20 | One customer                   | Similar problem, different workflow | Same workflow in 2–3 businesses with configuration        | Same workflow in 3+ businesses with little variation      | [ ]     |
| Unit economics and support burden       |      20 | Loses money per customer       | Viable only with heavy founder time | Viable with modelled support; unproven                    | Measured margin healthy including model and support costs | [ ]     |
| Competitive differentiation             |      15 | Commodity; incumbents solve it | Marginal improvement                | Clear gap incumbents leave (e.g. exceptions, not capture) | Strong, evidenced gap customers say they would switch for | [ ]     |
| Engineering and integration feasibility |      10 | Not feasible                   | Needs major unknown integrations    | Feasible with known connectors                            | Largely built and reused (R3+)                            | [ ]     |
| Distribution potential                  |      10 | No route to buyers             | Founder outreach only               | A referral or partner channel tested                      | Repeatable acquisition channel with known cost            | [ ]     |
| **Total**                               | **100** |                                |                                     |                                                           |                                                           | **[ ]** |

_Scores 2 and 4 sit between the neighbouring anchors._

| Score | Decision                                 |
| ----- | ---------------------------------------- |
| 80+   | Eligible for a funded product experiment |
| 65–79 | Continue validation                      |
| < 65  | Defer or reject                          |

**Override:** unresolved intellectual-property, legal or safety problems override the score.

## 4. Product Candidate Investment Review (Template H)

| Field                                    | Value                        |
| ---------------------------------------- | ---------------------------- |
| Product hypothesis                       | [ ]                          |
| Target buyer and vertical                | [ ]                          |
| Repeated operational problem             | [ ]                          |
| Customer interviews and evidence         | [count; private references]  |
| Independent customers with the same need | [n]                          |
| Paying customers / commitments           | [n; references]              |
| Incumbent products and differentiation   | [ ]                          |
| Common reusable functionality percentage | [ ]% — _how estimated_       |
| Commercial / market size assumptions     | [ ] — _label as assumptions_ |
| Initial implementation cost              | £[ ] / [hours]               |
| Customer acquisition hypothesis          | [ ]                          |
| Pricing and contribution forecast        | [ ] — _forecast, not fact_   |
| Ongoing support costs                    | [ ]                          |
| Legal / IP / licence review              | [status; reviewer]           |
| Security and privacy risks               | [ ]                          |
| Evaluation and product acceptance plan   | [link to 11]                 |
| Weighted investment score                | [ ] / 100                    |
| Current stage → proposed stage           | [P_] → [P_]                  |

**Decision:** GO / VALIDATE FURTHER / REJECT
Approver: [ ] · Decision date: [ ] · Next experiment: [ ]

## 5. Reusable asset register (VAD-018)

_Classify every component an engagement produced before anyone reuses it. Unclear ownership blocks reuse until the contractual or legal position is established. A component does not become mature merely because it sits in a shared repository._

**Reuse maturity (blueprint §11.4):** R0 one-off / customer-specific · R1 generalised internal utility · R2 documented with automated tests · R3 reused in at least two independent engagements · R4 stable, supported, owned, versioned · R5 suitable for a separately marketed product.

**IP classification (blueprint §11.5):** Vitalos pre-existing IP · Vitalos-created reusable IP · client-owned deliverable · jointly licensed · open-source dependency (licence obligations) · third-party commercial dependency · confidential/restricted — cannot be reused.

| Asset ID | Name / purpose | Source engagement(s) | IP classification | Contract clause relied on | Licence obligations | Maturity (R0–R5) | Owner | Version | Reuse permitted?                    | Reviewed by / date |
| -------- | -------------- | -------------------- | ----------------- | ------------------------- | ------------------- | ---------------- | ----- | ------- | ----------------------------------- | ------------------ |
| [ ]      | [ ]            | [ ]                  | [ ]               | [ ]                       | [ ]                 | [ ]              | [ ]   | [ ]     | [Yes / No / Blocked pending review] | [ ]                |

_Today: the AI core modules built in the launch milestone (`superadmin/apps/aicore/`) are Vitalos-created, built on synthetic data, and start at R2 at most (TASKS.md, VAD-018)._
