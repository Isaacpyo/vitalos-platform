# 18 — Incident record (Template J)

Status: draft v0.1, 28 Oct 2026 · Supports: VAD-017 · FDE-09 Operate

_Open a record for every SEV-1 or SEV-2 incident and for any suspected exposure of customer or personal data, however small it first looks. Times in UK time with date. Write facts and timestamps as they happen; analysis comes later. Keep the record in the engagement's private store — never paste customer data, credentials or logs containing personal data into it or into this repository._

## Severity (blueprint §13.7)

| Severity  | Description                                                                  | Posture                                              |
| --------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| **SEV-1** | Serious data exposure, critical compromise or major operational interruption | Immediate containment and escalation                 |
| **SEV-2** | Significant degradation, suspected compromise, material malfunction          | Prioritised investigation, communication, correction |
| **SEV-3** | Limited functional issue                                                     | Contracted support schedule                          |
| **SEV-4** | Minor cosmetic / low-impact issue                                            | Maintenance backlog                                  |

Response times are contract-specific ([13](13-managed-service-scope.md) §5).

## Lifecycle checklist

- [ ] **Detect** — record detection time and source.
- [ ] **Classify** — set severity; raise it if unsure.
- [ ] **Contain** — stop harm first: kill switch, disable the workflow, revoke a credential, block access.
- [ ] **Communicate** — notify the customer contact per contract; log every message with time.
- [ ] **Restore** — return to a known good state (rollback reference).
- [ ] **Verify** — confirm the fix with evidence; watch for recurrence.
- [ ] **Review** — root cause and preventive actions with owners.

**Possible personal data breach:** treat as SEV-1 until assessed. Start the assessment immediately. Questions to resolve with the customer and, where needed, professional advice: whether the incident is a personal data breach; whether it must be reported to the regulator or to the people affected, by whom and by when (time limits may apply from the moment of awareness); and how the controller/processor roles in the contract allocate notification duties. Record each decision and who made it.

---

# Incident Record

| Field                            | Value                                          |
| -------------------------------- | ---------------------------------------------- |
| Incident ID                      | [INC-YYYY-nnn]                                 |
| Customer / service / environment | [ ] / [ ] / [production / staging]             |
| Severity                         | [SEV-1–4] (changed from [ ] at [time], reason) |
| Detected at                      | [date time] by [monitor / person]              |
| Started at (if known)            | [date time]                                    |
| Incident owner                   | [name]                                         |

## Impact

Customer / business impact: [who and what was affected; data involved (categories, volume — no actual data)].

## Timeline

| Time | Event / action / communication | By  |
| ---- | ------------------------------ | --- |
| [ ]  | [ ]                            | [ ] |

## Response

| Item                              | Detail                                            |
| --------------------------------- | ------------------------------------------------- |
| Initial containment               | [ ]                                               |
| Investigation evidence            | [references to private logs, not contents]        |
| Root cause                        | [ ]                                               |
| Restoration and validation        | [ ]                                               |
| Security or reporting obligations | [assessed by, decision, date; notifications made] |

## Corrective and preventive actions

| Action | Owner | Due | Done |
| ------ | ----- | --- | ---- |
| [ ]    | [ ]   | [ ] | [ ]  |

Closure approval: [name, role, date] · Customer informed of closure: [date]
