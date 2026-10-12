# Vitalos platform architecture

Vitalos uses a TypeScript-first modular monolith and independently deployable applications (ADR-003). Applications may import `@vitalos/*` public entrypoints, never another application's source. Provider adapters depend inward on domain interfaces. A capability is extracted only for justified scaling, isolation, ownership, runtime, availability or release-cadence needs; extracted services own their data and integrate using versioned APIs and events (ADR-010, ADR-013).

## Current (stage-1 branch, 10 Oct 2026)

- `apps/web`: Next.js 16 on the App Router. Pages come from one route manifest (`@vitalos/cms`), read content only through a `ContentSource` (`repo`, `draft`, `fixtures`, `empty`; ADR-022, ADR-028) and are statically generated: content is static per deploy and nothing is revalidated by a webhook. Closed publication gates hide thin sections. Enquiries go through ports and adapters into a PostgreSQL record and durable outbox (ADR-019). Security headers, CSP, correlation ids and non-production `noindex` are built from validated configuration (ADR-020).
- `apps/storybook`: private component workbench.
- `packages`: `design-tokens`, `ui`, `cms`, `config`, `validation`, `security`, `observability`, `testing`, `email-layout` (the shared layout for every Vitalos email, ADR-030).
- `supabase`: local migrations and pgTAP tests. No remote project is used.
- `superadmin`: the isolated Django Super Admin (internal, `admin.vitalos.co.uk`, own PostgreSQL; ADR-026). Python toolchain, no source imports to or from the TypeScript apps.
- Quality gates run in CI: format, lint, typecheck, unit tests, boundaries, build, Storybook build, end-to-end and accessibility, JS budgets, client-bundle secret scan, Storybook axe, pgTAP, CodeQL and gitleaks (ADR-021).

## Future (documented, not built)

A production Supabase project, an email notifier adapter and outbox scheduler, error and analytics providers; later client, operations and documentation apps, mobile apps, workers, public APIs, containers and regional deployment. `services/` and `workers/` hold templates only; `infra/` holds policy placeholders.

## Boundaries (enforced by `corepack pnpm check:boundaries`)

- No app-to-app imports, no cycles, no package-to-app imports.
- The `@vitalos/cms` root entry stays free of framework and CMS SDK dependencies; no CMS SDK is a dependency of the repository (ADR-028).
- `packages/ui` is presentation only: no `next`, `@supabase`, `@vitalos/cms` or `@vitalos/config`.
- Secrets stay server-side; `@vitalos/config` root is `server-only` and the client bundle is scanned in CI.

## Data ownership

Repo (`packages/cms/src/repo`, ADR-028): editorial content. PostgreSQL: enquiries, outbox, rate limits. Super Admin PostgreSQL (separate database): internal company architecture records. Code: locked copy, routes, gates, tokens. Controlled evidence: outside the public site. Email is a notification channel, never the record.

## Read next

- `docs/architecture/container-architecture.md`, `data-ownership.md`, `dependency-rules.md`, `enquiry-sequence.md`, `environment-model.md`, `future-service-model.md`, `system-context.md`
- `docs/adr/README.md` (ADR 001-028)
- `docs/delivery/launch-gates.md`
