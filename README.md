# Vitalos Platform

Private production-platform monorepo for **Vitalos: Technology Consulting, Engineering & Digital Transformation**. The immediate product is the replacement corporate website; the repository establishes boundaries for later applications and services without deploying premature distributed infrastructure.

## Status (10 Oct 2026)

- Stage 0 foundation: done.
- Stage 1 engineering build: complete on the `stage-1` integration branch, pending owner review and merge to `main`.
- No launch gate is fully met; most remaining work is owner input (content, legal identity, provider accounts, brand approvals).
- No production site, DNS, CMS dataset, database or deployment is changed by this repository.
- Super Admin (`superadmin/`): Phase 1 and 1.5 built and tested; deployment to `admin.vitalos.co.uk` was pre-approved in the founder's build brief of 10 Oct 2026 (`superadmin/docs/DEPLOY.md`).

Details: [`docs/delivery/stage-status.md`](docs/delivery/stage-status.md) (what exists, gates G0-G10) and [`docs/delivery/owner-decisions.md`](docs/delivery/owner-decisions.md) (what the owner must provide).

## What is in the repository

- `apps/web`: server-first Next.js 16 site. All routes of the information architecture, an enquiry pipeline (Postgres record plus durable outbox, Turnstile, rate limiting), SEO, redirects, security headers and publication gates. Reads content through a `ContentSource` (`empty`, `fixtures` or `sanity`).
- `apps/studio`: isolated Sanity Studio built from governed schemas in `@vitalos/cms`. Not deployed.
- `apps/storybook`: private component workbench (not deployed).
- `packages/*`: `design-tokens`, `ui`, `cms` (routes, locked copy, gates, queries, fixtures, schemas), `config` (validated environment), `validation`, `security`, `observability`, `testing`.
- `supabase`: local PostgreSQL 17 configuration, three migrations and pgTAP tests.
- `superadmin`: internal Django Super Admin for the Vitalos company architecture (`admin.vitalos.co.uk`); see `superadmin/README.md` and ADR-026.
- `tests`, `tooling`: Playwright, axe, budget and integration suites; check and helper scripts.
- `infra`, `services`, `workers`: policy placeholders only; nothing is provisioned or extracted.

Without Sanity or Supabase configuration the site builds and runs on the empty content source with enquiries disabled: an honest empty state, not placeholder content.

## Start

Install Node 24 LTS and enable Corepack. Every environment variable is optional locally (`.env.example` documents them).

```sh
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev:web          # http://localhost:3000
```

Use `corepack pnpm check` before a pull request, plus `build`, `storybook:build` and the relevant test suites. All commands, content sources, the local Supabase stack and the test matrix are in [`docs/operations/local-development.md`](docs/operations/local-development.md); contribution rules are in `CONTRIBUTING.md`.

## Documentation map

| Topic                   | Where                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Decisions               | [`docs/adr/`](docs/adr/README.md) (ADR 001-022 indexed)                                                                                 |
| Architecture            | `ARCHITECTURE.md`, `docs/architecture/` (containers, data ownership, dependency rules, enquiry sequence, environments, future services) |
| Content and editorial   | `docs/cms/content-model.md`, `docs/cms/editorial-workflow.md`                                                                           |
| Delivery                | `docs/delivery/` (Stage 1 plan, launch gates, stage status, owner decisions)                                                            |
| Operations and runbooks | `docs/operations/` (local development, deployment, observability), `docs/runbooks/` (cutover, rollback, enquiry delivery failure)       |
| Security                | `SECURITY.md`, `docs/security/` (threat model, secret management)                                                                       |
| Brand and SEO           | `docs/brand/`, `docs/seo/redirect-inventory.md`                                                                                         |

## Sources of truth

Code owns production behaviour and locked copy; Sanity owns routine editorial content; Supabase/PostgreSQL owns operational records; Figma owns approved visual composition; controlled evidence does not belong in the public CMS. Approved Stage 7-11 documents in the private Vitalos Drive govern brand, information architecture, experience, build and design handoff.

## Rules that matter

- Applications never import another application's source; use `@vitalos/*` public entrypoints (`corepack pnpm check:boundaries` enforces it).
- Never commit secrets or real enquiry or client data; fixtures are artificial.
- Production deploys, DNS changes, secret rotation and production data deletion need explicit owner authorisation.
- A failed launch gate is not success; reduce scope instead of bypassing a gate.
