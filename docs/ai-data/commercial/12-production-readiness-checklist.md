# 12 — Production readiness checklist (Template F + first-deployment criteria)

Status: draft v0.1, 28 Oct 2026 · Supports: VAD-015 · FDE-08 Deploy

_Run before every production release of a customer system, not just the first. Tick only with evidence (a link to a test result, a signed acceptance, a recorded approval). Production readiness is specific to this system and does not imply any external certification. Store the completed checklist with the engagement's private records._

| Field               | Value                             |
| ------------------- | --------------------------------- |
| Engagement / system | [ID] · [system name]              |
| Release identifier  | [version / commit SHA / build ID] |
| Date                | [date]                            |
| Risk class          | [from 10]                         |

## 1. Production readiness review (Template F)

| #   | Check                                                                                   | Evidence               | Done |
| --- | --------------------------------------------------------------------------------------- | ---------------------- | ---- |
| 1   | Scope and acceptance criteria reviewed                                                  | [ ]                    | [ ]  |
| 2   | Technical architecture approved                                                         | [ADR ref]              | [ ]  |
| 3   | Security risk assessment completed                                                      | [10 decision record]   | [ ]  |
| 4   | Data processing and subprocessor arrangements approved                                  | [ ]                    | [ ]  |
| 5   | Authentication and server-side authorisation tested                                     | [tests]                | [ ]  |
| 6   | Tenant isolation tested where applicable                                                | [tests / n/a — reason] | [ ]  |
| 7   | Sensitive-data controls verified (logs, redaction, storage)                             | [ ]                    | [ ]  |
| 8   | AI evaluation thresholds met                                                            | [11 results]           | [ ]  |
| 9   | Failure, review and fallback paths tested                                               | [ ]                    | [ ]  |
| 10  | External actions limited and approved                                                   | [ ]                    | [ ]  |
| 11  | Operating costs measured and bounded where possible (application caps, not just alerts) | [ ]                    | [ ]  |
| 12  | Backup and restore tested                                                               | [restore test date]    | [ ]  |
| 13  | Monitoring, alerting and incident owner assigned                                        | [ ]                    | [ ]  |
| 14  | Deployment and rollback/disable tested                                                  | [ ]                    | [ ]  |
| 15  | Customer UAT / acceptance recorded                                                      | [signed ref]           | [ ]  |
| 16  | Business, technical and operational approvals recorded (§4)                             | [ ]                    | [ ]  |

## 2. First production AI deployment — additional criteria (blueprint §23.2)

For a customer's first production AI deployment, also confirm (in addition to commercial readiness):

- [ ] 1. Technical architecture approved.
- [ ] 2. Customer's intended workflow and business acceptance criteria agreed.
- [ ] 3. Rights and terms for processing data confirmed.
- [ ] 4. Authentication and authorisation tested.
- [ ] 5. Security and privacy obligations satisfied.
- [ ] 6. AI evaluation and human-approval gates satisfied.
- [ ] 7. Model and tool failure behaviour tested.
- [ ] 8. Usage and financial exposure measured and controlled.
- [ ] 9. Monitoring and incident response operational.
- [ ] 10. Backups, recovery and rollback/disabling tested.
- [ ] 11. Customer UAT accepted.
- [ ] 12. Named operations owner and **funded** support responsibility established.
- [ ] 13. Approvals, release identifier and handover evidence recorded.

## 3. Baseline safeguards spot-check (blueprint §13.3)

- [ ] Least-privilege identities; MFA on privileged users.
- [ ] Encryption in transit and at rest.
- [ ] Secrets in a managed store; rotation and revocation possible.
- [ ] Separate development and production environments.
- [ ] Dependency and vulnerability scanning in CI; no unresolved critical findings.
- [ ] Protected branches, reviewed and traceable releases.
- [ ] Audit events for sensitive operations.
- [ ] Rate limits, quotas and abuse controls.
- [ ] Restricted log visibility; no raw sensitive data in logs.
- [ ] Safe model-tool permission boundaries.

**Security stop-gate (blueprint §13.8):** any unresolved critical vulnerability, unlawful data-processing arrangement, unapproved material external action or inability to recover safely **blocks the release**, whatever else is ticked.

## 4. Release approvals (recorded separately)

_A founder can hold several roles, but each decision is recorded on its own line._

| Role             | Approves                                     | Name | Date | Decision |
| ---------------- | -------------------------------------------- | ---- | ---- | -------- |
| Technical Lead   | Technical readiness, test outcomes, rollback | [ ]  | [ ]  | [ ]      |
| Business Lead    | Commercial and operational risk              | [ ]  | [ ]  | [ ]      |
| Customer Sponsor | Business acceptance and intended use         | [ ]  | [ ]  | [ ]      |
| Operations Owner | Readiness to support and monitor             | [ ]  | [ ]  | [ ]      |

Release decision: [Go / No-go] · Rollback reference: [previous release / disable switch]
