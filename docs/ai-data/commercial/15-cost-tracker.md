# 15 — Cost tracker: spending controls, project ledger and contribution

Status: draft v0.1, 28 Oct 2026 · Owner: Business Lead · Supports: blueprint §17, DEC-011, DEC-012 · Decision: AID-013

> **The live ledger is the Super Admin: AI & Data › Budget** (speculative spend by category) and each opportunity's commercial fields. This file holds the rules, the field definitions and the formulas. **Never record actual spend, invoices or customer figures in this repository** (public; AID-015). All numbers below are either the blueprint's ceilings or clearly marked fictional examples.

## 1. The £1,000 speculative ceiling

Maximum initial speculative cash expenditure: **£1,000**, excluding founder time (blueprint DEC-011). It is a **cap, not a budget to spend**. Known new spend in the launch milestone: £0 (AID-013).

| Category                                   |    Ceiling | What belongs here                                                          |
| ------------------------------------------ | ---------: | -------------------------------------------------------------------------- |
| Customer outreach and acquisition          |       £200 | List data, event tickets, travel to discovery meetings                     |
| AI API and prototype experimentation       |       £150 | Model provider usage for the demonstrator and live evaluation              |
| Infrastructure and engineering development |       £150 | Hosting or tooling beyond existing free allowances                         |
| Website and business presence              |       £100 | Anything the existing site cannot already do                               |
| Contracts and administration allowance     |       £150 | Template legal review contribution, admin services                         |
| Contingency                                |       £250 | Unforeseen delivery, legal or infrastructure needs; owner approval to draw |
| **Total**                                  | **£1,000** |                                                                            |

_Client-specific costs are not speculative spend: fund them from the client's payments and record them on the project ledger (§3)._

## 2. Spending controls (blueprint §17.3)

Before any spend, all of these must be true. **Any new paid service or spend needs owner approval, even inside the ceiling** (AGENTS.md, AI & Data).

- [ ] Owner approved this item (name, date recorded in the Super Admin).
- [ ] Category has headroom; the Super Admin budget page updated **before** committing.
- [ ] Documented reason for any software subscription; a named owner for every recurring service and a cancellation date or review date.
- [ ] API usage capped in the application (per run, per day, per month) and a kill switch exists — a provider or cloud budget alert is **not** a hard cap.
- [ ] No irreversible commitment based on unsigned pipeline.
- [ ] Expensive client-specific integrations funded from client payments.
- [ ] Project budgets and speculative R&D budgets kept separate.
- [ ] Contingency kept for genuine surprises.

### Speculative spend record (fields — enter in the Super Admin)

| Field              | Meaning                                                    |
| ------------------ | ---------------------------------------------------------- |
| Date               | Date committed (not paid)                                  |
| Category           | One of the six above                                       |
| Supplier / item    | What was bought                                            |
| Amount (£)         | Including VAT if not reclaimable — _confirm VAT treatment_ |
| Recurring?         | One-off / monthly / annual; next renewal date              |
| Approved by        | Owner name and date                                        |
| Reason             | Use case it serves                                         |
| Cancel/review date | When it stops or is reviewed                               |

## 3. Project financial ledger (blueprint §17.4)

One ledger per engagement, kept with the opportunity in the Super Admin.

| Field                                           | Notes                                                     |
| ----------------------------------------------- | --------------------------------------------------------- |
| Engagement ID / offer                           |                                                           |
| Contracted amount and tax treatment             | Net, VAT, gross                                           |
| Invoices raised (date, amount)                  |                                                           |
| Cash received (date, amount)                    |                                                           |
| Payment deadlines and outstanding balance       |                                                           |
| Planned engineering hours / actual hours        | Include rework and unbilled time                          |
| Loaded internal hourly cost                     | Owner-set planning rate; cost founder time even if unpaid |
| Labour cost (hours × loaded rate)               | Planned and actual                                        |
| AI provider / API costs                         | From gateway metering                                     |
| Cloud, storage and external system costs        |                                                           |
| Specialist / contractor costs                   |                                                           |
| Transaction fees and direct expenses            | Card or payment fees, travel                              |
| Contingency                                     | Planned only                                              |
| Rework and support effort                       | Hours, after acceptance                                   |
| Contribution and margin                         | Planned and actual (§4)                                   |
| Recurring fees, obligations, cancellation dates | For managed services and subscriptions                    |

## 4. Contribution maths (blueprint §7.6)

```text
Full delivery cost = engineering hours × loaded internal hourly cost
                   + model/API usage
                   + cloud/infrastructure costs
                   + external specialists or contractors
                   + transaction fees and directly attributable expenses
                   + contingency

Project contribution        = contracted project revenue − attributable delivery costs
Project contribution margin = project contribution ÷ project revenue
Contribution per engineering hour = project contribution ÷ actual engineering hours (including rework)

Maximum hours at a target margin = price × (1 − target margin) − non-labour costs
                                   ─────────────────────────────────────────────
                                            loaded internal hourly cost
```

**Internal thresholds** (chosen management targets, to be revised with real evidence — not market facts):

- **≥ 40% planned project contribution margin.**
- **≥ 60% stabilised managed-service contribution margin.**
- Actual vs estimated hours visible on every engagement; no unlimited revisions or support.

### Worked example (fictional)

_Fictional figures for illustration. The £40/hour loaded rate is a placeholder — the owner sets the real planning rate._

**AI Proof of Value at the proposed list price of £1,500** (proposed; not validated; not published):

| Line                              |                Plan |    If hours overrun |
| --------------------------------- | ------------------: | ------------------: |
| Engineering hours                 |                  14 |                  30 |
| Labour (× £40)                    |                £560 |              £1,200 |
| Model/API usage                   |                 £10 |                 £10 |
| Hosting                           |                  £5 |                  £5 |
| Transaction fees                  |                 £25 |                 £25 |
| Subtotal                          |                £600 |              £1,240 |
| Contingency (10%)                 |                 £60 |         — (used up) |
| **Full delivery cost**            |            **£660** |          **£1,240** |
| Revenue                           |              £1,500 |              £1,500 |
| **Contribution**                  |            **£840** |            **£260** |
| **Margin**                        | **56%** (meets 40%) | **17%** (below 40%) |
| Contribution per engineering hour |                 £60 |               £8.67 |

Maximum hours at 40% margin: (£1,500 × 0.60 − £40 non-labour − £60 contingency) ÷ £40 = **20 hours**. Past that, the engagement loses its margin; scope tightly or price up.

**Managed AI Operations at the proposed £250/month** (proposed; not validated; not published):

| Line                      |            3 hours support |            2 hours support |
| ------------------------- | -------------------------: | -------------------------: |
| Labour (× £40)            |                       £120 |                        £80 |
| Hosting                   |                        £15 |                        £15 |
| Model usage               |                         £5 |                         £5 |
| **Direct cost**           |                   **£140** |                   **£100** |
| **Contribution / margin** | £110 / **44%** (below 60%) | £150 / **60%** (meets 60%) |

_Reading it: at these fictional rates the Essential tier only meets the 60% threshold with about two hours of support a month. That is why the support allowance must be stated, and why larger allowances are quoted separately._

## 5. Cash classification (blueprint §17.5)

Keep a forecast of at least 90 days of receipts, known bills and operating expenses (in the Super Admin or the accounting system). Classify every expected receipt:

| Class                        | Meaning                              | Can it fund spending now? |
| ---------------------------- | ------------------------------------ | ------------------------- |
| **Received**                 | In the bank                          | Yes                       |
| **Invoiced**                 | Invoice issued, not yet paid         | No — not until received   |
| **Contracted, not invoiced** | Signed SOW; invoice not yet due      | No                        |
| **Pipeline / uncontracted**  | Proposal, verbal yes, or opportunity | **Never**                 |

A proposal is not contracted revenue. An unsigned promise is not cash in the bank. Only actual available liquidity is used for spending decisions.

## 6. Monthly close checklist

- [ ] Super Admin budget page matches bank and card statements for AI & Data spend.
- [ ] Model usage from gateway metering agrees with the provider's usage page (when a key exists).
- [ ] Each active engagement: actual hours and costs entered; margin recalculated.
- [ ] Receipts classified (§5); 90-day forecast updated.
- [ ] Recurring services reviewed; anything unused cancelled.
