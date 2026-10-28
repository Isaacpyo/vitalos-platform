# 01 — Ideal customer profile and priority sectors

Status: draft v0.1, 28 Oct 2026 · Owner: Business Lead · Supports: VAD-002 · Decision: AID-007

> **This profile is a hypothesis.** No customer interview has tested it yet. It is chosen from the blueprint's reasoning, not from market evidence. Revisit it after the first 10 discovery conversations (VAD-011), using the evidence list at the end.

## 1. One-line profile

A **UK bookkeeping or accounting practice of about 2–15 staff** (or a small outsourced finance team) whose owner can approve a modest scoped project, and which spends material staff time each month reconciling **supplier statements against purchase ledgers** and chasing the exceptions.

## 2. Firmographics

| Attribute      | Target                                                                                               | Acceptable range                           | _Why_                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Country        | United Kingdom                                                                                       | UK only for now                            | _One legal and tax regime; UK GDPR/PECR questions answered once._                                 |
| Sector         | Bookkeeping and accounting practices; outsourced finance/back-office teams                           | Small in-house finance teams in other SMEs | _AID-007: structured data, repetitive measurable work, owner usually holds the budget._           |
| Headcount      | 2–15                                                                                                 | Up to ~100 for general screening           | _Small enough for the owner to decide; large enough to have recurring volume._                    |
| Clients served | Enough supplier-heavy client books that reconciliation is a recurring task                           | —                                          | _Volume is what makes the time saving matter._                                                    |
| Systems        | Cloud or desktop accounting software that can export ledgers (CSV or similar)                        | Spreadsheets, if exports are consistent    | _The demonstrator reads CSV/text exports; no live integration needed for a first proof._          |
| Data           | Supplier statements (PDF/CSV/email) and purchase-ledger exports they can lawfully share for the work | —                                          | _Bounded, mostly business data; personal data is limited (sole-trader suppliers, contact names)._ |
| Procurement    | Owner signs; no formal tender                                                                        | Simple supplier onboarding form            | _A £350 assessment cannot carry an enterprise procurement process._                               |

## 3. Buyer and users

| Role                 | Who, typically                                                                               | What they care about                                                   | Their likely objections                                                        |
| -------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Economic buyer       | Practice owner / managing partner                                                            | Staff capacity, month-end deadlines, client service, professional risk | "We already have Dext/AutoEntry/Hubdoc"; "AI makes mistakes"; client data risk |
| Day-to-day user      | Bookkeeper / accounts assistant                                                              | Fewer tedious matches, clear exceptions, nothing lost                  | "Will it make more work checking it?"; change to routine                       |
| Approver of data use | Owner (as controller for client data, or under client engagement terms — _confirm per case_) | Confidentiality, professional obligations, where data goes             | Model providers, retention, offshore processing                                |
| Influencer           | External IT provider, software reseller                                                      | Integration, security, not breaking existing tools                     | Support burden                                                                 |

_Ask in discovery who actually signs, who uses it daily and who can authorise data use. They may be one person; record the roles separately anyway._

## 4. Buying triggers

Signs that an organisation has a reason to act now:

- [ ] Month-end or year-end backlog; staff overtime on reconciliation.
- [ ] Staff vacancy or a leaver who did the reconciliation work.
- [ ] Recent error: a missed supplier invoice, duplicate payment or statement dispute.
- [ ] Growth in client numbers without growth in headcount.
- [ ] Moving accounting software, or a new client with messy supplier records.
- [ ] Existing capture tools in place but statement-to-ledger matching still manual.

## 5. Disqualifiers (decline or defer)

Any one of these normally means **do not pursue now**. Record the reason in the pipeline.

- [ ] No one with budget authority will take part.
- [ ] Cannot lawfully share representative data for the work, or will not say who owns it.
- [ ] Problem volume is too small for any offer to pay back (see the value test in [03-offers.md](03-offers.md)).
- [ ] Expects guaranteed accuracy, fully autonomous posting to the ledger or payments, or 24/7 support at entry price.
- [ ] Needs certifications, accreditation or insurance levels Vitalos does not hold (do not imply them).
- [ ] The real need is generic invoice capture already solved by an off-the-shelf tool they could buy cheaply. _Say so; recommend the tool._
- [ ] Workflow involves high-risk processing (special category data, vulnerable people, consequential automated decisions) beyond a safe first engagement — see [10-security-and-data-processing-checklist.md](10-security-and-data-processing-checklist.md).
- [ ] Relationship conflict: an existing Vitalos client or partner relationship that makes the work inappropriate.

## 6. Priority sectors

| Priority  | Sector                                             | Lead workflow hypothesis                                                            | Why this order                                                                                                                                                                                                                                                                                                          |
| --------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (now)   | Bookkeeping, accounting, outsourced finance        | Supplier statement reconciliation with exception review (the demonstrator, AID-008) | Highest-ranked candidate in the blueprint's (subjective) scoring; bounded, structured data; measurable minutes-per-statement baseline; owner-buyer; demonstrator already shows the AI/deterministic split. **Risk:** crowded market (Dext, AutoEntry, Hubdoc) — the wedge must be matching and exceptions, not capture. |
| 2 (later) | Property management and lettings                   | Maintenance request triage; tenant/landlord document handling                       | Recurring admin, many documents. **Held back:** more personal data about tenants (higher privacy risk), fragmented systems, and enquiry/inbox workflows overlap Vitalos Workforce (keep the businesses distinct).                                                                                                       |
| 3 (later) | Automotive services and garages                    | Enquiry capture and booking follow-up; quotation turnaround                         | Enquiry-driven, owner-buyer. **Held back:** enquiry recovery overlaps Workforce; voice/receptionist options carry telephony cost and consent issues; generic CRM tools make simple automation easy to copy.                                                                                                             |
| —         | Construction, trades, field services, general SMEs | Quotation drafting, job scheduling, reporting                                       | Respond to inbound enquiries case by case; do not target until a sector earns it with evidence.                                                                                                                                                                                                                         |

_Do not target several sectors at once. A second sector is opened only when the first has either produced paid work or been ruled out with evidence._

## 7. Segment rationale and uncertainty

**Why this segment (AID-007):** document and reconciliation work scored highest in the blueprint's pre-FDE ranking; its worked revenue example is a bookkeeping practice; the buyer usually controls budget; the data is structured and bounded; the work is repetitive and measurable; and the demonstrator (supplier statement reconciliation) shows deterministic arithmetic with AI only where layouts vary.

**What we do not know:**

| Assumption                                                                | Confidence | How we will test it                                                        |
| ------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| Practices spend enough time on statement reconciliation to pay for help   | Low        | Baseline questions in discovery (minutes per statement × statements/month) |
| Existing capture tools leave statement-to-ledger matching largely manual  | Low        | Ask which tools they use and what remains manual; observe one real run     |
| Owners will pay for a £350 assessment before seeing a solution            | Unknown    | Ask directly in discovery; record willingness-to-pay evidence              |
| Practices can lawfully share sample statements and ledger exports with us | Medium     | Ask who owns the data and under what client terms; record the answer       |
| 2–15 staff is the right size band                                         | Low        | Compare volume and budget answers across sizes                             |
| A partner channel (software resellers, IT providers) would refer work     | Unknown    | Ask buyers who they take advice from                                       |

## 8. Evidence that would change this profile

After each discovery conversation, record which of these appeared. Review at 10 conversations (VAD-011) in the monthly commercial review.

- **Strengthens:** ≥3 of 10 practices describe the same reconciliation pain with a measured baseline; ≥1 agrees to a paid assessment; data access is straightforward.
- **Narrows:** pain exists but only above a certain size or client mix → move the headcount band.
- **Shifts workflow:** practices consistently name a different costly workflow (for example client onboarding documents, VAT preparation checks) → re-score that workflow with [02-qualification-scorecard.md](02-qualification-scorecard.md) and log a decision.
- **Weakens:** most say existing tools already solve it, or no one will pay before seeing results, or data cannot be shared → consider sector 2 or a different entry offer; log the decision in `DECISIONS.md`.

| Date   | Conversations to date | What changed | Decision / log entry |
| ------ | --------------------- | ------------ | -------------------- |
| [date] | [n]                   | [summary]    | [AID-nnn or "none"]  |
