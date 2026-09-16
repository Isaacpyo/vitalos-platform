# Vitalos Platform

Private production-platform monorepo for **Vitalos — Technology Consulting, Engineering & Digital Transformation**. The immediate product is the replacement corporate website; the repository establishes boundaries for later applications and services without deploying premature distributed infrastructure.

## Current implementation

- `apps/web`: server-first Next.js 16 corporate shell and server API boundaries.
- `apps/studio`: isolated Sanity Studio using governed schemas from `@vitalos/cms`.
- `apps/storybook`: private-by-default shared-component workbench.
- `packages/*`: tokens, UI, validated configuration/input, CMS, security, observability and test fixtures.
- `supabase`: local PostgreSQL 17 configuration and locked-down enquiry/outbox migration.

No production site, DNS, CMS dataset, database or deployment is changed by this repository.

## Start

Install Node 24 LTS and enable Corepack, then copy `.env.example` to `.env.local` and supply only the development values you need.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev:web
```

Use `pnpm check` before a pull request. See `docs/operations/local-development.md` and `CONTRIBUTING.md`.

## Sources of truth

Code owns production behaviour; Sanity owns routine editorial content; Supabase/PostgreSQL owns operational records; Figma owns approved visual composition; controlled evidence does not belong in the public CMS. Approved Stage 7–11 documents in the private Vitalos Drive govern brand, information architecture, experience, build, and design handoff.
