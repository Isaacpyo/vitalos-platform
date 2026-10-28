# AI & Data (`apps.aidata`)

The internal side of Vitalos AI & Data (docs/ai-data/, AID-003, AID-004, AID-006, AID-013, AID-015): the opportunity pipeline, the proposed offer prices and the speculative budget. URL prefix `/ai-data/`, namespace `aidata`. Live records (opportunities, contacts, costs) live only in the Super Admin database, never in the public repository.

Business rules: `services.py` (every write: authorised, validated, audited), `selectors.py` (reads, access rules, budget totals), `scoring.py` (pure scorecard maths), `intake.py` (pure parsing of the website notification). Views only call these.

## Pages and permissions

| URL                                                   | What                                                                                                               | Who                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `/ai-data/`                                           | Overview: cards to Pipeline, Offers, Budget and Demonstrator (`/ai-data/demonstrator/`, apps.recon_demo); counts by stage, overdue next actions, budget used vs ceiling | SuperAdmin, ServiceLead                         |
| `/ai-data/pipeline/`                                  | Opportunities table (stacked cards on mobile), stage tabs, filters: owner, sector, overdue, search                | SuperAdmin, ServiceLead                         |
| `/ai-data/pipeline/new/`                              | Create an opportunity by hand (referral, outbound, partner)                                                         | SuperAdmin, ServiceLead                         |
| `/ai-data/pipeline/OPP-0001/`                         | Details form, stage change and history, scorecard with a live server-side preview, internal notes, source enquiry | SuperAdmin, ServiceLead (reopen: SuperAdmin)    |
| `/ai-data/from-enquiry/VIT-0001/` (POST)              | "Create opportunity" on an enquiry; opens the existing one if there is one                                         | SuperAdmin, ServiceLead                         |
| `/ai-data/offers/`, `/ai-data/offers/<key>/edit/`     | Proposed offer prices, with the banner "Proposed commercial assumptions — not validated market rates, not published" | View: both roles. Edit: SuperAdmin              |
| `/ai-data/budget/`, `…/ceilings/`, `…/costs/…`        | Budget by category: actual, planned, committed, remaining; warns at 80 % and over the ceiling                      | View: both roles. Edit: SuperAdmin              |

Anonymous users are sent to sign-in; Viewers and users without a role get 403. Every change is a POST with a CSRF token and writes an audit event (`aidata.*` in `apps/audit/services.py`). Audit summaries carry references, field names and amounts, never contact details or note text. The models do not use django-simple-history: stage history is its own table (`StageChange`), and history rows would keep personal data past retention.

## Pipeline rules

- Reference `OPP-0001`, allocated from the `PipelineSettings` counter (as `VIT-` enquiry numbers).
- Stages: New, Reviewing, Discovery, Qualified, Assessment / Proposal, Won, Lost, On hold. Moves only through `services.change_stage()` and the `TRANSITIONS` map. Won is reachable only from Assessment / Proposal. Won and Lost are terminal; a SuperAdmin can reopen them to Reviewing (with a reason). On hold returns to any active stage.
- Won, Lost and On hold need an outcome reason. Won also needs the signed-scope reference, typed by a person; it is never set automatically.
- Scorecard (blueprint §7.4): six criteria scored 0–5 — problem severity and frequency 25 %, verified economic impact 20 %, budget and buying authority 20 %, data and integration readiness 15 %, delivery feasibility 10 %, reuse and market potential 10 %. Score = Σ(score ÷ 5 × weight), a `Decimal` rounded half up to one decimal. Bands: ≥ 80 Proposal candidate, 65–79.9 More discovery or narrower scope, < 65 Decline or defer, any criterion blank → Not scored. A risk override (reason required) forces Blocked by risk.
- The customer-visible summary is labelled "May be shared with the customer"; internal notes and `OpportunityNote` are internal only.
- An opportunity with an offer and no estimated value takes the offer's proposed price (labelled an estimate).

## Intake contract (enquiry → opportunity)

The enquiry ingest (`apps/enquiries/ingest.py`) keeps `X-Vitalos-Pipeline` and `X-Vitalos-Offer`. When a **new** enquiry is filed from **our own form relay** (from a vitalos.co.uk address with `X-Vitalos-Form` or `X-Vitalos-Notification`) and it carries `X-Vitalos-Pipeline: ai-data`, the ingest calls `services.create_from_enquiry(enquiry, offer=<X-Vitalos-Offer>)`:

- Stage New, source Website form, contact from the enquiry (the person in Reply-To), website reference from `X-Vitalos-Reference`, offer only if it is a known offer key.
- Next action "Review enquiry and reply", due the next working day (Monday to Friday; UK bank holidays are not considered).
- Sector, problem, current tools, desired outcome and budget band are read from the composed goal text (docs/ai-data/PLAN.md); organisation, role and timeframe from the notification's detail rows. Anything unreadable stays blank; without the composed goal the whole text (truncated to 4,000 characters on a word boundary) becomes the problem summary.
- Idempotent: one opportunity per enquiry (unique link); a second call returns the existing one.
- It never fails the ingest: an error is logged with the enquiry reference and error type only, and "Create opportunity" on the enquiry does the same job by hand.

The header is ignored on mail from anyone else, so an outside sender cannot open opportunities.

## Budget

`BudgetSettings` holds the £1,000 speculative ceiling and the category ceilings (outreach and acquisition £200, AI API and prototyping £150, infrastructure and engineering £150, website and presence £100, contracts and admin £150, contingency £250). `CostEntry` records actual, planned and recurring-commitment costs; a commitment counts for 12 months of payments (monthly × 12, annual × 1). Remaining = ceiling − (actual + planned + committed). Nothing is seeded: known spend is £0. The page says plainly that a cloud budget alert is not a spending cap, and recording a cost does not approve it.

## Retention

Opportunities hold personal data. `python manage.py aidata_retention` lists opportunities closed (Won, Lost or On hold, counted from `closed_at`) more than 24 months ago, matching the enquiries' 24-month policy. With `--apply` it anonymises them: contact name `[removed]`, email and role cleared, internal notes and every note body replaced with `[removed]`, `anonymised_at` set, one `aidata.anonymised` audit event each. The commercial record (title, stage, scores, value, dates) stays. It is a dry run without `--apply`, and it is **not scheduled**: scheduling it is a separate, owner-visible step (dry-run first and record the row count, per AGENTS.md).

## Tests

`tests/test_aidata_scoring.py`, `test_aidata_pipeline.py`, `test_aidata_intake.py`, `test_aidata_views.py`, `test_aidata_budget_retention.py`.
