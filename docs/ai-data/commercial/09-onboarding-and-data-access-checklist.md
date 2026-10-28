# 09 — Customer onboarding and data access checklist (Template C)

Status: draft v0.1, 28 Oct 2026 · Supports: VAD-013 · FDE-04 Contract → FDE-05 Design

_Onboarding starts only when the engagement is commercially approved and the applicable agreements are in place (blueprint §9.4). No customer data is received, and no access to customer systems is used, until the relevant boxes below are ticked with evidence. Acting inside a customer's systems or on customer data needs the customer's written authorisation, a signed scope and data terms, and this checklist (AGENTS.md, AI & Data). Keep the filled-in checklist and register in the Super Admin or the engagement's private store._

## 1. Engagement record

| Field                     | Value                                                                             |
| ------------------------- | --------------------------------------------------------------------------------- |
| Engagement ID             | [ID — unique, created at onboarding]                                              |
| Client                    | [organisation]                                                                    |
| Customer business sponsor | [name, role]                                                                      |
| Vitalos technical owner   | [name] — _one person, accountable from discovery to handover_                     |
| SOW reference             | [SOW-YYYY-nnn, signed on date]                                                    |
| Risk class                | [Low / Moderate / High] — from [10](10-security-and-data-processing-checklist.md) |

## 2. Onboarding checklist (Template C)

- [ ] Signed SOW / order form exists. Ref: [ ]
- [ ] Initial payment received or payment arrangement approved. Ref: [ ]
- [ ] Business sponsor designated. Name: [ ]
- [ ] Technical delivery owner designated. Name: [ ]
- [ ] Data ownership and processing permissions documented. Ref: [ ]
- [ ] Confidentiality and data processing obligations reviewed. Ref: [ ]
- [ ] Subprocessors and model providers reviewed and approved by the customer ([10](10-security-and-data-processing-checklist.md) §7). Ref: [ ]
- [ ] Workflow map and baseline accepted by the customer. Ref: [ ]
- [ ] Integration permissions approved at least privilege (§5 register).
- [ ] Secrets management method agreed (§4).
- [ ] Test data obtained by authorised means (§6).
- [ ] Acceptance metrics agreed ([11](11-evaluation-plan-template.md)).
- [ ] Delivery milestones and communication cadence agreed.
- [ ] Incident and escalation contacts recorded (§7).
- [ ] Kickoff authorised (§8).

## 3. Onboarding package (blueprint §9.5)

| Item                                          | Location / reference | Done |
| --------------------------------------------- | -------------------- | ---- |
| Client organisation and authorised contacts   | [ ]                  | [ ]  |
| Signed order/SOW and payment terms            | [ ]                  | [ ]  |
| Delivery milestones and acceptance criteria   | [ ]                  | [ ]  |
| Named business and technical owners           | [ ]                  | [ ]  |
| Current process map and approved use case     | [ ]                  | [ ]  |
| Systems and integrations inventory            | [ ]                  | [ ]  |
| Data categories and classification            | [ ]                  | [ ]  |
| Rights to access and process data             | [ ]                  | [ ]  |
| Confidentiality and data processing documents | [ ]                  | [ ]  |
| Subprocessor and model-provider assessment    | [ ]                  | [ ]  |
| Security and access request register (§5)     | [ ]                  | [ ]  |
| Communication, decision and escalation plan   | [ ]                  | [ ]  |
| Customer test and approval commitments        | [ ]                  | [ ]  |

### Customer responsibilities confirmed (blueprint §9.6)

- [ ] Business decision-maker nominated.
- [ ] Reliable business rules and representative samples will be supplied.
- [ ] Access and use of information approved.
- [ ] Existing integrations and software constraints clarified.
- [ ] Will participate in testing and review deliverables on the agreed timetable.
- [ ] Will decide which external actions require approval.
- [ ] Will accept or reject completed work against agreed criteria.

## 4. Access policy (blueprint §9.7)

Apply to every access request, in both directions.

- **Least privilege.** Ask for the narrowest access that does the job — read-only exports before system access; one mailbox folder, not the whole mailbox.
- **Named identities.** A named account for each Vitalos person; no shared logins. Prefer short-lived permissions with an expiry date.
- **MFA** on every privileged account.
- **Approved secret management.** Credentials go into the agreed secret store (for example the Super Admin's environment secrets or the hosting provider's secret store) — never into code, documents, prompts, tickets or chat.
- **Never ask customers to send production passwords over informal chat or email.** If a customer offers, decline and explain the approved route.
- **Record** purpose, scope, approving party and expiry for every access (§5).
- **Revoke** unused access at once and all access at completion.
- **No downloading** of customer production data to personal devices, personal cloud storage or shared environments. Data stays in the approved store.

## 5. Access request register

_One row per access granted to Vitalos or by Vitalos. Review at each weekly review; every row has an expiry._

| ID   | System / data             | Access level (read / write / admin) | Purpose          | Named identity | Requested by | Approved by (customer, date) | Granted on | Expires | MFA | Revoked on | Notes |
| ---- | ------------------------- | ----------------------------------- | ---------------- | -------------- | ------------ | ---------------------------- | ---------- | ------- | --- | ---------- | ----- |
| A-01 | [e.g. ledger CSV exports] | [read]                              | [PoV evaluation] | [account]      | [name]       | [name, role, date]           | [date]     | [date]  | [Y] | [date]     | [ ]   |
| A-02 |                           |                                     |                  |                |              |                              |            |         |     |            |       |

## 6. Receiving data

- [ ] Data permission recorded in §3 before anything is sent.
- [ ] Route agreed: [e.g. customer uploads to an access-controlled Vitalos store / customer shares a time-limited link from their own storage]. **Not** email attachments to personal inboxes, not chat.
- [ ] Minimisation: only fields and periods needed; personal data removed or masked where the purpose allows.
- [ ] Recorded in a data inventory: what, when, where stored, who can access, deletion date.
- [ ] Deletion date set and diarised; deletion confirmed to the customer in writing when done.

## 7. Contacts and escalation

| Purpose                  | Customer (name, role, channel) | Vitalos (name, channel) |
| ------------------------ | ------------------------------ | ----------------------- |
| Decisions                | [ ]                            | [ ]                     |
| Day-to-day               | [ ]                            | [ ]                     |
| Security / data incident | [ ]                            | [ ]                     |
| Escalation               | [ ]                            | [ ]                     |

## 8. Kickoff gate (blueprint §9.8)

Engineering starts only when both sides agree these are sufficiently documented:

| Gate item                | Status (ready / gap) | Evidence |
| ------------------------ | -------------------- | -------- |
| Scope                    | [ ]                  | [ ]      |
| Funding                  | [ ]                  | [ ]      |
| Data approvals           | [ ]                  | [ ]      |
| Owners                   | [ ]                  | [ ]      |
| Dependencies             | [ ]                  | [ ]      |
| Initial acceptance tests | [ ]                  | [ ]      |

Kickoff authorised by: customer [name, role, date] · Vitalos [name, date]

## 9. At completion (link to offboarding)

- [ ] All rows in §5 revoked and dated.
- [ ] Customer data returned or deleted as agreed; confirmation sent.
- [ ] Secrets rotated or removed.
- [ ] Records kept only where legally or contractually necessary, listed: [ ].
