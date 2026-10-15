# Plan: Insights and Careers

Brief: `BRIEF.md`. Architecture: ADR-039 to ADR-042. Contract: `contracts/content-api/v1/`. Choices: `DECISIONS.md`.

## Workstreams

| Workstream                                                                                               | Owner area                                                  | Phases |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| Contract, docs and ADRs                                                                                  | `contracts/`, `docs/`                                       | 0      |
| Admin core: signing, outbox, read API, tick, Insights admin                                              | `superadmin/apps/{content_sync,insights}`                   | 1, 2   |
| Website core: client, cached readers, revalidate, render, preview, lookup, tick routes, proxy            | `apps/web/src/features/content`, `apps/web/app/api/content` | 1      |
| Website Insights: index, article, topics, authors, feed, sitemap, OG, homepage section, `/blog` redirect | `apps/web`                                                  | 3      |
| Admin Careers: roles, applications, settings, alerts, retention, upload tickets                          | `superadmin/apps/careers`                                   | 4      |
| Website Careers: `/careers`, role pages, application form (A9), JSON-LD, homepage section                | `apps/web`                                                  | 4      |
| Integrations: repo import, Relay hook, footer and About links, Worker cron                               | both                                                        | 5      |
| Hardening: security review, E2E sync, availability and careers suites, load test, runbook, PR            | all                                                         | 6      |

The admin and website workstreams run in parallel against the contract.

## Phase status

- [x] Phase 0: discovery, decisions, ADR-039 to ADR-042, contract and fixtures
- [ ] Phase 1: contract and plumbing (admin and website)
- [ ] Phase 2: Insights admin
- [ ] Phase 3: Insights website and homepage section (open the PR)
- [ ] Phase 4: Careers
- [ ] Phase 5: Integrations
- [ ] Phase 6: Hardening and handover

## Local runs (AGENTS.md: no Docker or Supabase on the laptop)

- **Admin:** `cd superadmin && .venv/Scripts/python manage.py runserver 127.0.0.1:8010` with `DJANGO_SETTINGS_MODULE=config.settings.dev`, on SQLite (or a VM slot's Postgres for Postgres-only tests).
- **Website:** `pnpm --filter @vitalos/web build && pnpm --filter @vitalos/web start -p 3010`. Tags and ISR need a production build.
- **E2E:** Playwright drives both apps, with signing keys set to test values in the environment of each process.
