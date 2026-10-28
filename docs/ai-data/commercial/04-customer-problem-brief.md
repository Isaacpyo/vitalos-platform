# 04 — Customer problem brief (Template A)

Status: draft v0.1, 28 Oct 2026 · Supports: VAD-011 · FDE-01 Discover, FDE-02 Diagnose · Exit gate: customer confirms the problem

_Write this within a day of the discovery conversation, from the notes in [05-discovery-questionnaire.md](05-discovery-questionnaire.md). Keep it to two pages. Store the filled-in brief in the Super Admin opportunity, never in this repository. Placeholders are not approvals._

---

# Customer Problem Brief

| Field                       | Value                                                  |
| --------------------------- | ------------------------------------------------------ |
| Client                      | [organisation — kept in the Super Admin only]          |
| Opportunity / engagement ID | [Super Admin reference]                                |
| Business sponsor            | [name, role]                                           |
| Technical owner (Vitalos)   | [name]                                                 |
| Date / version              | [date] · v[n]                                          |
| Sources                     | [call on date · observed run on date · documents seen] |

## 1. Workflow

| Item                                  | Detail                                                                  | _Guidance_                                                       |
| ------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Current business process              | [steps, start and end point]                                            | _One workflow only. Name the trigger and the finished output._   |
| Frequency / volume                    | [n per day/week/month; seasonality]                                     | _Prefer counted volumes to estimates; say which._                |
| Employees / roles involved            | [roles and headcount]                                                   | _Roles, not names._                                              |
| Systems and documents                 | [software, file types, where documents arrive]                          |                                                                  |
| Current time / cost baseline          | [minutes per item × volume = hours/month; source: observed / estimated] | _See baseline table in 05._                                      |
| Common errors and exceptions          | [types, how often, how found]                                           |                                                                  |
| Existing software and attempted fixes | [tools tried, what they did and did not solve]                          | _Include off-the-shelf tools. If one already solves it, say so._ |

## 2. Commercial value

| Item                                 | Detail                                           | _Guidance_                                                                |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Primary pain point                   | [one sentence in the customer's words]           |                                                                           |
| Proposed measurable improvement      | [metric, baseline → target]                      | _E.g. minutes per statement 12 → 4; exceptions found before payment run._ |
| Cash savings                         | [£/month and how it becomes cash, or "none"]     | _Released time is not cash unless the buyer says how._                    |
| Released capacity                    | [hours/month × loaded cost = £ capacity]         |                                                                           |
| Revenue improvement                  | [£ or "none identified"]                         |                                                                           |
| Risk reduction / quality improvement | [errors avoided, client complaints, audit trail] |                                                                           |
| Buyer and purchasing authority       | [who signs; up to what amount; process]          |                                                                           |
| Budget / willingness-to-pay evidence | [what they said or wrote, date]                  | _Quote or paraphrase; "seemed keen" is not evidence._                     |

## 3. Technical and legal feasibility

| Item                                 | Detail                                                                  | _Guidance_                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Required data                        | [data items and samples needed]                                         |                                                                                           |
| Data owner and permission            | [who owns it; on what basis they can share it with Vitalos; confirmed?] | _For a practice: their client terms may govern this. Do not receive data until resolved._ |
| Personal data involved               | [categories, or "none expected"]                                        | _Feeds the risk screen in 10._                                                            |
| Integration dependencies             | [exports, APIs, systems; file export enough for a proof?]               |                                                                                           |
| Human approval needs                 | [which outputs need a person before use]                                |                                                                                           |
| Security and compliance risks        | [initial risk class: Low / Moderate / High, with reason]                |                                                                                           |
| Non-AI alternatives                  | [rules, existing tool features, process change]                         | _Always consider. If a rule or a setting fixes it, recommend that._                       |
| Role of AI vs deterministic software | [where a model helps; where arithmetic/rules must decide]               |                                                                                           |

## 4. Decision

| Item                       | Detail                                                                   |
| -------------------------- | ------------------------------------------------------------------------ |
| Qualification score        | [nn / 100, band — from 02; date]                                         |
| Risk override              | [none / reason]                                                          |
| Recommended next step      | [assessment / PoV / tool recommendation / decline / more discovery]      |
| Open questions             | [list]                                                                   |
| Owner and due date         | [name] · [date]                                                          |
| Customer confirmed problem | [ ] Yes, on [date] by [role], via [email/call note] — _FDE-01 exit gate_ |
