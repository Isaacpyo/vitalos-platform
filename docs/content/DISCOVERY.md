# Discovery: Insights and Careers (15 October 2026)

This records what the repository looked like before this work, on branch `feat/insights-careers` off `origin/main` at `8cdd7c2`.

## Super Admin (`superadmin/`, ADR-026)

- **Stack and layout:**
  - Django 6.1 (the ADR names 5.2 LTS; the lockfile pins 6.1.2), server-rendered templates with HTMX and the standalone Tailwind CLI, PostgreSQL in production and SQLite in tests unless `DATABASE_URL` is set.
  - Apps in `superadmin/apps/`: `core`, `audit`, `mailer`, `accounts`, `notifications`, `architecture`, `enquiries`, `email_templates`, `api`.
  - URLs in `config/urls.py`; settings in `config/settings/{base,dev,prod,test}.py`.
- **Reference app: Enquiries.**
  - Logic sits in `services.py` and `selectors.py`, with views kept thin (`views.py`) and templates in `templates/enquiries/`.
  - Machine endpoints are in `api.py` (CSRF-exempt, HMAC-signed, fail closed with 503 when the secret is unset), with management commands for notifications and retention.
- **Auth and roles:**
  - Email and password plus mandatory TOTP for SuperAdmin; django-axes lockout.
  - Roles are Django groups `SuperAdmin`, `ServiceLead` and `Viewer` (`apps/accounts/roles.py`); every authorisation goes through that module.
  - A primary owner (`PRIMARY_OWNER_EMAIL`). Personal API tokens for the read-only `/api/v1/` (DRF, drf-spectacular).
- **Audit:** `apps/audit` (append-only trail, `services.record(...)`), plus django-simple-history on architecture models.
- **Notifications:** `apps/notifications`, in-app with a bell; enquiry notifications also email through the mailer, with digest and daily limits.
- **Email:**
  - `EMAIL_TRANSPORT=log` by default, which sends nothing; `resend` is switched on by a person.
  - Sender `NOTIFY_FROM` (`notifications@vitalos.co.uk`). The shared email layout is in `apps/mailer/layout.py` (ADR-030).
- **Jobs and scheduler:**
  - None runs in production. The release job runs migrations on deploy.
  - The enquiry notification job is documented but not created, and is on the approval list (`docs/email-setup.md` section 8).
- **Storage:**
  - `storages["attachments"]` is S3-compatible (R2) when `OBJECT_STORAGE_BUCKET` is set, local disk in development and in memory in tests.
  - In production without a bucket, bytes are not kept.
  - Attachment rules are in `apps/enquiries/attachments.py`: magic bytes, random keys, signed URLs.
- **Tests:** pytest with pytest-django in `superadmin/tests/`. Baseline on Windows: 338 passed, 2 failed. The 2 are `test_security.py` production-settings subprocess tests, which fail only in this Windows environment (CI runs on Linux).
- **Deployment:**
  - Azure Container Apps (UK South), 1 replica at most, scale to zero.
  - The image goes to GHCR. `superadmin-deploy.yml` deploys automatically after green CI on `main`.
  - Migrations run in a release job before the app switches. The plan job **refuses automatic deploys** whose migrations contain `RemoveField`, `DeleteModel`, `RenameField`, `RenameModel`, `AlterField` or `RunSQL` (DECISIONS #97, #99), so new migrations here are `CreateModel` and `AddField` only.
  - Request size: Container Apps ingress has no small body limit. Django `DATA_UPLOAD_MAX_MEMORY_SIZE` is 5 MB; enquiry endpoints read raw bodies with their own caps (`providers.read_body`).

## The Enquiries integration end to end

- **Admin endpoints** `POST /api/inbound/email` and `/api/inbound/web-form`:
  - signature: header `X-Vitalos-Timestamp`, and `X-Vitalos-Signature` = hex HMAC-SHA256(`INBOUND_WEBHOOK_SECRET`, `"{ts}." + body`);
  - 300 s tolerance, `hmac.compare_digest`;
  - a single shared secret, with no key ids and no rotation overlap.
- **The website's contact form does not use it yet.** It stores enquiries in the website's Supabase (`apps/web/src/features/enquiries`, ADR-019) and has its own outbox, the Turnstile verifier, an IP-hashed Postgres or memory rate limiter, and the daily Vercel crons. ADR-029 left the switch to the admin as a separate change.
- **This job therefore:**
  - reuses the admin's `sign` and `verify_hmac` idea and the `read_body` helper;
  - extends the scheme (ADR-036) with scopes, key ids, method, path and body hash;
  - reuses the website's Turnstile verifier and rate limiter for applications.

## ADR-026, ADR-028 and ADR-029: how Insights and Careers are closed today

- **Gates:** `@vitalos/cms` publication gates (ADR-022). `/insights` and `/careers` call `requireGateOpen(...)`, which returns 404 below the threshold. Detail pages are reachable but `noindex` when the gate is closed.
- **Content:** the `repo` source (ADR-028) drops every placeholder document, so it serves no Insight and no job. The gates are closed in production.
- **404 rendering:** the proxy (`apps/web/proxy.ts`) rewrites certain-missing detail URLs to a server-rendered 404 (ADR-027), because Next.js renders a blank 404 body for `notFound()` thrown by a page.

## Website (`apps/web`)

- **Framework:** Next.js 16.4.0, React 19.3, **Cache Components off**, styled-components plus Tailwind 4 with tokens from `@vitalos/design-tokens`.
- **Homepage:**
  - `app/(site)/page.tsx` renders `src/templates/home/HomeTemplate.tsx`: a locked hero, then `homeBands` (`sections.tsx`) through `renderBands`, then `finalConversionSection`.
  - There is no Insights band on the homepage.
- **SEO and headers:**
  - Sitemap: `app/sitemap.ts`, built from `src/features/seo/sitemap.ts` (static per deploy).
  - Robots: `app/robots.ts`. Metadata: `src/templates/institutional/metadata.ts` (`pageMetadata`).
  - CSP: `@vitalos/security/csp` `buildCsp`, used by `src/config/security-headers.ts` (header-based, `img-src 'self' data:`, Turnstile only when keys are set).
  - Redirects: `src/features/redirects`.
- **Navigation and footer:** `packages/cms/src/navigation.ts` and `src/components/site-chrome/`.
- **Config:** `packages/config/src/schema.ts` (zod, validated at build). Variables follow `ENQUIRY_*`, `TURNSTILE_*` and `CRON_SECRET`.
- **Tests:**
  - Vitest per package.
  - Playwright suites in `tests/{end-to-end,accessibility,visual,performance}` (axe through `@axe-core/playwright`).
  - Storybook in `apps/storybook`.

## Monorepo and local running

- Both apps are in this monorepo, so `contracts/` lives at the root.
- **Docker runs only on the Oracle VM** (AGENTS.md). For this job:
  - the Django admin runs directly on the laptop in a Python 3.13 virtualenv (`superadmin/.venv`), against SQLite for E2E or against a VM slot's Postgres (`bash scripts/vm-slot.sh`, superadmin db port 5433+n) for Postgres-only tests;
  - the website runs with `next build && next start` (ISR and tags need a production build).
  - The two talk over `localhost`.

## Related work in flight

`feat/relay` (worktree `.claude/worktrees/relay`, unmerged) adds a Relay tab to the Super Admin and ADR-031 to ADR-034. This job uses ADR-035 to ADR-038 and does not depend on Relay (Relay hook behind `CONTENT_RELAY_SYNC_ENABLED=false`).
