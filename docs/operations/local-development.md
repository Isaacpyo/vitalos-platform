# Local development

Everything below runs without any remote service, credential or secret. Do not copy production values into local files; never commit `.env.local`.

## Requirements

- Node 24 LTS (`.node-version`; `engines` is `>=24 <25`) and Corepack. The repository pins pnpm via `packageManager`.
- Docker, only for the local Supabase stack, the database tests and the Supabase integration tests.
- The Supabase CLI for those (CI pins 2.120.0). Discover commands with `supabase --help`.

## Setup

```sh
corepack enable
corepack pnpm install --frozen-lockfile
cp .env.example .env.local        # optional; every variable is optional locally
corepack pnpm dev:web             # http://localhost:3000
```

Other apps: `corepack pnpm dev:studio` (Sanity Studio, default port 3333) and `corepack pnpm storybook` (port 6006). Run `corepack pnpm check` before a pull request.

Keep lockfile changes to one pull request at a time and keep the `ui5` override in `pnpm-workspace.yaml`.

## Content sources

`VITALOS_CONTENT_SOURCE` selects where `apps/web` reads content (ADR-018). Defaults: `sanity` when `NEXT_PUBLIC_SANITY_PROJECT_ID` is set, otherwise `empty`.

| Source     | Use                           | Behaviour                                                                                                                                                                                               |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty`    | Default local, CI builds      | No documents, every publication gate closed. The homepage shows locked copy only; detail routes 404. This is the honest empty state                                                                     |
| `fixtures` | UI work, tests                | Artificial content ("Example Practice (fixture)", `*.invalid` addresses). `VITALOS_FIXTURE_SET=full` (above all gates) or `sparse` (below them). Rejected in production                                 |
| `draft`    | Content review, demos         | Repo-authored content drafted from `docs/strategy/`, pending owner approval (ADR-025). Shows a "Draft content, pending approval" ribbon. Rejected in production and with the `supabase` enquiry backend |
| `sanity`   | Against a real Sanity project | Needs a project id, dataset and, for drafts, a read token. Not available until the owner provides a project                                                                                             |

Example, full fixtures with in-memory enquiries:

```sh
VITALOS_CONTENT_SOURCE=fixtures VITALOS_FIXTURE_SET=full VITALOS_ENQUIRY_BACKEND=memory \
  corepack pnpm dev:web
```

Draft content: `VITALOS_CONTENT_SOURCE=draft VITALOS_ENQUIRY_BACKEND=memory`. The inventory is `docs/content/draft-inventory.md`; after editing `packages/cms/src/draft`, regenerate the Sanity export with `node tooling/scripts/export-draft-dataset.mjs`. End-to-end against it: `E2E_CONTENT_SOURCE=draft corepack pnpm test:e2e` (fixture-specific specs skip themselves).

On the contact page the enquiry form renders only when enquiries can be stored and a privacy notice is published. With fixtures the full set includes one; with `empty` you see the email alternative instead.

Enquiry backends (`VITALOS_ENQUIRY_BACKEND`): `disabled` (default without Supabase variables; the endpoint answers 503), `memory` (tests only, process-local, forbidden in production) and `supabase`. Set `ENQUIRY_IP_HASH_SALT` (16 or more characters) for the Supabase backend. Turnstile keys must be set as a pair; for local work use Cloudflare's documented test keys (`1x00000000000000000000AA` and `1x0000000000000000000000000000000AA`), which the config rejects in production.

## Local Supabase

The stack uses non-default ports 5532x so it does not collide with other local projects (`supabase/config.toml`): API 55321, database 55322, Studio 55323, local SMTP 55324, analytics 55327.

```sh
supabase start            # needs Docker
supabase db reset         # applies supabase/migrations (3 migrations)
corepack pnpm db:test     # = supabase test db; pgTAP in supabase/tests
supabase status -o env    # prints API_URL, SECRET_KEY, ANON_KEY for local use
supabase stop
```

Never run `supabase link` or `supabase db push` against a remote project from an agent or script: that is an owner action.

To run the web app against the local database, export (in your shell, not in a committed file) `SUPABASE_URL=http://127.0.0.1:55321`, `SUPABASE_SECRET_KEY=<local SECRET_KEY>`, `ENQUIRY_IP_HASH_SALT`, `OUTBOX_DISPATCH_SECRET` (32 or more characters) and `VITALOS_ENQUIRY_BACKEND=supabase`. Set `EMAIL_PROVIDER=console` to see notifications in the logs. That provider logs enquiry content, so it is local-only and rejected in production. Drain the outbox manually:

```sh
OUTBOX_DISPATCH_SECRET=... node tooling/scripts/dispatch-outbox-local.mjs [--url http://localhost:3000] [--watch 30]
```

## Studio without credentials

`apps/studio` loads and builds with no Sanity project: without `SANITY_STUDIO_PROJECT_ID` it uses a placeholder project and cannot load content, so you can inspect schemas, desk structure, validation and actions but not documents. Set `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` only with an owner-provisioned project (never secrets: `SANITY_STUDIO_*` is bundled into the Studio). `SANITY_STUDIO_PREVIEW_URL` points Presentation at the web app (default `http://localhost:3000`). Do not run `sanity deploy`.

## Typegen

Sanity types in `packages/cms/src/generated` are generated from the schema and the GROQ queries and checked for drift:

```sh
corepack pnpm check:cms-types                          # CI check; fails on drift
node tooling/scripts/check-cms-types.mjs --write       # regenerate the committed files
```

Design-token CSS is generated too: `UPDATE_TOKENS=1 corepack pnpm --filter @vitalos/design-tokens test`.

## Tests and checks

| Command                                   | What it runs                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `corepack pnpm check`                     | format check, raw-colour check, lint, typecheck, unit tests, boundaries                                                                    |
| `corepack pnpm format` / `format:check`   | Prettier write / check                                                                                                                     |
| `corepack pnpm lint`, `typecheck`, `test` | Turbo across workspaces (Vitest for unit tests)                                                                                            |
| `corepack pnpm check:boundaries`          | dependency-cruiser rules (`docs/architecture/dependency-rules.md`)                                                                         |
| `corepack pnpm check:raw-colours`         | no raw colour values outside `packages/design-tokens`                                                                                      |
| `corepack pnpm check:cms-types`           | generated Sanity types match schema and queries (also a CI step)                                                                           |
| `corepack pnpm check:security`            | tracked-file secret patterns and `pnpm audit --audit-level high` (also the blocking `audit` CI job)                                        |
| `corepack pnpm build`                     | Turbo build; runs with no variables locally (set `NEXT_PUBLIC_SITE_URL` for any non-local deploy env)                                      |
| `corepack pnpm storybook:build`           | Static Storybook                                                                                                                           |
| `corepack pnpm test:e2e`                  | Playwright against a production build (`next build` and `next start` on port 3210) with fixtures, memory enquiries and Turnstile test keys |
| `corepack pnpm test:a11y`                 | axe (WCAG 2.2 AA tags) and reflow checks; set `E2E_SKIP_BUILD=1` when `.next` is current                                                   |
| `corepack pnpm test:perf`                 | JS gzip budgets from `tests/performance/budgets.json`                                                                                      |
| `corepack pnpm test:storybook-a11y`       | axe on every story; run `storybook:build` first                                                                                            |
| `corepack pnpm check:bundle-secrets`      | scans `apps/web/.next/static` for server env names and secret patterns; build first                                                        |
| `corepack pnpm test:integration`          | root-level Vitest; Supabase tests skip unless `SUPABASE_URL` and `SUPABASE_SECRET_KEY` point at a local stack                              |
| `corepack pnpm db:test`                   | pgTAP against local Supabase                                                                                                               |

Playwright first run needs browsers: `corepack pnpm exec playwright install chromium`. Useful variables: `E2E_PORT`, `E2E_REUSE_SERVER=1`, `E2E_SKIP_BUILD=1`, `E2E_CONTENT_SOURCE`, `E2E_FIXTURE_SET`, `E2E_ENQUIRY_BACKEND`, `E2E_STORYBOOK_PORT` (default 6317). The `sparse` Playwright project is inert unless `E2E_SPARSE_BASE_URL` points at a server built with `VITALOS_FIXTURE_SET=sparse`.

To run the Supabase integration tests: `supabase start && supabase db reset`, then export the values from `supabase status -o env` as `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `SUPABASE_ANON_KEY`, then `corepack pnpm test:integration`. They write artificial rows only and refuse non-local URLs.

## CI jobs

`quality` (format, lint, typecheck, unit tests, boundaries, CMS type drift, build, Storybook build), `e2e` (end-to-end, accessibility, budgets, bundle-secret scan, integration), `storybook-a11y`, `database` (local Supabase and pgTAP), plus CodeQL and gitleaks. Releases need all of them green. No CI job holds a secret, project reference or database password.

## Next.js note

This is Next.js 16: `middleware` is `proxy.ts`, and APIs differ from earlier versions. Read `apps/web/node_modules/next/dist/docs/` before changing framework-level code (`apps/web/AGENTS.md`).
