# 07 — Proposal template

Status: draft v0.1, 28 Oct 2026 · Supports: VAD-005, VAD-012 · FDE-04 Contract · Decision: AID-014

> **Draft template for qualified legal review. Not an executed or approved agreement.**
>
> Do not send a proposal built from this template until the template has been reviewed by a qualified legal adviser, and the owner has approved the price and terms for this specific opportunity. Sending proposals is an owner action (AGENTS.md, AI & Data).

_How to use: one proposal per offer per opportunity. The proposal explains what Vitalos will do and on what basis; once accepted it is turned into a statement of work ([08](08-statement-of-work-template.md)) that carries the binding detail. Every one of the 14 required elements (blueprint §7.4) appears below; the table at the end checks coverage. Delete italic guidance before sharing. Keep the filled-in proposal in the Super Admin, not in this repository._

---

# Proposal: [Offer name] for [Client]

| Field              | Value                      |
| ------------------ | -------------------------- |
| Proposal reference | [PRO-YYYY-nnn]             |
| Opportunity        | [Super Admin reference]    |
| Prepared for       | [name, role, organisation] |
| Prepared by        | [name], Vitalos AI & Data  |
| Date / version     | [date] · v[n]              |
| Valid until        | [date — e.g. 30 days]      |

## 1. The business problem and measurable objective

_Element 1. In the customer's terms, from the problem brief. One paragraph and one measure._

[Problem summary.]

**Objective:** [metric] from [baseline, with source] to [target] by [date or stage], measured by [method].

## 2. What is included

_Element 2._

- Workflow: [start → end]
- Functional scope: [bullets]
- Environment: [Vitalos-controlled / customer environment]

## 3. What is not included

_Element 3. Be explicit; exclusions prevent disputes._

- [Exclusion]
- [Exclusion]
- Anything not listed in §2 is out of scope and handled through change control (§9).

## 4. Data and integration assumptions

_Element 4._

| Source                        | Format / access route           | Owner / permission confirmed by | Personal data     |
| ----------------------------- | ------------------------------- | ------------------------------- | ----------------- |
| [e.g. purchase-ledger export] | [CSV via approved upload route] | [role, date]                    | [Y/N, categories] |

Assumptions: [e.g. exports are representative; no live connection to the accounting system is needed for this stage].

## 5. Deliverables and acceptance tests

_Element 5. Each deliverable has a test the customer can check._

| Deliverable   | Acceptance test               | Accepted by     |
| ------------- | ----------------------------- | --------------- |
| [Deliverable] | [objective test or threshold] | [customer role] |

## 6. Work plan and milestones

_Element 6. Estimated, not guaranteed; dependencies on customer inputs stated._

| Milestone   | Estimated date | Depends on                              |
| ----------- | -------------- | --------------------------------------- |
| Kick-off    | [ ]            | Signed SOW, onboarding (09)             |
| [Milestone] | [ ]            | [ ]                                     |
| Acceptance  | [ ]            | Customer review within [n] working days |

## 7. What we need from you

_Element 7._

- A business decision-maker: [role].
- Reliable business rules and representative samples by [date].
- Approval of data access and use.
- Participation in testing and reviews on [cadence].
- Acceptance or rejection of deliverables within [n] working days against the agreed tests.

Delays caused by missing inputs move the dates and may be handled under change control.

## 8. Fees, payment and expenses

_Element 8. Price from the cost estimate in [15](15-cost-tracker.md); confirm contribution ≥ 40% (internal threshold) before sending. The list price in the Super Admin is a proposed assumption, not a market rate._

| Item                        | Amount                                                               |
| --------------------------- | -------------------------------------------------------------------- |
| Fixed fee                   | £[ ] [excl. VAT — confirm VAT status]                                |
| Payment schedule            | [e.g. 100% before work / 40% · 40% · 20%]                            |
| Third-party costs           | [included up to £[cap] / passed through at cost with prior approval] |
| Invoicing and payment terms | [e.g. payable within [n] days of invoice]                            |

## 9. Change control

_Element 9._ Changes to scope, dates, fees, data sources, integrations, security posture, operating costs or external actions are agreed in writing before work on them starts, using a change request that states the impact on scope, timeline and fees. Unfunded out-of-scope requests are not included.

## 10. Confidentiality, ownership and licensing

_Element 10. Legal review required. State the position; the SOW/contract holds the binding wording._

- Confidentiality: [summary — mutual / reference to agreement].
- Customer data remains the customer's.
- Vitalos pre-existing and generally reusable components: [retained by Vitalos, licensed to the customer for use with the deliverable — confirm with legal adviser].
- Customer-specific deliverables: [ownership/licence position].
- Third-party and open-source components remain under their own licences.

## 11. Data processing and security

_Element 11. From the risk screen in [10](10-security-and-data-processing-checklist.md)._

- Roles: [question to resolve: is Vitalos acting as processor for the customer? Professional advice may be needed].
- Data processing terms: [required / not required — reason].
- Model providers and subprocessors: [list, or "none — deterministic only"].
- Location and retention: [where data is stored; deletion within [n] days of [event]].
- Customer data is not used to train models or for other customers.

## 12. Warranty, support limits and ongoing options

_Element 12._

- Warranty: [e.g. defects against the acceptance tests reported within [n] days are corrected at no charge].
- Support after acceptance is **not** included unless stated. No 24/7 support is offered.
- Ongoing option: Managed AI Operations ([13](13-managed-service-scope.md)), quoted separately.

## 13. Termination, export, deletion and handover

_Element 13._

- Either party may end the engagement [on notice terms — legal review]; fees for work done to that point are payable.
- On completion or termination: customer data returned or deleted as instructed; Vitalos access revoked; deliverables completed to date handed over.

## 14. Contacts, decisions and escalation

_Element 14._

| Role               | Customer     | Vitalos |
| ------------------ | ------------ | ------- |
| Decision-maker     | [name, role] | [name]  |
| Day-to-day contact | [name, role] | [name]  |
| Escalation         | [name, role] | [name]  |

Decisions are confirmed in writing (email is enough). Escalation: day-to-day contacts → decision-makers within [n] working days.

## Next step

[e.g. "If you would like to proceed, we will send a statement of work for signature."]

---

## Coverage check (internal — delete before sending)

| §7.4 element                                          | Section | Done |
| ----------------------------------------------------- | ------- | ---- |
| 1. Business problem and measurable objective          | 1       | [ ]  |
| 2. Included workflow and functional scope             | 2       | [ ]  |
| 3. Explicit exclusions                                | 3       | [ ]  |
| 4. Data sources and integration assumptions           | 4       | [ ]  |
| 5. Deliverables and acceptance tests                  | 5       | [ ]  |
| 6. Work plan, milestones and estimated times          | 6       | [ ]  |
| 7. Customer inputs and responsibilities               | 7       | [ ]  |
| 8. Fees, payment milestones, taxes, third-party costs | 8       | [ ]  |
| 9. Change-control method                              | 9       | [ ]  |
| 10. Confidentiality, ownership and licensing          | 10      | [ ]  |
| 11. Data processing and security arrangements         | 11      | [ ]  |
| 12. Warranty, support limits, ongoing options         | 12      | [ ]  |
| 13. Termination, export, deletion, handover           | 13      | [ ]  |
| 14. Contact, decision and escalation                  | 14      | [ ]  |

Internal approvals before sending:

- [ ] Template legally reviewed (version reviewed: [ ]; reviewer: [ ]).
- [ ] Cost estimate and contribution checked in [15](15-cost-tracker.md); planned contribution margin [ ]%.
- [ ] Risk screen completed ([10](10-security-and-data-processing-checklist.md)); risk class [ ].
- [ ] Owner approved price and terms for this opportunity on [date].
- [ ] Super Admin opportunity moved to Assessment/Proposal with the proposal recorded.
