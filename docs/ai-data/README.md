# Vitalos AI & Data

Vitalos AI & Data is the applied AI and data engineering business of Vitalos, serving UK SMEs. Its operating model: client-funded engineering → measurable customer outcomes → managed operations → reusable capabilities → products, only when repeated paid demand supports them.

This folder is the working record for the first launch milestone (blueprint VAD-OPS-001 v1.0, VAD-001 to VAD-010). The blueprint itself is a private owner document; this folder holds what the repository needs to build, run and continue the work.

| Read                                                    | For                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| [PLAN.md](PLAN.md)                                      | Scope, architecture, workstreams, completion checklist and checkpoint |
| [TASKS.md](TASKS.md)                                    | VAD-001 to VAD-019 task register with status and evidence             |
| [DECISIONS.md](DECISIONS.md)                            | Decision log (AID-nnn) and assumptions                                |
| [engineering/](engineering/)                            | AI core, demonstrator, acceptance criteria                            |
| [evaluation/](evaluation/)                              | Versioned evaluation reports                                          |
| [operations/](operations/)                              | Runbook: configuration, monitoring, costs, recovery                   |
| [commercial/](commercial/)                              | ICP, offers, templates and checklists (drafts for review)             |
| [ADR-052](../adr/ADR-052-vitalos-ai-data-foundation.md) | The architecture decision                                             |

## What exists and where

| Piece                                                          | Where                                                       | Runs at                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| Public site (Home, Solutions, Approach, Demonstrator, Contact) | `apps/web/app/(ai-data)/ai-data/`                           | https://vitalos.co.uk/ai-data                     |
| Enquiry intake                                                 | Existing website enquiry pipeline (ADR-019), AI & Data form | Supabase record + outbox + email                  |
| Opportunity pipeline, offers, budget                           | `superadmin/apps/aidata/`                                   | https://admin.vitalos.co.uk/ai-data/              |
| AI Engineering Core (gateway, metering, evaluation)            | `superadmin/apps/aicore/`                                   | Library + Super Admin                             |
| Demonstrator: supplier statement reconciliation                | `superadmin/apps/recon_demo/`                               | https://admin.vitalos.co.uk/ai-data/demonstrator/ |

## Boundaries

- Separate from **Vitalos Workforce** (its own repository and product). Nothing here depends on Workforce release plans.
- Demonstration data is synthetic and labelled. No customer, prospect or client data is stored in this repository.
- Prices in this folder and in the Super Admin are **proposed commercial assumptions**, not validated market rates, and are not published on the website.
- Templates are drafts. Legal and contractual templates need qualified review before use; none is an executed or approved agreement.
