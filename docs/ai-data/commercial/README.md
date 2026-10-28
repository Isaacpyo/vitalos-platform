# Vitalos AI & Data — commercial and delivery assets

Templates, checklists and procedures for selling, delivering and operating Vitalos AI & Data engagements. They turn the private operating blueprint (VAD-OPS-001 v1.0) into forms a founder can fill in.

**Read this first**

- Everything here is a **draft** (v0.1, 28 Oct 2026). Nothing has been used with a customer. No customer, contract or payment exists yet.
- Legal and contractual templates carry a banner: _Draft template for qualified legal review. Not an executed or approved agreement._ Do not send them to anyone as terms until a qualified reviewer has been through them (AID-014).
- Prices are **proposed commercial assumptions** (AID-006): proposed list prices, configured in the Super Admin (AI & Data › Offers); not validated market rates; not published.
- This repository is **public** (AID-015). Copy a template, fill it in, and keep the filled-in version in the Super Admin or the engagement's private store. Never commit a filled-in template, a prospect's name, personal data or real spend here.
- Live records live in the Super Admin: **AI & Data › Pipeline** (opportunities, scorecards, next actions), **Offers** (proposed prices) and **Budget** (speculative spend ledger).

## Index

| #   | Asset                                                                                  | Use it when                                                                | VAD task          | FDE stage     | Review status                     |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------- | ------------- | --------------------------------- |
| 01  | [Ideal customer profile](01-ideal-customer-profile.md)                                 | Deciding who to talk to; screening a new enquiry                           | VAD-002           | Before FDE-01 | Draft; unvalidated by interviews  |
| 02  | [Qualification scorecard](02-qualification-scorecard.md)                               | Scoring an opportunity after the first conversation and after discovery    | VAD-002, VAD-004  | FDE-01–03     | Draft                             |
| 03  | [Offers](03-offers.md)                                                                 | Choosing which offer to propose; explaining scope and exclusions           | VAD-005           | FDE-03–04     | Draft; prices proposed            |
| 04  | [Customer problem brief](04-customer-problem-brief.md)                                 | Writing up a discovery conversation                                        | VAD-011           | FDE-01–02     | Draft                             |
| 05  | [Discovery questionnaire](05-discovery-questionnaire.md)                               | Running a discovery call; observing one real run of the workflow           | VAD-011           | FDE-01–02     | Draft                             |
| 06  | [Proof-of-value charter](06-proof-of-value-charter.md)                                 | Scoping an AI Proof of Value before the proposal                           | VAD-005, VAD-012  | FDE-03–05     | Draft                             |
| 07  | [Proposal template](07-proposal-template.md)                                           | Writing a proposal for any offer                                           | VAD-005, VAD-012  | FDE-04        | Draft for legal review            |
| 08  | [Statement of work template](08-statement-of-work-template.md)                         | Turning an accepted proposal into a contracted scope                       | VAD-005, VAD-012  | FDE-04        | Draft for legal review            |
| 09  | [Onboarding and data access checklist](09-onboarding-and-data-access-checklist.md)     | After contract, before kickoff; whenever access is requested or revoked    | VAD-013           | FDE-04–05     | Draft                             |
| 10  | [Security and data processing checklist](10-security-and-data-processing-checklist.md) | Risk screening every opportunity before any customer data is received      | VAD-006, VAD-013  | FDE-03 onward | Draft; procedure for VAD-006      |
| 11  | [Evaluation plan template](11-evaluation-plan-template.md)                             | Designing how an AI workflow will be proved before it is built             | VAD-009, VAD-014  | FDE-05–07     | Draft                             |
| 12  | [Production readiness checklist](12-production-readiness-checklist.md)                 | Before any production release                                              | VAD-015           | FDE-08        | Draft                             |
| 13  | [Managed service scope](13-managed-service-scope.md)                                   | Offering or contracting Managed AI Operations                              | VAD-017           | FDE-09        | Draft for legal review            |
| 14  | [Monthly managed AI report](14-monthly-managed-ai-report.md)                           | Each month of a managed service                                            | VAD-017           | FDE-09        | Draft                             |
| 15  | [Cost tracker](15-cost-tracker.md)                                                     | Approving spend; pricing a quote; closing a project's books                | VAD-004 (finance) | All           | Draft; live ledger in Super Admin |
| 16  | [Product candidate review](16-product-candidate-review.md)                             | When the same problem recurs across customers; classifying reusable assets | VAD-018, VAD-019  | FDE-10        | Draft                             |
| 17  | [Engagement retrospective](17-engagement-retrospective.md)                             | At the end of every engagement                                             | VAD-016, VAD-018  | FDE-10        | Draft                             |
| 18  | [Incident record](18-incident-record.md)                                               | Any SEV-1 or SEV-2 incident, or any suspected data exposure                | VAD-017           | FDE-09        | Draft                             |
| 19  | [Weekly and monthly review](19-weekly-and-monthly-review.md)                           | The founder's weekly review and the monthly commercial review              | All               | All           | Draft                             |
| 20  | [First-sale readiness](20-first-sale-readiness.md)                                     | Checking whether Vitalos can honestly offer its first paid assessment      | VAD-001–013       | Before FDE-01 | Current status as of 28 Oct 2026  |

## How the assets fit together

```text
Enquiry (website form) ──> Super Admin Pipeline: New → Reviewing
        │  01 ICP screen · 10 risk screen (first pass) · 02 score (first pass)
        ▼
Discovery ── 05 questionnaire · observe one real run · 04 problem brief · 02 re-score
        ▼
Qualified ── 03 choose offer · 06 PoV charter (if PoV) · 15 price check (contribution)
        ▼
Assessment/Proposal ── 07 proposal → 08 SOW (after legal review) · 10 full risk screen
        ▼
Won ── 09 onboarding and access · 11 evaluation plan · build
        ▼
Release ── 12 production readiness · 13 managed service offered
        ▼
Operate ── 14 monthly report · 18 incidents · 19 reviews
        ▼
Learn ── 17 retrospective · 16 product candidate review and asset classification
```

FDE stages: FDE-01 Discover · FDE-02 Diagnose · FDE-03 Assess · FDE-04 Contract · FDE-05 Design · FDE-06 Build · FDE-07 Evaluate · FDE-08 Deploy · FDE-09 Operate · FDE-10 Learn.

## Using a template

1. Copy the template into the engagement's private record (Super Admin notes or attachment, or the engagement's private folder). Do not edit the copy in this repository.
2. Replace every `[bracketed field]`. Delete guidance notes in _italics_ before sharing with a customer.
3. An empty field is not an approval. A checkbox is ticked only with evidence (a document, a recorded decision, a test result).
4. If a template is wrong or missing something, change the template here in a pull request so the next engagement benefits.

## Related

- [PLAN.md](../PLAN.md), [DECISIONS.md](../DECISIONS.md) (AID-006, 007, 008, 013, 014, 015), [TASKS.md](../TASKS.md)
- Demonstrator acceptance criteria, a worked evaluation plan: [engineering/demonstrator-acceptance.md](../engineering/demonstrator-acceptance.md)
