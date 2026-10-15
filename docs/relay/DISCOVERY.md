# Vitalos Relay: discovery

Repo state read on 15 October 2026 from `origin/main` at `8cdd7c2`. Paths are repo-relative.

## Workspace

- pnpm 12 + Turborepo 2, Node 24, TypeScript 6 strict, Vitest 5, Playwright 1.64 with `@axe-core/playwright`.
- Packages live at `packages/<name>` and are named `@vitalos/<name>` (not `packages/@vitalos/...`). Existing: `cms`, `config`, `design-tokens`, `email-layout`, `eslint-config`, `observability`, `security`, `testing`, `typescript-config`, `ui`, `validation`.
- Apps: `apps/web` (Next.js 16.4, React 19.3, Tailwind 4 and styled-components), `apps/storybook`. `superadmin/` is a separate Django project, not a pnpm workspace.
- Gates: `pnpm check` runs format, raw-colour scan (no hex/rgb outside `@vitalos/design-tokens`), turbo-env check, lint, typecheck, tests and dependency-cruiser boundaries. CI (`.github/workflows/ci.yml`): `quality` → `unit`, `e2e`, `e2e-sparse`, `e2e-draft`, `visual`, `storybook`, `database` (pgTAP). Required checks on `main`: `quality` and `gitleaks`.

## Website (`apps/web`)

- **Live:** the Vercel project `vitalos-platform` serves `https://www.vitalos.co.uk` in production. A merge to `main` deploys the live site. (The build prompt assumed otherwise.)
- Every link is a plain `<a>`, so navigation is a full document load (ADR-024). A widget cannot stay mounted across pages and must restore its state from storage.
- Fonts: Geist Sans/Mono through `geist` (self-hosted by `next/font`). CSP `font-src 'self'`, so Google Fonts cannot load at runtime. `next/font/google` self-hosts at build time, which is allowed.
- Tokens: `@vitalos/design-tokens` is **locked** (ADR-008, ADR-016): midnight `#081A2A`, Vitalos Blue `#2457FF`, Inter. They do not match the brand v2 `tokens.json` in the reference pack (midnight `#0B1320`, cobalt-600 `#2458E6`, Manrope/Inter/JetBrains Mono).
- CSP is header-based: `packages/security/src/csp.ts` builds it and `apps/web/src/config/security-headers.ts` decides the inputs. `connect-src 'self'`; Turnstile origins are added only when both keys are set.
- Env contract: `packages/config/src/schema.ts` (zod; production guards; values never echoed). Server env `getEnv()` (`server-only`), public env `readPublicEnv()`.
- Enquiries (ADR-019): a hexagonal feature under `apps/web/src/features/enquiries` with domain, ports, adapters (Supabase RPC, Postgres rate limiter, Turnstile, Resend/Postmark email), http handlers and composition.
- Supabase access: `@supabase/supabase-js` 2.117 with the **secret key** (`SUPABASE_SECRET_KEY`, new `sb_secret_` format) server-side only, calling SECURITY DEFINER functions granted to `service_role`. No client-side Supabase anywhere, and no Supabase Auth.
- Email: `EMAIL_PROVIDER` none | console | postmark | resend. The shared branded layout is `@vitalos/email-layout` (ADR-030).
- Crons: `apps/web/vercel.json` holds daily crons only (Hobby plan limits). Five-minute jobs need another scheduler.
- `ai` SDK: not installed.
- Sanity: removed on 12 October 2026 (ADR-028). Editorial content is TypeScript in `packages/cms/src/{repo,draft/content}`, served as the `repo` source. Practices, solutions, offers, industries, trust items and route pages are typed rich-text documents.

## Supabase

- Website project "Vitalos" (ref `kyrfilesutitygmuzvya`, eu-west-1, **free plan**: no backups, PITR or branching). Migrations in `supabase/migrations` (enquiries v2, outbox, retention), pgTAP in `supabase/tests`.
- Local stacks run on the Oracle VM through `scripts/vm-slot.sh`. This work uses **slot 1** (API 55421, DB 55422).
- Exposed API schemas: `public`, `graphql_public`. No `relay` schema, `pgvector` or Edge Functions yet.

## Super Admin (`superadmin/`)

- Django 6.1, Python 3.12, HTMX 2, Tailwind 4 standalone CLI. Strict CSP with nonces and `connect-src 'self'`. One small vanilla `static/js/app.js`.
- Its **own database**: Supabase project `vitalos-superadmin`, Django-managed tables. It never reads the website database. Enquiries arrive as HMAC-signed webhooks (`POST /api/inbound/web-form`). Sharing the website database was rejected in ADR-026 and ADR-029.
- Auth: email + password, django-axes and mandatory TOTP for SuperAdmin. Roles are Groups (`SuperAdmin`, `ServiceLead`, `Viewer`) checked with `role_required(...)`; `next` is validated. Entra OIDC is Phase 2.
- Shell: `templates/base.html` (top bar, bell, toasts), `templates/partials/sidebar.html`, nav data in `apps/core/navigation.py` (`NavItem`, permission functions). Badges are HTMX polls (`enquiries:badge`).
- Notifications: `apps.notifications` (bell, 60 s poll). Adding `Notification.Kind` choices needs an `AlterField` migration, which blocks the automatic deploy (deploy guard).
- Email: Resend through a Django backend (`EMAIL_TRANSPORT=log|resend`). Branded layout is the Python mirror `apps/mailer/layout.py` (golden fixtures, ADR-030). Audit: `apps.audit.services.record(...)`.
- Hosting: Azure Container Apps, one 0.25 vCPU replica that scales to zero, gunicorn sync workers. Long-lived connections (SSE) do not fit; short polling or a browser WebSocket to a third party does. Production `https://admin.vitalos.co.uk`, deployed automatically after green CI on `main`.
- Tests: pytest-django (SQLite locally, Postgres 17 in CI), Playwright smoke and axe runs in `superadmin/e2e`.

## Reference pack

`docs/relay/reference/` (brand v2, website designs, Relay boards). `brand/logos/vitalos-symbol.png` is byte-identical to `docs/brand/assets/vitalos-symbol.png`. The Super Admin already ships brand v2 colours and self-hosted Inter/Manrope/JetBrains Mono.
