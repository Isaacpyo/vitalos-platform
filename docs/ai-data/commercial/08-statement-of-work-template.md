# 08 — Statement of work template

Status: draft v0.1, 28 Oct 2026 · Supports: VAD-005, VAD-012 · FDE-04 Contract · Decision: AID-014

> **Draft template for qualified legal review. Not an executed or approved agreement.**
>
> This template has not been reviewed by a lawyer. It does not contain legally approved terms and may be missing terms a contract needs (liability, insurance, governing law, assignment and others). It is a structure for the scope; the legal terms it refers to must come from reviewed documents. Signing a SOW is an owner action.

_How to use: create the SOW from an accepted proposal ([07](07-proposal-template.md)) and, for a proof of value, attach the charter ([06](06-proof-of-value-charter.md)) as Annex A. Each section carries one or more of the 14 required elements (blueprint §7.4). Where law matters, the questions to resolve are written as questions — get professional advice where needed. Keep the filled-in SOW in the Super Admin or the engagement's private store._

---

# Statement of Work

| Field                     | Value                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------ |
| SOW reference             | [SOW-YYYY-nnn]                                                                       |
| Engagement ID             | [ID]                                                                                 |
| Parties                   | [Vitalos legal entity — owner to confirm] and [Client legal entity]                  |
| Governing agreement       | [Master/services agreement reference, or "terms attached as Annex C" — legal review] |
| Offer                     | [AI Opportunity Assessment / AI Proof of Value / Production AI Engineering]          |
| Start date / expected end | [date] / [date]                                                                      |
| Version                   | v[n]                                                                                 |

## 1. Objective (element 1)

Business problem: [summary].
Measurable objective: [metric], baseline [value, source], target [value], measured by [method].

## 2. Scope (element 2)

| #   | In-scope item         | Description |
| --- | --------------------- | ----------- |
| S1  | [workflow / function] | [ ]         |
| S2  | [ ]                   | [ ]         |

## 3. Exclusions (element 3)

| #   | Excluded                                                                     |
| --- | ---------------------------------------------------------------------------- |
| X1  | [e.g. production deployment]                                                 |
| X2  | [e.g. automated payments or ledger postings]                                 |
| X3  | Support after the warranty period, unless contracted under a managed service |
| X4  | Anything not listed in §2                                                    |

## 4. Data sources and integration assumptions (element 4)

| Source | Owner | Format and route | Personal data | Permission recorded |
| ------ | ----- | ---------------- | ------------- | ------------------- |
| [ ]    | [ ]   | [ ]              | [ ]           | [ref, date]         |

Assumptions: [list]. If an assumption proves false, change control applies (§9).

## 5. Deliverables and acceptance (element 5)

| ID  | Deliverable | Acceptance test / threshold | Review period    | Acceptor        |
| --- | ----------- | --------------------------- | ---------------- | --------------- |
| D1  | [ ]         | [ ]                         | [n] working days | [customer role] |

Acceptance procedure: Vitalos notifies delivery with evidence → customer tests within the review period → customer accepts in writing or lists specific failures against the test → Vitalos corrects and resubmits. _Question for legal review: what happens if the customer neither accepts nor rejects within the period?_

## 6. Work plan and milestones (element 6)

| Milestone     | Estimated date | Dependency               | Payment linked |
| ------------- | -------------- | ------------------------ | -------------- |
| M0 Kick-off   | [ ]            | Onboarding complete (09) | [ ]            |
| M1 [ ]        | [ ]            | [ ]                      | [ ]            |
| M2 Acceptance | [ ]            | D1–Dn accepted           | [ ]            |

Dates are estimates and depend on customer inputs in §7.

## 7. Customer inputs and responsibilities (element 7)

The customer will:

- [ ] Nominate a business decision-maker: [name, role].
- [ ] Supply business rules and representative samples by [date] through the approved route.
- [ ] Approve access and use of information, recorded in the access register.
- [ ] Clarify integrations and software constraints.
- [ ] Take part in testing and review deliverables within the agreed periods.
- [ ] Decide which external actions require human approval.
- [ ] Accept or reject completed work against the agreed tests.

Delays caused by missing inputs are recorded and handled under §9.

## 8. Fees, payment, taxes and expenses (element 8)

| Item                 | Detail                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Fee                  | £[ ] — fixed / capped at [n] hours × £[rate] _(state which)_                               |
| Schedule             | [e.g. 40% on signature · 40% on M1 · 20% on acceptance]                                    |
| VAT                  | [Applicable / not applicable — confirm the business's VAT status]                          |
| Third-party expenses | [Included up to £[cap]; above the cap only with written approval / passed through at cost] |
| Invoice terms        | Payable within [n] days. _Late payment terms: legal review._                               |

## 9. Change control (element 9)

Changes affecting fees, dates, scope, business rules, integrations, data sources, security or privacy posture, operating costs, support obligations or external actions require a written change request with an impact assessment, approved by both decision-makers before work begins. Approved changes update this SOW by numbered amendment. Work requested outside scope without an approved change is not an obligation.

## 10. Confidentiality, ownership and licensing (element 10)

_Legal review required. Questions to resolve with the adviser:_

- What confidentiality terms apply, and for how long?
- Who owns the customer-specific deliverables on payment?
- What licence does the customer get to Vitalos pre-existing and generally reusable components incorporated in the deliverables?
- What may Vitalos reuse afterwards (general know-how and its own components) — and what may it never reuse (customer data, confidential information, customer-specific code)?
- How are open-source and third-party licences disclosed?

Position for this SOW: [to be completed from reviewed terms].

## 11. Data processing and security (element 11)

_Complete from the risk screen ([10](10-security-and-data-processing-checklist.md)); attach data processing terms as Annex B where required._

| Item                            | Position                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Roles                           | [Question to resolve: controller/processor roles for each data set — professional advice may be needed]          |
| Data processing terms           | [Required — Annex B / Not required — reason]                                                                     |
| Purpose                         | [the agreed purpose only]                                                                                        |
| Data categories                 | [ ]                                                                                                              |
| Subprocessors / model providers | [list with location; customer approval recorded on date]                                                         |
| International transfers         | [none / describe — question to resolve]                                                                          |
| Storage location and access     | [ ]                                                                                                              |
| Retention and deletion          | [delete or return within [n] days of [event]; deletion confirmed in writing]                                     |
| Security measures               | [summary: least privilege, MFA, encryption, logging without raw sensitive data]                                  |
| Incident notification           | [Vitalos notifies the customer contact without undue delay on becoming aware; timing and content — legal review] |
| Model training                  | Customer data is not used to train or fine-tune models, or for any other customer.                               |

## 12. Warranty, support and ongoing service (element 12)

- Warranty: [scope and period — legal review].
- Support included: [none / [n] hours until [date]], business hours [define], no out-of-hours cover.
- Ongoing service: Managed AI Operations may be contracted separately ([13](13-managed-service-scope.md)).

## 13. Termination, export, deletion and handover (element 13)

- Termination rights and notice: [legal review].
- On termination or completion: fees for work done become payable; customer data exported/returned as agreed and then deleted; access and secrets revoked; deliverables to date handed over with documentation; deletion confirmed in writing.

## 14. Contacts, decisions and escalation (element 14)

| Role                  | Customer | Vitalos |
| --------------------- | -------- | ------- |
| Decision-maker        | [ ]      | [ ]     |
| Day-to-day contact    | [ ]      | [ ]     |
| Data/security contact | [ ]      | [ ]     |
| Escalation            | [ ]      | [ ]     |

Status updates: [weekly by email / call]. Decisions are recorded in writing. Unresolved issues escalate to decision-makers after [n] working days.

## Annexes

- Annex A — Proof-of-value charter / detailed scope
- Annex B — Data processing terms (if required; from a reviewed template)
- Annex C — Terms and conditions (from a reviewed template)

## Signatures

_Signature blocks to be supplied with the reviewed terms. Do not sign this draft._

---

## Internal checklist before issuing (delete before sending)

- [ ] Based on a legally reviewed version of this template (version [ ]).
- [ ] All 14 elements completed; no `[bracketed]` fields left.
- [ ] Risk screen complete; any data processing terms attached.
- [ ] Cost estimate and contribution checked ([15](15-cost-tracker.md)).
- [ ] Owner approval to issue recorded on [date].
