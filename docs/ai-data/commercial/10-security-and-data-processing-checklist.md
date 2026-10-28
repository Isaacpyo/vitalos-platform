# 10 — Security and data processing checklist (risk-screening procedure)

Status: draft v0.1, 28 Oct 2026 · Owner: Business Lead (governance) with Technical Lead · Supports: **VAD-006** (risk-screening procedure documented), VAD-013, VAD-015 · FDE-03 onward

> This is an internal procedure, not a certification, a legal opinion or evidence of compliance. Where the law matters — UK GDPR and the Data Protection Act 2018, PECR, ICO guidance on controllers and processors, NCSC guidance on secure AI system development — this document states the **question to resolve**. Professional advice may be needed; get it before relying on an answer for a real engagement.

## 1. When to run it

| Point                                              | Depth                                                | Output                                           |
| -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| Opportunity reaches **Reviewing** or **Discovery** | First pass: §2–§3                                    | Provisional risk class; any stop condition       |
| Before a proposal is sent                          | Full: §2–§8                                          | Decision record (§8) attached to the opportunity |
| Before any customer data is received               | Confirm §4–§7 still hold                             | Updated decision record                          |
| Any change to data, providers or actions           | Re-run affected sections                             | Updated decision record; change request          |
| Before production release                          | Feed into [12](12-production-readiness-checklist.md) | Readiness record                                 |

Run it even when the customer seems low-risk. It takes 20 minutes for a simple case.

## 2. Risk class (blueprint §13.2)

| Class        | Indicative scenario                                                                                                                 | Operating response                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Low**      | Non-sensitive internal summarisation or extraction; no external action; little or no personal data                                  | Standard baseline controls and tests                                                                        |
| **Moderate** | Customer records, data integration, operational decision support with human review                                                  | Expanded risk review, privacy controls, evaluated review paths                                              |
| **High**     | Material financial impact, sensitive information, vulnerable people, impactful decisions about people, or powerful external actions | Specialist risk assessment, enhanced controls and explicit acceptance; **refuse if not safely supportable** |

_A supplier statement reconciliation proof of value on exported files, with human review and no postings, is typically Moderate (financial records, some personal data of sole-trader suppliers). It becomes High if the system would post to the ledger or trigger payments._

High financial value does not justify high technical risk or unsafe autonomy.

Classification: [Low / Moderate / High] · Reason: [ ] · By: [ ] · Date: [ ]

## 3. Stop conditions (blueprint §8.5)

**Do not advance** the opportunity or engagement while any box is ticked. Record it in the Super Admin and set the opportunity On Hold if needed.

- [ ] There is no authorised business sponsor.
- [ ] There is no valid right to access or process the required data.
- [ ] There is an unresolved critical security or privacy problem.
- [ ] There is material unpriced scope or an unsupported commercial commitment.
- [ ] AI would perform a risky action without sufficient safeguards.
- [ ] The system cannot be evaluated for the intended workflow.
- [ ] A proposed deployment has no support or recovery owner.
- [ ] Financial or operational risk exceeds approved limits.

## 4. Privacy questions (blueprint §13.5)

_Answer before handling any personal data. "Unknown" is an acceptable interim answer only if it blocks receiving data until resolved._

| #   | Question to resolve                                                                                                                                                      | Answer | Evidence / who confirmed | Advice needed? |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------ | -------------- |
| P1  | What personal data is involved (categories, whose), and is any of it special category or criminal offence data?                                                          | [ ]    | [ ]                      | [ ]            |
| P2  | What are the controller and processor roles of each party for each data set? (For a practice handling its clients' records, the practice's own client terms may matter.) | [ ]    | [ ]                      | [ ]            |
| P3  | What is the authorised purpose, and what lawful basis does the controller rely on, as applicable?                                                                        | [ ]    | [ ]                      | [ ]            |
| P4  | Is a data processing agreement required? If so, whose template, and has it been reviewed?                                                                                | [ ]    | [ ]                      | [ ]            |
| P5  | Which subprocessors (hosting, model providers) will process the data, and has the customer approved them?                                                                | [ ]    | [ ]                      | [ ]            |
| P6  | Will data leave the UK? If so, what transfer arrangements apply?                                                                                                         | [ ]    | [ ]                      | [ ]            |
| P7  | Is a DPIA necessary, and whose responsibility is it?                                                                                                                     | [ ]    | [ ]                      | [ ]            |
| P8  | What retention, deletion, access and data-subject-rights support obligations apply?                                                                                      | [ ]    | [ ]                      | [ ]            |
| P9  | What are the model provider's terms, data handling and retention settings for the account and configuration actually used?                                               | [ ]    | [ ]                      | [ ]            |
| P10 | Is training or fine-tuning on customer data permitted? (Default: no.)                                                                                                    | [ ]    | [ ]                      | [ ]            |
| P11 | Who notifies whom of a personal data breach, and on what timetable? Who communicates with the customer's clients?                                                        | [ ]    | [ ]                      | [ ]            |
| P12 | Does Vitalos's own data protection registration and fee position cover this activity?                                                                                    | [ ]    | [ ]                      | [ ]            |

**Rule:** never claim that an AI provider does not store or train on data unless the specific contract and the deployed configuration support that claim — cite which.

## 5. Default customer-data policy (blueprint §13.6)

Confirm each applies to this engagement, or record the agreed exception.

- [ ] Customer data and related rights remain governed by the customer's ownership and the contract.
- [ ] Used only for the agreed and authorised purpose.
- [ ] No sharing across customers.
- [ ] No use of customer-confidential data for product or model training without explicit written permission.
- [ ] No routine logging of raw sensitive prompts or responses; logs hold identifiers, metrics and redacted text.
- [ ] No copying of production data into personal, local or shared test systems.
- [ ] Retention and secure deletion specified, performed and documented (deletion date: [ ]).
- [ ] Anything reused is de-identified or otherwise permitted by the contract and law.

Exceptions agreed: [none / describe, who approved, date]

## 6. AI threat checklist (blueprint §13.4)

_For each threat: does it apply, and what is the control? "Untrusted customer content and retrieved material are data, not instructions."_

| Threat                                                                 | Applies? | Control in this design                                                                                 | Tested by      |
| ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ | -------------- |
| Direct prompt injection                                                | [ ]      | [e.g. no free-text user prompts reach the model; fixed instructions]                                   | [eval case id] |
| Indirect injection via documents, web pages, emails, retrieved content | [ ]      | [e.g. document text passed as data; output schema-validated; instruction-like text flagged for review] | [ ]            |
| Retrieval poisoning                                                    | [ ]      | [ ]                                                                                                    | [ ]            |
| Sensitive-data leakage and exfiltration                                | [ ]      | [e.g. no tools with network access; redaction before logging]                                          | [ ]            |
| Excessive AI tool permissions                                          | [ ]      | [e.g. model has no tools; read-only connectors]                                                        | [ ]            |
| Autonomous financial or destructive actions                            | [ ]      | [e.g. none — human approval before any posting/payment]                                                | [ ]            |
| Model output trusted as code or privileged instruction                 | [ ]      | [e.g. output parsed into a typed schema; never executed]                                               | [ ]            |
| Cross-client / tenant disclosure                                       | [ ]      | [e.g. separate deployment or tenant-scoped queries with tests]                                         | [ ]            |
| Prompt/output leakage into logs or training sets                       | [ ]      | [ ]                                                                                                    | [ ]            |
| Provider failure or unexpected behaviour change                        | [ ]      | [e.g. timeouts, bounded retries, pinned model version, regression evaluation on change]                | [ ]            |
| Hallucinated results presented as verified                             | [ ]      | [e.g. grounding check against source lines; deterministic arithmetic; review routing]                  | [ ]            |

## 7. Model-provider and subprocessor assessment

_One row per provider that would see customer data (model APIs, hosting, storage, email, monitoring). Facts must come from the provider's current terms and the account's actual settings, checked on the date shown — never from memory. This is also the supplier register (blueprint §14.6)._

| Provider / service | Purpose | Data sent | Region / transfer | Retention setting (as configured) | Used for training? (per contract) | Terms / DPA version reviewed, date | Security information reviewed | Cost basis | Access owner | Exit option | Customer approved (date) | Decision                                |
| ------------------ | ------- | --------- | ----------------- | --------------------------------- | --------------------------------- | ---------------------------------- | ----------------------------- | ---------- | ------------ | ----------- | ------------------------ | --------------------------------------- |
| [ ]                | [ ]     | [ ]       | [ ]               | [ ]                               | [ ]                               | [ ]                                | [ ]                           | [ ]        | [ ]          | [ ]         | [ ]                      | [Use / Don't use / Use with conditions] |

_Prefer the deterministic path where it does the job: data that never goes to a model provider needs no model-provider assessment. The demonstrator's model path stays off until a key and a provider assessment exist (AID-012)._

## 8. Decision record

| Field                       | Value                                                                             |
| --------------------------- | --------------------------------------------------------------------------------- |
| Opportunity / engagement    | [reference]                                                                       |
| Date / version              | [date] · v[n]                                                                     |
| Risk class                  | [Low / Moderate / High]                                                           |
| Stop conditions             | [none / list]                                                                     |
| Open privacy questions      | [list P-numbers; owner; due]                                                      |
| Professional advice needed? | [No / Yes — on what; requested from whom; date]                                   |
| Providers approved          | [list or "none — deterministic only"]                                             |
| Conditions on proceeding    | [e.g. no data received until DPA signed; human approval on all outputs]           |
| Decision                    | [Proceed / Proceed with conditions / Pause / Decline]                             |
| Decided by                  | [name, role] — _governance decision recorded separately from commercial approval_ |
| Customer acknowledgement    | [where needed: name, role, date]                                                  |

Store the decision record with the opportunity in the Super Admin.
