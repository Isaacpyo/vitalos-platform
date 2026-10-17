# Website & admin: 17 Oct review fixes — morning report

Run of 17 October 2026, from the live review of vitalos.co.uk and admin.vitalos.co.uk. One integration branch, `feat/review-2026-10-17`, with seven workstreams merged into it. The PR is open and **not merged**. Nothing was deployed to production, no production setting was changed, and no production content was written.

Start here: [FINDINGS.md](FINDINGS.md) (status of every finding), [DECISIONS.md](DECISIONS.md) and the `wsN/DECISIONS.md` files (every decision), and `wsN/COPY-CHANGES.md` (every public copy change, with its source).

## Previews

Both previews are behind Vercel sign-in; sign in with the Vitalos Vercel account.

| Preview                           | What it shows                                                                                                                                   | URL                                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integration branch                | Review build. Defaults for `VERCEL_ENV=preview`: **IA nav**, **Founder section on**, podcast off.                                               | Latest deployment of `feat/review-2026-10-17`, listed under the PR's Vercel check. When written: https://vitalos-platform-he0hfd3so-temitope-agbola-s-projects.vercel.app |
| `review/preview-production-flags` | The same code with **production flag values**: current nav, no Founder section, podcast off. One commit, never to be merged.                    | Under the Vercel check on branch `review/preview-production-flags`                                                                                                        |
| Super Admin                       | There is no admin preview or staging environment. The admin is covered by its test suite and by screenshots from a local run on fictional data. | `ws7/screenshots/`, `ws3/screenshots/`                                                                                                                                    |

The integration preview should have shown the IA nav through branch environment variables. That was not possible, because the Vercel CLI session expired about 19 hours before the run and signing in needs you. WS2 made the flags fall back to `VERCEL_ENV`, so the preview shows the IA variant with no Vercel setting changed. Production is unchanged.

**Nav variants side by side.** IA nav: `ws2/screenshots/repo-ia-*-1440.jpg`. Current nav: the baseline screenshots (`D:/Development/vitalos-baseline/docs/review-2026-10-17/baseline/screens/`, kept outside the repo) and the production-flags preview.

## Done

Every finding is listed in [FINDINGS.md](FINDINGS.md) with its status. In summary:

**Website, brand and visual (WS1, A1–A9).**

- Every hero photograph, glossy 3D icon and stock or AI image is gone: 42 files deleted from `apps/web/public/images`.
- In their place: deterministic brand-system SVG artwork (`HeroArtwork`) for 11 page families with a variant per item, line diagrams (`LineDiagram`) and six new line icons. AI Transformation is drawn as an abstract AI-journey staircase.
- Detail pages (offers, articles, roles, legal, Trust topics) have a light compact hero.
- `MediaSlot` renders nothing in production when its file is missing.
- The offer hero is an engagement-summary panel.
- Turnstile follows the page tone.
- Reveal animations never clip text, and reduced motion is honoured throughout.
- Image brief: [IMAGE-BRIEF.md](IMAGE-BRIEF.md). ADR-044.

**Website, content and IA (WS2, B1–B5, B8–B13).**

- "Six practices, one firm" everywhere, with Labs as the sixth, linking to `/labs`.
- The IA nav variant: `NEXT_PUBLIC_NAV_VARIANT`; while Work is closed its slot shows Labs, with Labs listed only once.
- A "How we prove it" band on the homepage and About, built only from true things.
- A rebuilt About page. The Founder section is copied verbatim from the published author profile and sits behind `ABOUT_FOUNDER_ENABLED`.
- Podcast hidden (`PODCAST_ENABLED`; `/podcast` returns 404).
- Trust: a "What you can ask for" block and `/.well-known/security.txt`.
- Offer "What happens next" steps.
- FAQ: anchors, a filter and Contact / Ask Relay routes.
- Contact: numbered steps.
- A real 404 page.
- CTA audit: a bug where every "Discuss …" button opened a blank form is fixed; offer and solution buttons now pre-select their topic. Audit table: `ws2/CTA-AUDIT.md`.
- ADR-045.

**Insights (WS3, B6, B14, F4).**

- `import_insights_batch` now creates drafts by default and takes `--author`. The 20 batch-2 articles import as 20 drafts and 0 published on a test database; the import is idempotent and leaves no editorial ticks.
- Article and index polish.
- Insights editor: an ordered author list, a drag-and-drop cover control with preview, a live word count and reading time, and the layout fixed.

**Careers (WS4, B7).**

- Hiring-process panel and "About Vitalos" strip on the role page.
- Application form on the shared form controls, with inline validation and a confirmation that promises no email.
- Settings drafts: [CAREERS-SETTINGS-DRAFT.md](CAREERS-SETTINGS-DRAFT.md).
- Open-roles review: [CAREERS-DRAFTS-REVIEW.md](CAREERS-DRAFTS-REVIEW.md).

**Measurement, SEO, headers, accessibility (WS5, C1–C11).**

- Vercel Web Analytics was already running in production (first-party and cookie-free, which is why the review missed it). Added: the brief's events through a typed `track()` with no personal data.
- New headers: `X-Frame-Options: DENY`, COOP `same-origin`, `script-src-attr 'none'`, HSTS `includeSubDomains`.
- A nonce-based CSP was rejected because it forces every page to render dynamically (ADR-047).
- Sitemap `lastmod`, manifest, theme colour, apple-touch-icon, site-wide RSS, llms.txt and structured data (ItemList, FAQPage, Person).
- New specs: phone-width overflow and tap-target checks, analytics, headers, reveal clipping.
- ADR-046, ADR-047.

**Relay (WS6, D1–D6, C2, E1).**

- **D1 was a measurement fault, not knowledge-base stuffing.**
  - Production prompts are already about 1.0–2.4k input tokens per turn (read-only look at token columns, no content).
  - The 509,640 total came from about 242 eval and load-test calls on launch day, counted in `usage_daily` and shown beside 4 real conversations.
  - Usage is now tagged by source. Insights shows tokens per answer (average, p95, max).
  - Budget leaks are closed, with a hard cap of 8,000 tokens per call.
  - Fixed 25-question eval: 22/25 → 25/25 pass. Maximum input 2,818 → 2,754 tokens. "Hello" now costs 0 tokens.
- Hand-off rate is a fraction: 4 conversations with 1 hand-off shows 25 %.
- Small talk needs no model call; typo tolerance; four drafted knowledge entries that need confirmation.
- Visitors see staff by first name only, never anything derived from the email.
- Hourly re-ingest; out-of-hours "Back Monday 09:00" with a leave-your-email option; a one-tap reason after a thumbs-down.
- The panel is mounted only while open, with "Continue previous conversation".
- Launcher accessible name fixed (WCAG 2.5.3).
- ADR-048.

**Super Admin (WS7, E2–E9, F1–F8).**

- Mojibake fixed and tested.
- Table actions in a sticky column with a More menu.
- Overdue-enquiry notifications and a daily digest; a daily sending-domain check; an 80 % email allowance warning.
- Full name required; names shown everywhere instead of emails; Team page lists real users.
- Morning Overview, with Relay counts from one `GET /overview` call.
- Architecture module flag and a dry-run import of practices, solutions and offers from the website.
- Six how-to guides on `/help/`.
- Primary-owner transfer prepared, not run.
- Screens checked at 390 px.
- ADR-049.

**Integration fixes by the orchestrator.**

- Relay staff name ignores the email-derived label that WS7's new user property can produce.
- The Overview reads WS6's `/overview` endpoint.
- The contact test waits for the thank-you title before axe runs: it is a streamed title after the server-action redirect, flaky under load.
- Six practices in the outreach email seed.
- Merge conflicts resolved in the ADR index, careers templates and the Insights model.

### Before and after

| Measure                                       | Before (live, 17 Oct)                        | After                                                                            |
| --------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| axe WCAG A/AA violations, 11 routes           | 0                                            | 0 in the e2e and a11y suites (see Checks)                                        |
| Empty `alt` not hidden, `/` and `/what-we-do` | 19, 15                                       | Decorative artwork is SVG with `aria-hidden`; the raster images are gone         |
| Home mobile LCP element                       | Hero photograph, 4.5 s, 71 % render delay    | No raster hero. Re-measure on the preview (sign-in needed; not measured tonight) |
| Relay input tokens per AI turn                | 1,023–2,417 (production); eval maximum 2,818 | Eval maximum 2,754; small talk 0; hard cap 8,000                                 |
| Relay "hand-off rate"                         | 2500 %                                       | 25 %                                                                             |

Lighthouse could not be re-run against the preview, because the preview is behind Vercel sign-in. The baseline method and numbers are in [baseline/BASELINE.md](baseline/BASELINE.md). Mobile figures from the baseline are pessimistic, because the host was overloaded.

### Checks on the final integration branch

_Filled in below under "Checks (final run)"._

## Needs approval

Nothing below has been done. Each item gives the exact next step.

1. **Merge the PR.** It deploys the website and, through `superadmin-deploy.yml`, the Super Admin. **Before merging**, apply the additive Relay migration `supabase/migrations/20261017090000_relay_review.sql` to production (`supabase db push`, after the dump-first steps for the free plan). If the code ships first nothing breaks, but typo tolerance is off, usage is untagged and the new Insights fields read 0. The three Django migrations (`accounts.0004_name_needs_review`, `enquiries.0002_sla_breach_notified_at`, `architecture.0004_offering_public_url`) are additive and run in the release job.
2. **IA nav in production:** set `NEXT_PUBLIC_NAV_VARIANT=ia` on Vercel production and redeploy. ADR-045.
3. **Founder section:** set `ABOUT_FOUNDER_ENABLED=true` on production after approving the text in `ws2/COPY-CHANGES.md`.
4. **Podcast:** leave `PODCAST_ENABLED` unset until the first episode exists.
5. **Import the 20 Insight drafts** after the deploy: the dry run, then the real run of `import_insights_batch --author <slug>`, exactly as written in `ws3/NOTES.md`. On `main` today the command still **publishes by default**, so do not run it before this PR is deployed. Publishing the drafts later is a separate approval.
6. **Careers settings:** paste the approved text from [CAREERS-SETTINGS-DRAFT.md](CAREERS-SETTINGS-DRAFT.md) into Careers → Settings. The hiring process is ready (from CAR-03, verified). Benefits and salary policy have marked gaps.
7. **Relay knowledge:**
   - Approve the four drafted repo entries (`packages/relay-knowledge/content/`: founder, solutions, getting started, modernise): set `status: published`, delete the `confirmation` line, run `build-content`.
   - Correct the Master FAQ entries that still say five practices (ABT-01, LAB-01, WWD-01, WWD-12) in Notion.
8. **One-off admin commands after the deploy** (each dry-run first; each prints what it will change):
   - `link_people --apply`
   - `sync_architecture_from_web --apply`
   - `notifications_cleanup --purge-smoke-test --apply`
9. **Primary owner:** choose an option in [ws7/PRIMARY-OWNER.md](ws7/PRIMARY-OWNER.md); option B is recommended (Temitope becomes owner, `admin@` is kept as break-glass with 2FA). Then run `transfer_primary_owner --to <email> --apply` and set `PRIMARY_OWNER_EMAIL` to the new owner before the next deploy. If you don't, `create_owner` in the release job stops the deploy.
10. **HSTS:** set `ENABLE_HSTS=true` on production once every subdomain serves HTTPS. Preload is a separate decision.
11. **Analytics custom events need Vercel Pro (costs money).** On the Hobby plan, page views and Speed Insights keep working and the custom events are dropped. The privacy-notice paragraph for the events is drafted in `ws5/NOTES.md`.
12. **Architecture module:** keep it or hide it with `ARCHITECTURE_MODULE_ENABLED=false` on the Container App.
13. **Live Insight text:** "Introducing Vitalos" says "one of five areas"; there are six solutions. Edit it in the Super Admin; the suggested wording is in `ws2/COPY-CHANGES.md`.
14. **Outreach email template:** production's existing template still says five practices (only the seed file changed). Edit it in Email templates.
15. **Delete the unused raster originals** in `apps/web/app/assets/`, or keep them. Nothing imports them.

## Needs confirmation from Temitope (facts only you can confirm)

- **Six practices**, with Labs as the sixth. Built as decided; the locked heading is now "Six practices, one firm".
- **Nav:** IA or current, to compare on the two previews.
- **Podcast:** stays hidden until there is an episode.
- **Founder text:** verbatim from the published author profile (`ws2/COPY-CHANGES.md`). Is the title "Founder" right?
- **Offer durations and investment bands:** no source exists in the repo or in the verified Master FAQ ([OFFERS-INVESTMENT-DRAFT.md](OFFERS-INVESTMENT-DRAFT.md)). Nothing was added.
- **Response-time promise:** none added.
- **Registered address:** kept off About and Contact, following your 12 Oct decision. Confirm.
- **CAR-01:** unconfirmed, so it was not used.
- **Senior salary band:** both Senior roles share £70,000–£85,000; the AI & Data Engineer role is £65,000–£80,000. Was the shared band deliberate? They were posted two minutes apart, which fits the Duplicate action.
- **Insights author:** confirm your person author slug for the import, or say whether to use "Vitalos".
- **`security.txt` contact:** uses `support@vitalos.co.uk`, as there is no `security@` mailbox.
- **Primary-owner option:** see item 9 above.

## Follow-ups (fallback in place)

- **Seven draft roles: verdicts not written.** Production admin data could not be passed to the agents (auto mode blocks sharing production reads). The read-only command to list them is in [CAREERS-DRAFTS-REVIEW.md](CAREERS-DRAFTS-REVIEW.md), part B. Fallback: the roles stay drafts.
- **Lighthouse after-numbers:** run `pnpm seo:check --lighthouse` against the preview once you're signed in, or after merge. Budgets were left unchanged so the required `seo` check stays stable.
- **Insights media library:** buildable from the stored upload records. The admin CSP now allows the media origin (WS7). Fallback: upload per post.
- **390 px screenshots of the IA nav:** they timed out locally. The 390 px layout is covered by the Playwright `mobile` project.
- **Stale CSS:** unused `hv-drift` and `hv-glint` keyframes remain in the generated token CSS.
- **Open PRs:** #61 (`FaqPage.tsx`, contact page, `StickyHeader.tsx`) and #62 (bulk actions in careers and Insights views) will need a rebase after this PR. `ws2/NOTES.md` explains how to resolve the FaqPage conflict.

## Environment notes from the night

- **C: filled up** at the start (seven parallel installs on a nearly full drive). Build output in 11 idle worktrees was deleted; no worktree or code was touched. Agents moved to `D:/Development/vitalos-wsN`. D: turned out to be a slow USB drive, so installs and tests ran in short-lived C: checkouts that hard-link from the pnpm store. All of them are removed.
- **The session limit** stopped five agents mid-task. They resumed after the 11:00 reset from where they had stopped.
- **Windows-only test failures:** two Django tests (`test_security.py`, production-settings subprocess) fail only on Windows (`WinError 10106`). CI runs them on Linux.
- **Branches left on origin:** `review/ws1-visual` … `review/ws7-admin` (all merged into the integration branch) and `review/preview-production-flags` (comparison only). Delete them after the PR is merged.

## Created

- **Secrets:** none.
- **Environment variables and flags:**
  - Website: `NEXT_PUBLIC_NAV_VARIANT`, `PODCAST_ENABLED`, `ABOUT_FOUNDER_ENABLED`. `ENABLE_HSTS` and `NEXT_PUBLIC_ANALYTICS_PROVIDER` already existed.
  - Admin: `ARCHITECTURE_MODULE_ENABLED`, `ANALYTICS_DASHBOARD_URL`, `CONTENT_MEDIA_PUBLIC_BASE_URL` (now also read by the CSP).
  - All are listed in `.env.example` or the admin docs.
- **Migrations:**
  - Supabase: `20261017090000_relay_review.sql` (additive).
  - Django: `accounts.0004_name_needs_review`, `enquiries.0002_sla_breach_notified_at`, `architecture.0004_offering_public_url` (additive).
- **Management commands:**
  - New: `link_people`, `sync_architecture_from_web`, `notifications_cleanup --purge-smoke-test`, `notify_overdue_enquiries [--digest]`, `check_sending_domain`, `transfer_primary_owner`.
  - Changed: `import_insights_batch` (draft default, `--author`).
- **Scheduled jobs:**
  - pg_cron `relay-ingest`, hourly; Vault-gated like the existing Relay jobs.
  - Overdue checks and the domain check run from the existing content tick.
- **Routes:** `/.well-known/security.txt`, `/manifest.webmanifest`, `/apple-touch-icon.png`.
- **Tests and CI:**
  - New Playwright specs: `analytics`, `site-meta.http`, `relay-closed`, `accessibility/mobile`, `reveal-clipping`, `nav-ia`, `security-txt.http`.
  - Relay turn eval as a CI test.
  - No workflow changes.
- **ADRs:** 044 to 049, indexed in `docs/adr/README.md`. ADR-020, 023, 024, 031, 037 and 038 carry amendments.
- **Dependencies:** none added.
