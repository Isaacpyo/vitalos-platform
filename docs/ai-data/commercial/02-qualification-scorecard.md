# 02 — Opportunity qualification scorecard

Status: draft v0.1, 28 Oct 2026 · Owner: Business Lead · Supports: VAD-002, VAD-004, VAD-011 · FDE-01 to FDE-03

Score every opportunity twice: a **first pass** after the enquiry or first call (many scores will be low because they are unknown), and a **discovery score** after the discovery conversation. Only the discovery score decides whether to propose.

> **The same maths runs in the Super Admin** (AI & Data › Pipeline › opportunity › Scorecard). Enter the six scores there; it stores the history and shows the band. If the Super Admin and this document ever disagree, treat it as a defect and fix whichever is wrong.

## 1. Formula

Each dimension is scored 0–5 (whole numbers). The weighted score out of 100 is:

```text
Score = Σ ( dimension score ÷ 5 × weight )
```

| Dimension                           |  Weight |
| ----------------------------------- | ------: |
| A. Problem severity and frequency   |      25 |
| B. Verified economic impact         |      20 |
| C. Budget and buying authority      |      20 |
| D. Data and integration readiness   |      15 |
| E. Delivery feasibility             |      10 |
| F. Reuse and wider market potential |      10 |
| **Total**                           | **100** |

_Score what you have evidence for, not what you hope. Unknown = score as if absent (usually 0 or 1) and note the question to ask._

## 2. Anchors for every score

### A. Problem severity and frequency (25)

| Score | Anchor                                                                                                                             |
| ----: | ---------------------------------------------------------------------------------------------------------------------------------- |
|     0 | No identifiable operational problem; curiosity about AI only.                                                                      |
|     1 | Problem mentioned but occasional (a few times a year) or trivial in effort.                                                        |
|     2 | Recurring monthly but small (under ~2 staff hours/month) or tolerated without complaint.                                           |
|     3 | Recurring weekly or monthly, noticeable effort (roughly 2–10 hours/month), causes some errors or delay.                            |
|     4 | Frequent, significant effort (roughly 10–30 hours/month) or causes visible errors, backlog or client complaints.                   |
|     5 | Daily or high-volume, large effort (over ~30 hours/month) or causes material financial or client risk; owner raises it unprompted. |

### B. Verified economic impact (20)

| Score | Anchor                                                                                                                                               |
| ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
|     0 | No way to estimate value.                                                                                                                            |
|     1 | Value asserted ("it takes ages") with no numbers.                                                                                                    |
|     2 | Rough estimate from the buyer, no baseline measure.                                                                                                  |
|     3 | Baseline estimated with volumes and time per item from the people doing the work; value separated into cash vs capacity vs revenue.                  |
|     4 | Baseline measured or observed (one real run watched, or records counted); value covers the proposed fee within ~12 months on a stated basis.         |
|     5 | Measured baseline plus documented cost of errors or lost revenue; value clearly exceeds the full engagement cost, buyer agrees with the calculation. |

_Released staff time is capacity, not cash, unless the buyer says how it becomes cash (overtime avoided, a hire not made, more clients served)._

### C. Budget and buying authority (20)

| Score | Anchor                                                                                                        |
| ----: | ------------------------------------------------------------------------------------------------------------- |
|     0 | Contact has no authority and cannot reach anyone who does; no budget.                                         |
|     1 | Contact is a user or influencer; decision-maker not identified.                                               |
|     2 | Decision-maker identified but not engaged; budget unknown.                                                    |
|     3 | Decision-maker engaged; budget "possible" but not confirmed; indicative band given.                           |
|     4 | Decision-maker engaged and states a budget that covers the proposed offer; knows the buying process.          |
|     5 | Decision-maker has confirmed budget and timing in writing (email) and agreed the next paid step in principle. |

### D. Data and integration readiness (15)

| Score | Anchor                                                                                                                       |
| ----: | ---------------------------------------------------------------------------------------------------------------------------- |
|     0 | Data needed does not exist, or cannot lawfully be shared.                                                                    |
|     1 | Data exists but ownership or permission is unclear; no samples possible yet.                                                 |
|     2 | Data exists, owner identified; exports possible but inconsistent; permission not yet confirmed.                              |
|     3 | Representative samples can be provided with permission; export format known; personal data limited and identified.           |
|     4 | Samples available now via an approved route; formats consistent; integration not needed for a proof (file export is enough). |
|     5 | As 4, plus stable API or export for production and an identified person to authorise access.                                 |

### E. Delivery feasibility (10)

| Score | Anchor                                                                                                         |
| ----: | -------------------------------------------------------------------------------------------------------------- |
|     0 | Outside Vitalos capability or needs prohibited autonomy (e.g. unreviewed payments).                            |
|     1 | Possible only with specialists or technology Vitalos does not have; high uncertainty.                          |
|     2 | Feasible but needs a complex integration or many unknowns before a proof.                                      |
|     3 | Feasible with known techniques; some uncertainty in document variety or rules.                                 |
|     4 | Close to an existing pattern (e.g. the reconciliation demonstrator); rules known; human review fits naturally. |
|     5 | Existing pattern applies almost directly; can be evaluated with a held-out set the customer can label.         |

### F. Reuse and wider market potential (10)

| Score | Anchor                                                                                                                                 |
| ----: | -------------------------------------------------------------------------------------------------------------------------------------- |
|     0 | Entirely bespoke; nothing reusable; no similar buyers.                                                                                 |
|     1 | Reusable know-how only.                                                                                                                |
|     2 | Some reusable components, but the workflow is unusual.                                                                                 |
|     3 | Same problem likely in other firms of this type; components reusable with configuration.                                               |
|     4 | Fits the priority segment and the reconciliation core; contract terms likely allow reuse of Vitalos components.                        |
|     5 | Same need already heard from other independent businesses; strong product-candidate signal (see [16](16-product-candidate-review.md)). |

## 3. Decision bands

| Score  | Band                                    | Action                                                                                                                                    |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 80–100 | High-priority proposal candidate        | Choose the offer ([03](03-offers.md)), run the full risk screen ([10](10-security-and-data-processing-checklist.md)), draft the proposal. |
| 65–79  | More discovery or narrower scope needed | Name the weakest dimension and the one question or test that would raise it; consider the £350 assessment as the next step.               |
| < 65   | Normally decline or defer               | Record the reason; set a review date if circumstances could change; recommend alternatives where honest.                                  |

## 4. Risk override

The score never overrides a risk. **Stop or decline regardless of score** when any of these is unresolved:

- [ ] Unacceptable legal risk (no lawful basis or permission for the data; terms we cannot meet).
- [ ] Unacceptable security risk (an unresolved critical issue; demand for credentials over informal channels).
- [ ] Unacceptable technical risk (AI would take consequential actions without safeguards; cannot be evaluated).
- [ ] Unacceptable financial risk (unpriced scope, unfunded commitments, exposure beyond approved limits).
- [ ] Any stop condition in [10-security-and-data-processing-checklist.md](10-security-and-data-processing-checklist.md) §3.

Record an override in the Super Admin opportunity notes with the reason and who decided.

## 5. Worked example (fictional)

_Fictional organisation for illustration only. Not a prospect._

"Example Practice A": a bookkeeping practice of 8 staff. Two bookkeepers reconcile around 120 supplier statements a month; they estimate 12 minutes each (about 24 hours/month), plus chasing exceptions. The owner joined the call and said a few hundred pounds for an assessment is "within what I can sign off". They can export purchase ledgers as CSV, but have not yet confirmed whether their client engagement letters allow sharing statements with a subcontractor.

| Dimension                         | Score | Evidence                                                 |            Weighted |
| --------------------------------- | ----: | -------------------------------------------------------- | ------------------: |
| A. Problem severity and frequency |     4 | ~24 h/month, monthly deadline pressure                   | 4 ÷ 5 × 25 = **20** |
| B. Verified economic impact       |     3 | Estimate from the people doing it; not yet observed      | 3 ÷ 5 × 20 = **12** |
| C. Budget and buying authority    |     4 | Owner engaged; budget covers assessment                  | 4 ÷ 5 × 20 = **16** |
| D. Data and integration readiness |     3 | CSV exports exist; permission to share not yet confirmed |  3 ÷ 5 × 15 = **9** |
| E. Delivery feasibility           |     4 | Matches the demonstrator pattern                         |  4 ÷ 5 × 10 = **8** |
| F. Reuse and market potential     |     4 | Priority segment, reconciliation core                    |  4 ÷ 5 × 10 = **8** |
| **Total**                         |       |                                                          |              **73** |

**Band:** 65–79 — more discovery or narrower scope. **Weakest areas:** B and D. **Next step:** observe one real reconciliation run (raises B), ask the owner to confirm the data-sharing position under their client terms (raises D), then re-score. A paid £350 assessment is a reasonable proposal if both improve. No risk override applies yet; data permission must be resolved before any sample is received.

## 6. Scoring record (copy into the Super Admin notes)

| Field                               | Value                               |
| ----------------------------------- | ----------------------------------- |
| Opportunity reference               | [Super Admin reference]             |
| Pass                                | [First pass / Discovery / Re-score] |
| Date and scorer                     | [date] · [name/role]                |
| A / B / C / D / E / F               | [ ] / [ ] / [ ] / [ ] / [ ] / [ ]   |
| Weighted score                      | [nn]                                |
| Band                                | [80–100 / 65–79 / < 65]             |
| Risk override?                      | [No / Yes — reason]                 |
| Weakest dimension and next question | [text]                              |
| Decision and next action            | [text, owner, date]                 |
