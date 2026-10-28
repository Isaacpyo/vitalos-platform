# 13 — Managed AI Operations: service scope

Status: draft v0.1, 28 Oct 2026 · Supports: VAD-017 · FDE-09 Operate · Decisions: AID-006, AID-014; blueprint DEC-015

> **Draft template for qualified legal review. Not an executed or approved agreement.**
>
> No service levels in this document are offered or in force. Coverage, response times and service credits exist only when written into a reviewed, signed contract — and only if Vitalos can actually staff them.

_How to use: complete one schedule per customer system, attach it to the managed service agreement, and keep the filled-in version in the Super Admin. Honest coverage wording matters more than an impressive tier name: support is not unlimited, and round-the-clock staffed response is not offered unless separately funded and truly provided._

## 1. Service summary

| Field                                       | Value                                                                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer                                    | [organisation]                                                                                                                                                               |
| System covered                              | [name, release identifier at start]                                                                                                                                          |
| Tier                                        | [Essential / Growth / Advanced]                                                                                                                                              |
| Monthly fee                                 | £[ ] — _Essential proposed list price "from £250/month": proposed list price, configured in the Super Admin (AI & Data › Offers); not validated market rates; not published_ |
| Term and notice                             | [minimum term] · [notice period] — _legal review_                                                                                                                            |
| Start date                                  | [date]                                                                                                                                                                       |
| Customer contact / Vitalos operations owner | [name, role] / [name]                                                                                                                                                        |

## 2. Tiers (blueprint §15.2)

| Element                           | Essential (from £250/month, proposed)                                 | Growth (separately quoted)                       | Advanced (separately quoted)                    |
| --------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------- |
| Monitoring                        | Basic availability and error monitoring                               | + integration health monitoring                  | + extended availability objectives, if funded   |
| Health review                     | Regular (e.g. monthly)                                                | More frequent                                    | As contracted                                   |
| Support coverage                  | Defined business hours only                                           | Expanded allocation, business hours              | Wider windows only if staffed and funded        |
| Security / dependency maintenance | Within stated scope                                                   | Within stated scope                              | As contracted                                   |
| Evaluation                        | Regression run when the model, prompt or rules change                 | + scheduled model and task evaluation            | + formal evidence reporting                     |
| Reporting                         | Monthly usage and cost report ([14](14-monthly-managed-ai-report.md)) | + quality and cost optimisation review           | + formal or regulatory evidence pack, if needed |
| Corrective maintenance            | Limited allowance: [n] hours/month                                    | Larger allowance: [n] hours/month                | As contracted                                   |
| Improvements                      | Not included (change request)                                         | Prioritised improvement backlog, [n] hours/month | As contracted                                   |
| Incident handling                 | Per §5, business hours                                                | Per §5, business hours                           | Enhanced, as contracted                         |

_Price from genuine scope, coverage hours, required reliability and workload. Check contribution in [15](15-cost-tracker.md): at the ≥60% managed-service internal threshold, the monthly direct cost (labour + hosting + model usage) must be ≤ 40% of the fee._

## 3. Coverage — honest wording

Use wording of this kind in the schedule. Edit the bracketed parts; do not strengthen it beyond what is staffed.

> Support hours are [Monday to Friday, 09:00–17:30 UK time, excluding UK bank holidays]. Outside support hours, automated monitoring may record alerts, but no one is on duty to respond until the next support period begins. Vitalos does not provide 24/7 support under this tier. Response targets in section 5 apply within support hours only and are targets for acknowledgement and initial action, not guarantees of resolution time.

Coverage specifics:

- Support channel: [email address or ticket route]. _Not personal messaging apps._
- Monitoring alerts route to: [Vitalos operations owner]; customer notified of incidents per §5.
- Corrective maintenance allowance: [n] hours/month; unused hours [do not roll over].
- Out-of-scope work: quoted under change control.

## 4. KPIs reported monthly (blueprint §15.3)

| Metric                        | What it shows                                   | Target (contract-specific)   |
| ----------------------------- | ----------------------------------------------- | ---------------------------- |
| Availability                  | Can authorised users access the service?        | [ ] or "reported, no target" |
| Task completion rate          | How many workflows complete successfully?       | [ ]                          |
| AI quality / evaluation score | Does the system still meet tested expectations? | [ ]                          |
| Manual-review rate            | How much human effort remains?                  | [ ]                          |
| P95 latency                   | Are high-percentile response times acceptable?  | [ ]                          |
| Error rate                    | Has technical reliability deteriorated?         | [ ]                          |
| Cost per successful task      | Are unit economics healthy?                     | [ ]                          |
| Model/provider usage          | Is consumption expected and authorised?         | [cap]                        |
| Customer adoption             | Does the business actually use the system?      | [ ]                          |
| Incident frequency/severity   | Are failures accumulating or getting worse?     | [ ]                          |
| Value realised                | Is the agreed business outcome being achieved?  | [ ]                          |

## 5. Alerts and incidents

### Required alert categories (blueprint §15.4)

| Alert                                      | Configured | Routed to | Automatic action                                                    |
| ------------------------------------------ | ---------- | --------- | ------------------------------------------------------------------- |
| Service down / unresponsive                | [ ]        | [ ]       | [ ]                                                                 |
| Sustained error increase                   | [ ]        | [ ]       | [ ]                                                                 |
| Critical workflow failure                  | [ ]        | [ ]       | [ ]                                                                 |
| Authentication, misuse or security anomaly | [ ]        | [ ]       | [ ]                                                                 |
| Unexpected model usage / cost acceleration | [ ]        | [ ]       | [pause non-essential AI execution at cap]                           |
| Exhausted per-customer quotas              | [ ]        | [ ]       | [ ]                                                                 |
| Backup failure                             | [ ]        | [ ]       | [ ]                                                                 |
| Spend threshold or budget breach           | [ ]        | [ ]       | [application cap enforced — a cloud budget alert is not a hard cap] |

### Incident severities (blueprint §13.7)

**Response times are contract-specific.** Fill in only what Vitalos can staff; leave "no target" rather than invent one.

| Severity  | Description                                                                  | Response posture                                     | Acknowledge within (support hours) | Customer update cadence | Record                               |
| --------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------- | ----------------------- | ------------------------------------ |
| **SEV-1** | Serious data exposure, critical compromise or major operational interruption | Immediate containment and escalation                 | [ ]                                | [ ]                     | [18](18-incident-record.md) required |
| **SEV-2** | Significant degradation, suspected compromise, material malfunction          | Prioritised investigation, communication, correction | [ ]                                | [ ]                     | [18](18-incident-record.md) required |
| **SEV-3** | Limited functional issue                                                     | Within the contracted support schedule               | [ ]                                | [ ]                     | Ticket                               |
| **SEV-4** | Minor cosmetic / low-impact issue                                            | Planned maintenance backlog                          | [ ]                                | Monthly report          | Backlog                              |

Any potentially reportable incident (for example a personal data breach) needs prompt legal and regulatory assessment and coordination with the customer — see [18](18-incident-record.md).

Lifecycle: **Detect → Classify → Contain → Communicate → Restore → Verify → Review.**

## 6. Operations cadence (blueprint §15.6)

| Cadence               | Activity                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Daily, when warranted | Automated status checks; urgent exception review                                                                          |
| Weekly                | Errors, incidents, cost, support load, pending changes                                                                    |
| Monthly               | Service report; outcomes; operating costs; risk register; agreed improvements                                             |
| Quarterly             | Architecture review; supplier assessment; restore/recovery check; productisation assessment, proportionate to the service |

## 7. Customer responsibilities

- Name a contact who can approve changes and receive incident notices.
- Report issues through the agreed channel.
- Keep their own systems, accounts and user list current; tell Vitalos when staff leave.
- Approve changes that affect business rules or external actions.

## 8. Offboarding and service exit (blueprint §15.7)

| Step                                                                                                  | Owner | Done (date) | Evidence |
| ----------------------------------------------------------------------------------------------------- | ----- | ----------- | -------- |
| Confirm contract termination obligations                                                              | [ ]   | [ ]         | [ ]      |
| Disable future processing that is no longer authorised                                                | [ ]   | [ ]         | [ ]      |
| Return or export customer data as agreed                                                              | [ ]   | [ ]         | [ ]      |
| Remove customer access and associated secrets                                                         | [ ]   | [ ]         | [ ]      |
| Revoke Vitalos access to the customer's systems ([09](09-onboarding-and-data-access-checklist.md) §5) | [ ]   | [ ]         | [ ]      |
| Apply retention and deletion instructions                                                             | [ ]   | [ ]         | [ ]      |
| Decommission environments safely                                                                      | [ ]   | [ ]         | [ ]      |
| Keep only records that are legally or contractually necessary (list them)                             | [ ]   | [ ]         | [ ]      |
| Document completion and confirm to the customer in writing                                            | [ ]   | [ ]         | [ ]      |
