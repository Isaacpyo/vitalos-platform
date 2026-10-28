# 19 — Weekly founder review and monthly commercial review

Status: draft v0.1, 28 Oct 2026 · Owner: Business Lead · Supports: all VAD tasks; blueprint §19

_Two standing meetings, even when the founder is the only attendee. Work from the Super Admin (Pipeline, Budget, Demonstrator) rather than memory. Keep the notes in the Super Admin or a private store; record decisions in `docs/ai-data/DECISIONS.md` only when they change how the business operates (and never with customer names or figures)._

## 1. Weekly founder leadership review (30–45 minutes)

**Inputs:** Super Admin pipeline (stage, owner, next action, due date), budget page, active engagement ledgers, incident list, access register ([09](09-onboarding-and-data-access-checklist.md) §5).

| #   | Agenda item (blueprint §19.3)                      | Questions                                                                                          | Notes / decisions |
| --- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | New pipeline, next actions and conversion problems | Every open opportunity has an owner, next action and date? Anything stuck > 2 weeks?               |                   |
| 2   | Cash position, invoices and near-term liabilities  | Received vs invoiced vs contracted vs pipeline ([15](15-cost-tracker.md) §5)? Anything overdue?    |                   |
| 3   | Project scope, blockers and delivery margin        | Hours actual vs estimate? Any unapproved scope creeping in?                                        |                   |
| 4   | Quality evaluation and incidents                   | Any regression, SEV-1/2, open corrective actions?                                                  |                   |
| 5   | API and cloud spend relative to limits             | Spend vs category ceilings and application caps? Any alert?                                        |                   |
| 6   | Customer adoption and measured value               | Are customers using what was delivered? What was measured?                                         |                   |
| 7   | Reusable components and duplicate work             | Did we build the same thing twice? Anything to register ([16](16-product-candidate-review.md) §5)? |                   |
| 8   | Product hypothesis                                 | Does any recurring problem deserve more discovery?                                                 |                   |
| —   | Access hygiene                                     | Any access past its expiry or no longer needed? Revoke now.                                        |                   |

**Outputs:** updated next actions in the Super Admin; at most three priorities for the week:

1. [ ]
2. [ ]
3. [ ]

## 2. Monthly commercial review (60–90 minutes)

**Inputs:** last four weekly notes; pipeline report; budget page; monthly managed-service reports; objections log ([05](05-discovery-questionnaire.md) §4); ICP evidence table ([01](01-ideal-customer-profile.md) §8).

| #   | Assess (blueprint §19.4)                      | Measure                                                  | This month | Last month | Note |
| --- | --------------------------------------------- | -------------------------------------------------------- | ---------- | ---------- | ---- |
| 1   | Total receipts vs revenue targets             | £ received; target                                       |            |            |      |
| 2   | Leads by source                               | Count by source (site form, referral, outbound, partner) |            |            |      |
| 3   | Qualified opportunities and signed projects   | Count at Qualified+; count Won                           |            |            |      |
| 4   | Project margins and deviations                | Contribution margin per engagement vs ≥ 40% threshold    |            |            |      |
| 5   | Managed-service revenue and retention         | MRR; services started/ended; margin vs ≥ 60% threshold   |            |            |      |
| 6   | Customer satisfaction and verifiable outcomes | Measured outcomes; feedback                              |            |            |      |
| 7   | Risks and constraints                         | Top three risks                                          |            |            |      |
| 8   | Most promising vertical / workflow            | Evidence for and against the current segment (AID-007)   |            |            |      |

**Also each month:**

- [ ] Revenue and contribution **per engineering hour** — the denominator includes all real engineering and rework time, not just invoiced hours.
- [ ] Repeated objections → does the offer need to change (not just the wording)?
- [ ] Speculative spend vs the £1,000 ceiling, by category.
- [ ] Discovery count toward the 10-conversation review of the ICP (VAD-011).
- [ ] Any task in `docs/ai-data/TASKS.md` whose status changed — update with evidence.

**Decisions this month:** [list; log in DECISIONS.md where they change operating policy]

## 3. Company KPI groups (blueprint §19.1)

| Domain               | KPI examples                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Commercial           | Qualified leads, discovery calls, opportunity-to-contract conversion, pipeline, signed revenue, sales cycle                |
| Engineering          | Estimate accuracy, defects, evaluation pass rates, deployment success, rework hours, release lead time                     |
| Financial            | Project contribution, contribution per engineering hour, cash runway, operating costs, recurring revenue, AI cost per task |
| Product and learning | Reusable-component adoption, recurring problems, product-stage transitions, activation, retention                          |
