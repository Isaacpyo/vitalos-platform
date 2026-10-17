# Plan — 17 October 2026 review run

Brief: [RUN-PROMPT.md](RUN-PROMPT.md). Findings and status: [FINDINGS.md](FINDINGS.md). Decisions: [DECISIONS.md](DECISIONS.md). Discovery: [DISCOVERY.md](DISCOVERY.md). Morning report: [REPORT.md](REPORT.md).

## Branches

- Integration: `feat/review-2026-10-17`, cut from `origin/main` at `fcc5167`.
- One branch per workstream, cut from the integration branch: `review/ws1-visual`, `review/ws2-content-ia`, `review/ws3-insights`, `review/ws4-careers`, `review/ws5-measurement`, `review/ws6-relay`, `review/ws7-admin`.
- Merge order into the integration branch: WS5 → WS7 → WS6 → WS3 → WS4 → WS2 → WS1. After each merge: lint, typecheck, unit tests, Django tests, Playwright + axe.
- One PR from the integration branch to `main`, titled "Website & admin: 17 Oct review fixes", left open.

## ADR numbers reserved

| ADR | Topic | Owner |
|---|---|---|
| 044 | Brand-system hero artwork and page families | WS1 |
| 045 | Navigation variants (`current` and `ia`) and feature flags for podcast and founder section | WS2 |
| 046 | Cookie-free analytics | WS5 |
| 047 | Content Security Policy and security headers | WS5 |
| 048 | Relay retrieval budget, small talk and widget mounting (amends ADR-037) | WS6 |
| 049 | Super Admin identity model and morning Overview | WS7 |

## Shared-file ownership

| Area | Owner | Others |
|---|---|---|
| `packages/cms/src/navigation.ts`, footer config, page copy in `packages/cms/src/repo` | WS2 | request changes through the orchestrator |
| `PageHero`, `MediaSlot`, icon components, `apps/web/public` imagery, `media-slots.ts` | WS1 | — |
| `apps/web` root layout, metadata, `next.config`/middleware, sitemap, CI workflows, Playwright/axe/Lighthouse config, `track()` helper | WS5 | others call `track()`; WS5 lands it first |
| `packages/relay-*`, `apps/web/app/api/relay*`, `superadmin/apps/relay`, Relay migrations | WS6 | — |
| Insights article/author/index components in `apps/web`; Insights editor form and templates in `superadmin/apps/insights` | WS3 | WS7 does not touch the Insights editor |
| Careers role page and application form in `apps/web`; careers drafts | WS4 | — |
| Everything else in `superadmin/` (settings, accounts, team, notifications, overview, help, API docs, tables) | WS7 | — |

## Approval gates (never executed tonight)

See RUN-PROMPT.md 0.2. Each is listed with the exact next step in REPORT.md.
