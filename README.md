# Vitalos Platform

Monorepo for **[Vitalos](https://vitalos.co.uk): Technology Consulting, Engineering & Digital Transformation**. It runs the Vitalos website and sets clear boundaries for later applications and services, without deploying distributed infrastructure before it is needed.

## Status

- **Live at [vitalos.co.uk](https://vitalos.co.uk).** `main` deploys to production on Vercel; pull requests get preview deployments.
- **Super Admin** (`superadmin/`): the internal Django admin for `admin.vitalos.co.uk`; see `superadmin/README.md` and `superadmin/docs/DEPLOY.md`.
- **Launch gates G0–G10:** [`docs/delivery/launch-gates.md`](docs/delivery/launch-gates.md). Stage status, owner decisions, handoffs and the strategy library are kept privately, outside this public repository.

## What is in the repository

- `apps/web`: server-first Next.js 16 site. All routes of the information architecture, an enquiry pipeline (Postgres record plus durable outbox, Turnstile, rate limiting), SEO, redirects, security headers and publication gates. Reads content through a `ContentSource` (`repo` in production; `draft`, `fixtures` and `empty` for development and tests).
- `apps/storybook`: private component workbench (not deployed).
- `packages/*`: shared packages, including `design-tokens`, `ui`, `cms` (routes, locked copy, gates, view models, repo content, drafts, fixtures), `config` (validated environment), `validation`, `security`, `observability`, `testing` and `email-layout` (shared email layout, ADR-030).
- `supabase`: local PostgreSQL 17 configuration, migrations and pgTAP tests.
- `superadmin`: internal Django Super Admin for the Vitalos company architecture (ADR-026).
- `tests`, `tooling`: Playwright, axe, budget and integration suites; check and helper scripts.
- `infra`, `services`, `workers`: policy placeholders only; nothing is provisioned or extracted.

Without Supabase configuration the site builds and runs on the `repo` content with enquiries disabled. Site content is edited in the repository: see `docs/cms/editing-site-content.md`.

## Start

Install Node 24 LTS and enable Corepack. Every environment variable is optional locally (`.env.example` documents them).

```sh
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev:web # http://localhost:3000
```

Use `corepack pnpm check` before a pull request, plus `build`, `storybook:build` and the relevant test suites. All commands, content sources, the local Supabase stack and the test matrix are in [`docs/operations/local-development.md`](docs/operations/local-development.md); contribution rules are in `CONTRIBUTING.md`.

## Documentation map

| Topic | Where |
| --- | --- |
| Decisions | [`docs/adr/`](docs/adr/README.md) (indexed in its README) |
| Architecture | `ARCHITECTURE.md`, `docs/architecture/` (containers, data ownership, dependency rules, enquiry sequence, environments, future services) |
| Content and editorial | `docs/cms/editing-site-content.md` |
| Delivery | `docs/delivery/launch-gates.md` |
| Operations and runbooks | `docs/operations/` (local development, deployment, observability), `docs/runbooks/` (cutover, rollback, enquiry delivery failure) |
| Security | `SECURITY.md`, `docs/security/` (threat model, secret management) |
| Brand and SEO | `docs/brand/`, `docs/seo/REDIRECTS.md` |

## Sources of truth

Code owns production behaviour and locked copy; editorial content lives in the repo (`packages/cms/src/repo`, ADR-028); Supabase/PostgreSQL owns operational records; Figma owns approved visual composition; controlled evidence does not belong in the public site. Approved Stage 7-11 documents in the private Vitalos Drive govern brand, information architecture, experience, build and design handoff.

## Rules that matter

- Applications never import another application's source; use `@vitalos/*` public entrypoints (`corepack pnpm check:boundaries` enforces it).
- Never commit secrets or real enquiry or client data; fixtures are artificial.
- Production deploys, DNS changes, secret rotation and production data deletion need explicit owner authorisation.
- A failed launch gate is not success; reduce scope instead of bypassing a gate.

## Licence

Proprietary. Copyright Vitalos Technologies Limited, all rights reserved; see [`LICENSE`](LICENSE). The repository is public for transparency, not for reuse.
