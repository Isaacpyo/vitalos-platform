# Discovery — 17 October 2026

Read-only survey of the integration branch (`fcc5167`) before any change. Paths are repo-relative.

## Website (`apps/web`)

### Page composition

- Routes are in `apps/web/app/(site)/…`; each `page.tsx` imports a template from `apps/web/src/templates/`. Public families: home; What We Do (`/what-we-do`, `/what-we-do/[practice]`); solutions; offers; industries; How We Work; About; Trust (`/trust`, `/trust/[topic]`); FAQ; Contact (+ thank-you); Labs (index, type, asset); Insights (index, article, feed); Careers (index, role); Work (gated, closed); People; Legal.
- Shared bands: `templates/commercial/bands.tsx` (`PageIntro`, `Band`, `RowList`, `ClosingBand`), `commercial/dark-bands.tsx` (`LifecycleBand`, `IndustryBand`), `institutional/layout.tsx` (`PageHeroBand`, `PageBand`, `ContentSection`); section patterns in `packages/ui/src/patterns/*`.
- **Repo copy** (ADR-028): `packages/cms/src/draft/content/` (`pages.ts`, `practices.ts`, `solutions.ts` incl. FAQ entries, `offers.ts`, `industries.ts`, `trust.ts`, `labs.ts`, `work.ts`, `people.ts`, `legal.ts`), served through `packages/cms/src/repo/index.ts` (placeholders dropped). Locked strings: `packages/cms/src/locked-copy.ts`. Publication gates: `packages/cms/src/content/gates.ts`.
- **Insights and Careers** are admin-owned (ADR-039/040): `apps/web/src/features/content/` reads the Super Admin content API (contract `contracts/content-api/v1/`). RSS: `apps/web/app/(site)/insights/feed.xml/route.ts`.

### Heroes and imagery

- Home hero: `HeroSection` in `templates/home/sections.tsx` (its own `<img>` backdrop + `HeroVisual variant="glass"`). **There is no hero video anywhere** in `apps/web` or `packages/ui`; the brief's video items do not apply.
- Other pages: `PageIntro` / `PageHeroBand` → `PageHero tone="dark"` (`packages/ui/src/patterns/layout/PageHero.tsx`, `DarkPageHero`). 404: `components/site-chrome/NotFoundContent.tsx`.
- The single hero photograph (A1) is `apps/web/public/images/hero/cloud-infrastructure-{640,960,1672}.webp`, defined only in `apps/web/src/lib/view-mapping/hero-images.ts` and used by home sections, commercial bands, institutional layout and NotFoundContent.
- Glossy raster sets (owner-supplied, mostly AI-generated per `docs/brand/asset-approval.md`): `images/how-we-work/*` (lifecycle ring via `ProcessCycle`), `images/solutions/*` (`SolutionShowcase` + solution heroes; `ai-transformation` is the chip/brain image), `images/practices/*` (`PracticeShowcase` + practice heroes), `images/industries/*` (people scenes; `IndustryShowcase` + industry heroes).
- Line icons: `packages/ui/src/primitives/Icon.tsx`, `IconTile.tsx`; mapping `apps/web/src/lib/view-mapping/icons.ts`.
- `MediaSlot`: `apps/web/src/components/media-slot.tsx`, registry `apps/web/src/content/media-slots.ts`; looks for `public/media/{id}…` (folder absent). In production the empty `aria-hidden` box still renders (A5).
- "Solutions carousel" is `SolutionShowcase` (list + panel); `motion/Carousel.tsx` is unused.

### Navigation, flags, copy counts

- Nav data: `packages/cms/src/navigation.ts` (`primaryNav`: What We Do, Who We Are, Support; ADR-031). Header/footer models: `apps/web/src/components/site-chrome/nav-model.ts` (footer practice column, podcast block). UI: `packages/ui/src/patterns/site/{SiteHeader,MegaMenu,MobileNav,SiteFooter,FooterNav,podcast-marks}`.
- Env/flags: `packages/config/src/schema.ts` and `.env.example`. Existing public flags include `NEXT_PUBLIC_MEDIA_LABELS` and `NEXT_PUBLIC_ANALYTICS_PROVIDER`.
- "Five practices" appears in visible copy (`locked-copy.ts:230`, `pages.ts:341/343`, `llms-txt.ts:32`, `sections.tsx:235`), comments and tests, Relay prompt and knowledge (`relay-core/src/llm/prompts/system.ts:12`, `relay-knowledge/content/*.md`, FAQ snapshot) and docs.

### Headers, SEO

- Headers: `next.config.ts` → `apps/web/src/config/security-headers.ts` → `packages/security/src/{csp,headers}.ts`. CSP today: `script-src 'self' 'unsafe-inline'` (+ Turnstile), `frame-ancestors 'none'` already present; middleware (`proxy.ts`) sets no nonce.
- Sitemaps: `app/sitemap.xml`, `app/sitemaps/[file]` → `features/seo/sitemap*.ts`. Robots, `llms.txt` route, metadata/JSON-LD in `features/seo/`. No web manifest. 404 exports no metadata (B12).

### Contact, Relay widget

- Contact: `apps/web/src/components/contact/EnquiryForm.tsx`; `?intent=`/`?offer=` already pre-select the topic (`contact-params.ts`). Turnstile has no `theme` option (A8).
- Relay widget: mounted from `apps/web/app/layout.tsx` when `RELAY_ENABLED`; `packages/relay-widget/src/panel.tsx` is lazy-loaded on first hover/focus/click, then stays mounted with `hidden`; answers are `<article>`s inside `role="log"`. Storage keeps only the conversation id/token (30 days); the transcript is refetched.

## Super Admin (`superadmin/`)

- Django + django-htmx templates, Tailwind v4 standalone CLI, plain JS in `static/js/`. Settings `config/settings/{base,dev,prod,test}.py`, flags via django-environ.
- Apps: accounts, api, architecture (company profile, service lines, practices/solutions/offers, team, projects, KPIs, Overview), audit, core (health, overview KPIs, help, bulk actions), email_templates, mailer, enquiries, notifications, relay (client/UI only), content_sync, insights, careers.
- Tests: pytest (`config.settings.test`, SQLite unless `DATABASE_URL`; CI uses Postgres 17). E2E: `e2e/smoke.py`, `e2e/a11y.py` (Python Playwright + axe) against the built container.
- Deploy: Azure Container Apps via `.github/workflows/superadmin-deploy.yml` after CI on `main`. **No staging or preview environment.**

### Root causes found

- **E1** hand-off rate: `packages/relay-core/src/services/admin.ts:888` returns a percentage (25); `superadmin/apps/relay/views/pages.py:19-21` `_percent` multiplies by 100 again → 2500 %. Same double scaling in the digest (`apps/relay/emails.py:165`). Test fixtures use fractions, hiding it.
- **E2** mojibake: `superadmin/config/settings/base.py:347` contains literal double-encoded bytes for "→" (commit d034dae).
- **E3** posts table: `templates/insights/post_list.html` Actions cell `whitespace-nowrap` with five actions; same pattern in `careers/role_list.html`, `application_list.html`.
- **E5** no notification kind for SLA breaches; `apps/enquiries/sla.py` computes overdue only at render; smoke-test notifications come from `e2e/smoke.py` run against production.
- **E6–E8/F3** `User.full_name` optional; `TeamMember.user` and `insights.Author.admin_user` nullable and never synced; emails rendered in `enquiries/_thread.html`, `_list.html`, `careers/application_detail.html`, `architecture/dashboard/_team.html`, `sidebar.html`, `enquiries/views.py:228`.
- **E9** `core/health.py` `_domain` reads fields no code writes; outbound count is local against `RESEND_DAILY_LIMIT=100` (80 % warning already exists).
- **D3** `apps/relay/client.py:76` sends `full_name or email local part`; `relay-widget/src/panel.tsx:1271` upper-cases it.
- **D4** website-knowledge ingest runs only from the GitHub Action `relay-knowledge.yml` (gated by `RELAY_INGEST_ENABLED`); Relay pg_cron jobs need Vault secrets; no scheduled re-ingest.
- **D5** `panel.tsx:891` static "TEAM OFFLINE"; business hours in `relay-core/src/schemas/settings.ts`.
- **D6** `feedbackBody` accepts only `1 | -1`.
- **D1** current code assembles system prompt (~5.5 KB) + last 8 turns (≤ 3000 tokens) + 6 retrieved chunks (≤ 2400 tokens). Leaks: `trimToBudget` always keeps the first chunk whatever its size; FAQ chunks are unbounded. The ~127k/conversation figure is not explained by this code; WS6 must trace usage accounting (`add_usage`, aborted-stream estimates, tool/agent iterations) before changing retrieval.
- **B6** batch-2 articles are in the repo (`superadmin/apps/insights/imports/insights-batch-2/` and `docs/content/imports/insights-batch-2/`); `import_insights_batch` defaults to `--status published` — the run must pass `--status draft`.
- **B7** `CareersSettings.config` JSON (`apps/careers/config.py`): benefits, process, salary_policy, equal_opportunities default to "".
- Scheduler: no Django job runner; `content_tick` runs via a signed website cron (daily) and an opportunistic thread.
- Help: `/help/` → `templates/core/help.html` (shortcuts only).

## CI, tests, previews

- Workflows: `ci.yml` (`quality` — required, always runs; `unit`; `e2e` incl. `test:a11y`, `test:perf`; `seo` — required since 16 Oct, runs `seo:check --lighthouse`; `visual` — non-gating; `storybook-a11y`; `database` pgTAP), `secret-scan.yml` (`gitleaks` — required), `superadmin.yml` (Ruff, `makemigrations --check`, pytest on Postgres 17, container smoke + axe), `superadmin-deploy.yml`, `relay-knowledge.yml`, `backup.yml`, `indexnow.yml`, `audit.yml`, `codeql.yml` (disabled).
- Playwright (root `playwright.config.ts`): builds and starts `@vitalos/web` with fixture content, memory enquiry backend, Turnstile dummy keys, `RELAY_STORE=memory`, `RELAY_LLM_PROVIDER=mock`; projects `chromium`, `mobile` (390×844), `no-js`, `http`, `sparse`. axe via `tests/support/axe.ts` (`@axe-core/playwright`, WCAG 2.2 AA). Lighthouse via `tooling/seo/lighthouse.mjs` + `tooling/seo/budgets.json`. JSON-LD checks: `features/seo/graph.ts`, `json-ld-rules.ts`, `tests/support/json-ld.ts`.
- `pnpm check` = format, raw colours, turbo env, lint, typecheck, test, boundaries.
- Vercel: Git-integration previews per PR, behind Vercel login. Project settings are not in the repo. `apps/web/vercel.json` has region `dub1` and crons.
- **Analytics already exists** (C1 correction): `@vercel/analytics` + `@vercel/speed-insights`, `apps/web/src/components/analytics/site-analytics.tsx`, event sink `apps/web/src/features/analytics/vercel-sink.ts`, switched by `NEXT_PUBLIC_ANALYTICS_PROVIDER` = `none` | `vercel` (default `none`). The review saw no analytics on production, so either the variable is unset in production or it is blocked; WS5 checks and extends this rather than adding a second provider.
- Stage documents (`docs/strategy/`) are gitignored and not present in this checkout; offer durations and investment bands therefore have no in-repo source unless the Master FAQ states them.
- Highest ADR: 043. (The files ADR-035 to ADR-038 carry the headings "ADR 031" to "ADR 034".)
