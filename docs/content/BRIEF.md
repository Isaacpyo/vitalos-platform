# Vitalos Insights (blog) and Careers: build brief

This file holds the owner's brief for the admin-powered Insights and Careers features, recorded on 15 October 2026. It has two parts:

- **Part A** is the original brief, sections 0 to 9. The paste was cut off partway through section 9.
- **Part B** is the owner's reply. It contains **Amendment 1** (the architecture), which overrides Part A where they conflict, and the complete sections 9 to 14, which replace the truncated section 9 in Part A.

Decisions taken while building are recorded in `DECISIONS.md`, and the plan is in `PLAN.md`.

---

# Part A: original brief (sections 0 to 9, cut off in section 9)

You are the lead engineer building two admin-powered content features for the Vitalos website (vitalos.co.uk):

1. **Insights** (the Vitalos blog): an index page, article pages, author pages, an RSS feed, and an **Insights section on the homepage**.
2. **Careers**: a careers page, role pages with an application form, and a **Careers section on the homepage**.

All of it is authored in, and powered by, the **Vitalos super admin dashboard** (the "admin platform"), through two new tabs, **Insights** and **Careers**. The website and the admin must stay **in sync**: anything published, edited, scheduled, unpublished, closed or deleted in the admin shows on the website within seconds, with no redeploy, and nothing unpublished ever shows.

This brief is the full specification. The **current Vitalos brand** is the visual reference: `docs/relay/reference/brand/` (design system, tokens, logos, voice) and `docs/relay/reference/website/` (current homepage and How We Work designs). If those folders are missing, use the repo's token package and existing site components. Visual precedence: **brand → website → this brief**. This brief wins on behaviour, data and security.

## 0. How you work on this job

- **Run end to end without stopping.** Do not pause for confirmation or wait for a plan to be approved. Write your plan to `docs/content/PLAN.md` and keep going.
- **Nothing blocks.** When something is missing, use the fallback in 0.1, record it in `docs/content/DECISIONS.md`, and continue. The job is finished only when every phase in section 12 is complete with its tests passing.
- **One approval list at the end.** Prepare each item in 0.2 completely and list it under **Needs approval** in the final report. Do not execute those and do not stop for them.
- **Post a one-line status before each major step** (for example "Phase 1: building the revalidation outbox").
- **Repo rules:** read `AGENTS.md`, `docs/adr/` and the root configs and follow them. TypeScript strict. pnpm + Turborepo as the repo does. Modular monolith. Do not reuse the obsolete public repo `Isaacpyo/Vitalos`. **Reuse what exists** (auth, data access, styling, tokens, email, notifications, audit log, Turnstile, tests); never add a second way of doing one of these.
- **Secrets:** create keys, tokens, webhooks and provider config when the work needs them and you have access. Store values only in gitignored env files (`.env.local`) or the provider's secret store (Vercel env, Supabase secrets/Vault, GitHub Actions secrets). Never commit, log or print values. Add every variable, without its value, to `.env.example` and to the report.
- **Brand integrity rule (hard):** never invent articles, authors, quotes, statistics, citations, client names or logos, case studies, outcomes, testimonials, certifications, partnerships, team size, offices, locations, benefits, salaries, roles or hiring promises, in code, seed content, tests or fixtures shown in the UI. Development fixtures must be obviously fictional ("Example author", "Example role (fixture)", "Example City") and must never be loaded into a production database.
- **Git:** branch `feat/insights-careers`, one commit per phase, open a PR after Phase 3 and keep pushing. When all phases pass, mark it ready and merge if branch protection lets you; otherwise leave it ready for review and say so.

### 0.1 Fallbacks (use these instead of stopping)

| If this is missing                                 | Do this and continue                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Super admin app                                    | Discover it first. If none exists, create one. (Superseded: the super admin is the Django app in `superadmin/`.)                                                                |
| Admin authentication                               | Reuse the existing one.                                                                                                                                                         |
| Remote Supabase access                             | Develop and test locally. (Superseded by Amendment 1: this job does not touch the website's Supabase.)                                                                          |
| Per-minute scheduler                               | Use a scheduler the hosting supports. If none, rely on the query-time filters and cache TTL in 3.5 and note it.                                                                 |
| Next.js Cache Components not enabled in `apps/web` | Do not switch the whole site to it in this job. Use `unstable_cache(fn, keys, { tags, revalidate })` for content reads. Record the choice in an ADR.                            |
| Turnstile keys                                     | Reuse existing keys if they exist; otherwise Cloudflare's test keys in development and previews: site `1x00000000000000000000BB`, secret `1x0000000000000000000000000000000AA`. |
| Email provider or verified sender domain           | Reuse the existing provider. Real test sends only to `@vitalos.co.uk` from the sandbox sender.                                                                                  |
| Sanity already holds Insight/post documents        | (Not applicable: Sanity was removed, ADR-028.)                                                                                                                                  |
| Relay not built                                    | Build only a hook behind `CONTENT_RELAY_SYNC_ENABLED` (Amendment A8).                                                                                                           |
| Homepage design has no slot for the new sections   | Insert them per 5.6 and 6.5 using the site's existing section rhythm; never reorder existing sections.                                                                          |
| A login or 2FA step you cannot complete            | Skip that step, use the matching fallback, and write the exact steps for Temitope in the report.                                                                                |
| Any other missing input                            | Pick the most reasonable option, write it in `DECISIONS.md`, continue.                                                                                                          |

### 0.2 Prepared for approval, never executed

- Publishing any real Insight or opening any real role in production (the build ships with none).
- Sending email to anyone outside `@vitalos.co.uk`, including turning on `CAREERS_CANDIDATE_EMAILS_ENABLED` (application receipts and outcome emails to candidates).
- DNS records for the sending subdomain `notify.vitalos.co.uk` (prepare exact records only if not already prepared).
- Anything that touches the **live** vitalos.co.uk: its DNS, its domains in Vercel, or the historic project serving it. Previews are fine.
- The candidate privacy-notice text, the application retention period (default 6 months after a decision or role close), and an equal-opportunities statement (field left empty).
- Confirming FAQ entry CAR-01 (whether an associate or talent network is run with a real follow-up process). Until then the associates line and speculative applications stay off.
- Any paid service (for example CV virus scanning).

## 1. Decisions already made

1. **Source of truth:** the super admin dashboard. The website never writes content and reads only server-side. (Storage: see Amendment A1.)
2. **Naming and routes:** Insights at `/insights` (`/blog` and `/blog/:path*` → 308 to `/insights` and `/insights/:path*`). Careers at `/careers`. Labels and base paths live as constants in one place.
3. **Publishing model:** each post and role has a **working copy** (what the editor changes) and a **published snapshot** (`published_snapshot`, what the website reads). Editing a live item never changes the site until someone presses **Publish changes**. Every publish writes an immutable revision.
4. **Body format:** Markdown with a safe, fixed feature set (4.4), rendered by **one renderer** used by both the admin preview and the website, so preview equals production (Amendment A7: it lives in the website).
5. **Sync:** transactional outbox + signed revalidation webhook + per-minute tick + query-time filters + a short cache TTL as the last safety net (section 3).
6. **Relay:** published Insights and open roles feed Relay's knowledge base when Relay exists (section 8, Amendment A8).

## 2. Brand, voice and approved copy

**Brand files** (read first, when present): `brand/brand-book.md`, `brand/applications.md`, `brand/tokens.json` / `tokens.css`, `brand/messaging.md`, `brand/logos/` and `website/homepage-*.html`. Components use the **semantic tokens** (`surface-100`, `surface-200`, `surface-inverse`, `ink`, `ink-muted`, `ink-inverse`, `action`, `on-action`, `accent-text`, `mineral-text`, `line`, `line-strong`, `focus-ring`) so dark theme follows. Match the current site: white header, primary button `#2458E6` with white 600 text and 2px radius (52px in heroes, 44–48px elsewhere), eyebrows Inter 11/16 600 0.14em uppercase, text links with a square-capped arrow, 2px square-capped stroke icons, Manrope 800/700 for display and titles, Inter for body, JetBrains Mono 11/16 0.04em uppercase for the annotation layer (meta, tags, dates, status). Major statements end with a full stop in cobalt. Radius 0 for panels, rows and media; 2px buttons and inputs; 4px tags. **No** gradients, glows, decorative shadows, purple, AI imagery, stock photography, rounded floating cards or left-border cards. Flat colour and hairlines. Spacing 4, 8, 12, 16, 24, 32, 48, 64, 96.

**Voice:** short, confident, plain British English; no emoji, no exclamation marks; never "revolutionary", "cutting-edge", "unleash", "supercharge", "magic", "AI-powered", "rockstar", "ninja" or "unlimited hustle".

**Approved copy (use verbatim; do not add claims):**

| Where                                 | Copy                                                                                                                                                                                                                                                                                                                                         | Source                          |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Insights heading                      | "Engineering clarity from complexity."                                                                                                                                                                                                                                                                                                       | Website copy                    |
| Insights intro                        | "Practical writing on modernisation, data and AI for leaders who have to make it work."                                                                                                                                                                                                                                                      | Website copy                    |
| Insights formats                      | Executive briefings · Insight articles · Points of view · Engineering notes · Guides · Research reports · Case-derived insights                                                                                                                                                                                                              | FAQ INS-01 (verified)           |
| Insights topics (seed)                | AI and agents · Digital transformation · Software and platforms · Data · Cloud and reliability · Experience and commerce                                                                                                                                                                                                                     | FAQ INS-01                      |
| Insights sectors (seed)               | Health & Care · Retail, Commerce & Consumer · Operations, Industry & Logistics · Growth & Technology                                                                                                                                                                                                                                         | Company HQ                      |
| Editorial note (end of every article) | "Every substantive Vitalos Insight has a named human author who is accountable for its accuracy and judgement. Claims, citations and figures are checked before anything is published."                                                                                                                                                      | FAQ INS-02 (verified)           |
| Careers heading                       | "Build what you advise."                                                                                                                                                                                                                                                                                                                     | Derived from CAR-02             |
| Careers intro                         | "Vitalos offers consequential technology work, close to the problem, where you build what you advise. People get senior responsibility and direct client exposure, consulting and engineering in one environment, AI used as a real delivery capability, and high standards without unnecessary bureaucracy."                                | FAQ CAR-02 (verified)           |
| Careers "How we work"                 | Values: ownership, candour, craft, commercial sense, clarity, learning, collaboration, respect, pragmatism, client stewardship. "Work is remote-capable by design, with written context and documented decisions, and in-person time is used where it adds value." "Technical people can progress without having to become people managers." | FAQ CAR-02                      |
| Careers empty state                   | "There are no open roles right now. Roles are published here only when they are real."                                                                                                                                                                                                                                                       | Derived from CAR-01             |
| Associates line (off by default)      | "We also work with associates. Experienced consultants, engineers, designers and AI specialists can introduce themselves through our contact page."                                                                                                                                                                                          | FAQ CAR-01 (needs confirmation) |

All page and section copy above is stored in admin settings (seeded with these values) so it can be edited without code. Benefits, hiring process, salary policy text and the equal-opportunities statement are **empty by default** and their sections are hidden until someone fills them in.

## 3. The sync contract (the core of this job)

### 3.1 Guarantees (each one is tested in section 13)

1. Publish, publish changes, unpublish, archive, delete, open, pause or close in the admin → every affected public page (article, index and its pages, topic and author pages, feed, sitemap, homepage, careers page, role page) reflects it in **≤ 5 s at p95**, measured from the admin's success response to the first public response showing the change.
2. A scheduled post goes live, and a role with a closing date closes, within **2 minutes** of the set time.
3. If the webhook and the scheduler both fail, the website still converges within the cache TTL (`CONTENT_CACHE_TTL_SECONDS`, default 600).
4. Draft, in-review, scheduled-but-not-due, paused, archived and deleted content is **never** served publicly or cached publicly, including in the sitemap, feed, JSON-LD, OG images and Relay.
5. A changed slug never breaks a link: the old URL returns a 308 to the new one.
6. The admin always shows whether the site is in sync, per item and overall, with a retry action.

### 3.2 Shared logic

(Replaced by Amendment A2: a committed OpenAPI contract instead of a shared TypeScript package.) The functions it listed still have to exist on the side that owns them: zod schemas for every API body; the **tag builder** (the exact tags in 3.3); revalidation signing and verification; the preview-token helpers; slug helpers; reading time (words ÷ 220, rounded up, minimum 1); salary and date formatters (`£55,000–£65,000 a year`, `12 October 2026`, Europe/London); and the **Markdown renderer** (4.4). Route constants (`INSIGHTS_BASE = '/insights'`, `CAREERS_BASE = '/careers'`) live in one place.

### 3.3 Cache tags

Every public read is cached with tags; every change emits the tags it affects.

| Change                                                                          | Tags revalidated                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Post published, changes published, unpublished, archived, deleted, slug changed | `insights`, `insights:list`, `insights:post:{id}`, `insights:author:{id}` for each old and new author, `insights:topic:{id}` for each old and new topic, `home`, `feed`, `sitemap` |
| Author or topic updated                                                         | `insights` (broad; authors and topics change rarely)                                                                                                                               |
| Role opened, changes published, paused, closed, archived, deleted, slug changed | `careers`, `careers:list`, `careers:role:{id}`, `home`, `sitemap`                                                                                                                  |
| Careers page settings                                                           | `careers`, `home`                                                                                                                                                                  |
| Homepage section settings                                                       | `home`                                                                                                                                                                             |

On the website: if `apps/web` already uses Cache Components, read through functions with `'use cache'`, `cacheTag(...)` and `cacheLife({ revalidate: CONTENT_CACHE_TTL_SECONDS })`; otherwise `unstable_cache` with the same tags and `revalidate`. Removal events call `revalidateTag(tag, { expire: 0 })` (see Amendment A4 for publish events). Check the installed Next.js version and its docs and adapt if the API differs; the behaviour (next request is fresh) is the requirement. For slug changes also `revalidatePath` the old path.

### 3.4 Outbox and signed revalidation webhook

- Every admin mutation that affects public content runs in **one database transaction** that changes the data, writes the revision (if publishing), writes the audit row and inserts a sync event (`id uuid`, `entity` (`post`, `author`, `topic`, `role`, `careers_settings`, `home_section`), `entity_id`, `action`, `tags`, `paths`, `created_at`, `attempts`, `next_attempt_at`, `last_error`, `delivered_at`, `delivered_targets`).
- **After commit**, the admin server delivers the event immediately to every web target: `POST {target}/api/content/revalidate` with body `{ eventId, tags, paths }` and a timestamped HMAC signature. Timeout 3 s. On success, set `delivered_at` once every target has acknowledged.
- The web route verifies the signature with a constant-time comparison, rejects timestamps more than 300 s old, validates every tag against `^[a-z]+(:[a-z0-9-]{1,80})*$` and every path against the known route patterns, revalidates, and returns `{ revalidated: tags }`. Replays are harmless (revalidation is idempotent) but still bounded by the timestamp check. Rate-limit by IP. `runtime = 'nodejs'`, `Cache-Control: no-store`.
- Undelivered events are retried by the tick (3.5) with exponential backoff (1, 2, 4, 8 … minutes, max 10 attempts). After 3 failed attempts the admin gets an in-app alert ("Site sync failed for {title}"), and the item shows **SYNC FAILED · RETRY**.

### 3.5 Scheduler ("tick") and query-time filters

- A tick runs every minute (Amendment A5: the admin's `content_tick` command). Each run promotes due scheduled posts to `published` (writing the snapshot, revision, audit row and outbox event in one transaction), closes roles whose `closes_at` has passed, delivers pending outbox events, and deletes orphaned CV uploads older than 24 hours. Overlapping runs do nothing twice.
- Belt and braces: public queries treat `status = 'scheduled' and publish_at <= now()` as published, and roles with `closes_at <= now()` as closed, so correctness never depends on the tick alone.

### 3.6 Preview (drafts never touch the public cache)

- **Preview** in the admin opens `{web}/api/content/preview?token=…`: a token signed with `CONTENT_PREVIEW_SECRET` (`{ entity, id, revisionHash, exp: now + 15 min }`). The route verifies it, enables Next.js `draftMode()`, and redirects to the item's path. In draft mode, pages read the **working copy** through an uncached function. A fixed midnight bar reads mono "PREVIEW · NOT PUBLISHED · {status}" with **Exit preview**. Preview responses send `X-Robots-Tag: noindex` and `Cache-Control: private, no-store`.
- Preview works for unpublished items with no slug collision issues (preview resolves by id carried in the token).

### 3.7 Sync status in the admin

- Per item (lists and editor rail), mono status: "LIVE · SYNCED 14:21" (`mineral-text`), "SYNC PENDING" (`ink-muted`, with a 4-square loader), "SYNC FAILED · RETRY" (`ink`, with a **Retry** text button), "NOT PUBLISHED" (`ink-muted`). Updates live (poll every 5 s while any event is pending).
- In the Insights and Careers top bars, an overall indicator: "SITE IN SYNC" or "{n} UPDATES PENDING" or "{n} SYNC FAILURES", linking to `/content/sync`: the last 200 events with entity, action, tags, targets, attempts, timings, error and **Retry**; plus **Resync everything** (emits `insights`, `careers`, `home`, `feed`, `sitemap`), audited.

### 3.8 Slugs and redirects

Slugs are generated from the title (lowercase, ASCII, hyphens, max 80), editable, unique per entity. Changing the slug of anything that has ever been published records the old slug as a redirect (`entity`, `from_slug`, `to_id`); the website serves 308 to the current slug. Reusing a slug held by a redirect replaces the redirect after a warning.

## 4. Data model

(Storage moved to the Django admin's database by Amendment A1. The fields below still define the models.)

### 4.1 Insights

- Enums: `post_status` (`draft`, `in_review`, `approved`, `scheduled`, `published`, `archived`); `post_format` (`executive_briefing`, `insight_article`, `point_of_view`, `engineering_note`, `guide`, `research_report`, `case_derived_insight`); `practice` (`consulting`, `engineering`, `ai_data`, `experience`, `managed_services`, `labs`).
- `authors`: `id`, `slug` unique, `name`, `role_title`, `bio_md`, `avatar_path`, `linkedin_url`, `admin_user_id` (nullable link to a dashboard user), `confirmed_real_by`, `confirmed_real_at` (an author must be a real person who approved their profile; required before any post with them can publish), `is_active`.
- `topics`: `id`, `slug`, `name`, `description`, `kind` (`topic`, `sector`), `sort`. Seed the approved topics and sectors (section 2).
- `posts` (working copy): `id`, `slug` unique, `status`, `format`, `title`, `excerpt` (≤ 220 chars), `body_md`, `cover_path`, `cover_alt`, `cover_caption`, `practice`, `featured`, `pin_home`, `cta_label`, `cta_href` (optional per-post call to action; defaults to "Talk to Vitalos"), `seo_title`, `seo_description`, `canonical_url`, `noindex`, `publish_at`, `first_published_at`, `last_published_at`, `public_updated_at` (the "Updated" date readers see; set only when the editor ticks "This is a material update"), `published_snapshot`, `published_revision_id`, `has_unpublished_changes`, `reading_minutes`, `created_by`, `updated_by`.
- `post_authors` (`post_id`, `author_id`, `position`; at least one), `post_topics` (`post_id`, `topic_id`), `post_related` (`post_id`, `related_post_id`, `position`; manual, with an automatic fallback by shared topics).
- `post_revisions`: `id`, `post_id`, `snapshot`, `body_hash`, `published_by`, `published_at`, `note`. Immutable.
- `editorial_checks`: `post_id`, `revision_hash`, `check_key`, `checked_by`, `checked_at` (4.5).
- `slug_redirects`: `entity` (`post`, `author`, `role`), `from_slug`, `to_id`, `created_at`; unique `(entity, from_slug)`.
- `site_sections`: `key` (`home_insights`, `home_careers`), `config` validated with defaults (5.6, 6.5).
- Search on title and excerpt for the admin.

### 4.2 Careers

- Enums: `role_status` (`draft`, `open`, `paused`, `closed`, `archived`); `work_model` (`remote`, `hybrid`, `on_site`); `employment_type` (`permanent_full_time`, `permanent_part_time`, `fixed_term`, `contract`, `associate`); `level` (`l1_associate`, `l2_professional`, `l3_senior`, `l4_lead_staff`, `l5_principal`, `l6_director`, `l7_partner`; shown publicly as Associate, Professional, Senior, Lead, Principal, Director, Partner); `salary_period` (`year`, `day`); `application_stage` (`new`, `reviewing`, `interview`, `offer`, `hired`, `rejected`, `withdrawn`); `right_to_work` (`yes`, `needs_sponsorship`, `prefer_to_discuss`).
- `roles` (working copy): `id`, `slug`, `status`, `title`, `practice`, `level`, `show_level`, `location_text` (free text entered by the admin; no default), `work_model`, `employment_type`, `salary_min`, `salary_max`, `salary_currency` (default `GBP`), `salary_period`, `show_salary`, `summary` (≤ 220), `about_md`, `responsibilities_md`, `requirements_md`, `nice_to_have_md`, `process_md` (falls back to the careers setting), `sponsorship` (`available`, `not_available`, `not_stated`), `opens_at`, `closes_at`, `apply_mode` (`form`, `external`), `external_apply_url`, `hiring_manager_admin_id`, `show_on_home`, `sort`, `published_snapshot`, `published_revision_id`, `first_opened_at`, `closed_at`, `created_by`, `updated_by`.
- `role_revisions` (immutable snapshots, as for posts).
- `applications`: `id`, `role_id` (nullable only if speculative applications are enabled), `stage`, `name`, `email`, `phone`, `location_text`, `linkedin_url`, `portfolio_url`, `right_to_work`, `notice_period`, `cover_note` (≤ 3,000), `cv_path`, `cv_filename`, `cv_mime`, `cv_size`, `consent_at`, `notice_version`, `source` (`careers_page`, `homepage`, `role_page`), `duplicate_of`, `assigned_admin_id`, `decided_at`, `ip_hash` (salted), `user_agent`. Indexes `(role_id, stage, created_at desc)`, `email`.
- `application_notes` (`application_id`, `admin_id`, `body`), `application_events` (`application_id`, `actor_admin_id`, `type` (`stage_changed`, `cv_viewed`, `assigned`, `note_added`, `email_sent`), `meta`, `at`).
- `settings` (single row, `config` with defaults): page copy (section 2), values list, benefits (empty), default hiring process (empty), salary policy note (empty), equal-opportunities statement (empty), empty-state copy, `associates_line_enabled false`, `speculative_applications_enabled false`, notification recipients (default: all super admins), `retention_months 6`, `candidate_emails_enabled` mirrors the env flag, `privacy_notice_url`, `privacy_notice_version`.
- Rate limits: reuse what exists.

### 4.3 Sync, storage, shared tables

- Sync events (3.4).
- Storage: `content-media` (public read, uuid paths, JPEG, PNG, WebP or AVIF only, no SVG; ≤ 5 MB; uploads only through the admin). `careers-cvs` (**private**, no public policy; ≤ `CAREERS_CV_MAX_MB`; PDF and DOCX only).
- Audit log and notifications: reuse the dashboard's.

### 4.4 Markdown renderer (one renderer, server-side)

`remark` + `rehype` pipeline with `rehype-sanitize` on a strict allowlist: headings h2–h4 (h1 is the title), paragraphs, bold, italic, links (external links get `rel="noopener noreferrer"` and a visually hidden "(opens in a new tab)" only if they open one; default same tab), ordered and unordered lists, blockquotes, inline code, fenced code with server-side highlighting (Shiki, no client JS), tables (wrapped in a horizontally scrollable, labelled region), images from the media host only (alt required, `![alt](url "caption")` renders a `figure` with `figcaption`), footnotes (rendered as a mono "SOURCES" list at the end), callouts (`> [!NOTE]`, `> [!WARNING]`). **Never** raw HTML, iframes, scripts or embeds. Headings get stable ids for the table of contents. Images render with dimensions stored at upload.

### 4.5 Editorial workflow (Insights)

Statuses: `draft` → `in_review` → `approved` → `scheduled` or `published` → `archived`; `published` → `draft` on unpublish. **Publish (and Publish changes) is blocked until all checks are ticked for the current revision hash**, each recorded with who and when:

1. A named human author is assigned, and every author is confirmed as a real person.
2. Claims and figures are checked; there are no invented statistics.
3. Citations and links are checked.
4. Images have alt text, and we have the rights to use them.
5. The excerpt, SEO title and SEO description are written (or the defaults accepted).

Permissions: see section 9. Every action writes the audit log.

## 5. Insights: public website (`apps/web`)

### 5.1 `/insights` (index)

- Hero (white): eyebrow "INSIGHTS"; H1 "Engineering clarity from complexity." (Manrope 800, 56/60 desktop, 40/44 mobile, −0.025em, cobalt full stop); intro Inter 18/28 `ink-muted` with the approved line.
- Filters: a row of text tabs for formats that have at least one published post (All · Executive briefings · Insight articles · …), active 600 with a 2px `action` underline, as plain links (`?format=engineering-note`); a topic select that links to topic pages. Filtered views are `noindex, follow` with the canonical on `/insights`. No client JS needed.
- Featured: the newest `featured` post (else the newest post) as a full-width row: cover 7 of 12 columns (16:9, only if a cover exists) and text 5 columns; mono format tag in `accent-text`, title Manrope 700 32/38, excerpt, meta mono "AUTHOR NAME · 12 OCT 2026 · 6 MIN READ".
- Grid: 12 per page, 3 columns ≥ 1024px, 2 at 640–1023px, 1 below; items separated by `line` hairlines, radius 0, no shadows: mono format tag, title Manrope 700 22/28 (link covers the item), excerpt Inter 15/24 `ink-muted` clamped to 3 lines, mono meta. Covers on grid items only when every item on the page has one, else none (keeps the grid even).
- Pagination at `/insights/page/[n]` with Previous / Next text links and `rel` attributes. Out-of-range pages 404.
- Empty state (zero published posts): "No Insights are published yet." and the site's "Talk to Vitalos" band.
- Topic pages `/insights/topics/[slug]` (indexable) and author pages `/insights/authors/[slug]` (name, role, bio, LinkedIn link, their posts) use the same grid.

### 5.2 `/insights/[slug]` (article)

- Mono breadcrumb "INSIGHTS / ENGINEERING NOTE". H1 Manrope 800 48/52 (36/40 mobile), max width about 22ch; excerpt as a dek, Inter 20/30 `ink-muted`.
- Byline: author photo 40px square (radius 0) or a 40px mineral initials square, linked name, role; mono "PUBLISHED 12 OCT 2026 · UPDATED 14 OCT 2026 · 6 MIN READ" (UPDATED only when `public_updated_at` is set).
- Optional cover (16:9, priority image for LCP, caption).
- Body: measure about 68ch, Inter 18/30 (17/28 mobile), h2 Manrope 700 28/34, h3 22/28; blockquote Manrope 600 24/32 with a top hairline (no left border); code blocks on midnight with JetBrains Mono 14/22, horizontal scroll and a **Copy** button (the only client JS on the page besides Copy link); tables scroll inside a labelled region.
- Table of contents: a sticky right rail ≥ 1280px when there are three or more h2s, mono "ON THIS PAGE"; inline collapsible on smaller screens.
- After the body: footnote SOURCES list; the editorial note (section 2) in `ink-muted` 14/21 between hairlines; author block(s) (name, role, bio, "More from {first name}" link); "Copy link" and a plain LinkedIn share link (no SDKs, no third-party scripts); up to 3 related posts; the site's "Talk to Vitalos" band (or the post's CTA).
- Unknown or unpublished slug → `notFound()`. Old slug → 308.

### 5.3 Feed, sitemap and SEO

- `generateMetadata` for every page: title "{SEO title} | Vitalos Insights", description, canonical, Open Graph and Twitter cards. OG images generated with `next/og` per post from a brand template (midnight ground, Manrope title, cobalt full stop, the symbol, mono format and date), tagged like the post so they update on publish.
- JSON-LD: `Article` (headline, description, datePublished, dateModified, author `Person` with the author page URL, publisher `Organization` "Vitalos" with logo, image) and `BreadcrumbList`.
- `/insights/feed.xml` (RSS 2.0, newest 20, title, link, guid = post id, pubDate, excerpt, author name), linked with `<link rel="alternate">`, tagged `feed`.
- The sitemap includes published posts, topic pages with posts, author pages with posts, `/careers`, and open role pages, each with `lastmod`; tagged `sitemap`.

### 5.4 Performance and accessibility

Static rendering with tags; no layout shift (reserve image sizes); no new client bundles beyond the two copy buttons (and the application form); the homepage keeps LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. WCAG 2.2 AA: landmarks, one h1, visible 2px focus ring with 2px offset, link purpose clear out of context (no "Read more" alone; use visually hidden titles), 200% zoom, reduced motion respected, dark theme via tokens.

### 5.5 Redirects and links

`/blog` → `/insights` (308). Add "Insights" to the existing nav item's href if it is a placeholder. Add Insights to the footer if the footer lists sections.

### 5.6 Homepage: Insights section

- Placement: after the Work/proof section and before the closing "Talk to Vitalos" band. If the homepage design already has an Insights band, **wire that band to live data** instead of adding a second one.
- Layout: white ground; eyebrow "INSIGHTS"; heading "Engineering clarity from complexity." (Manrope 800, cobalt full stop); intro line; on the right of the heading row, a text link "All insights" with the square-capped arrow. Items: 3 by default (setting: 2–4): the first item spans 6 of 12 columns with its cover if it has one, the next two 3 columns each; tablet 2 columns; mobile a stacked list with hairlines. Each item: mono format tag, title, excerpt (2 lines), mono meta.
- Selection (`home_insights`): `enabled` (true), `heading`, `intro`, `count` (3), `mode` (`latest` or `pinned`, where pinned posts come first and the rest fill with the latest). Changes emit `home`.
- With zero published posts the section is not rendered at all (no empty state on the homepage). With one or two, the layout adapts without gaps.

## 6. Careers: public website (`apps/web`)

### 6.1 `/careers`

- Hero (white): eyebrow "CAREERS"; H1 "Build what you advise." (cobalt full stop); the approved intro; primary button "See open roles" (anchor), only when roles are open.
- **How we work:** the values as a mono-indexed list (01 Ownership … 10 Client stewardship) and the two approved statements. All from settings.
- **Open roles:** grouped by practice in the order Consulting, Engineering, AI & Data, Experience, Managed Services, Labs; group heading mono with a count. Each role is a full-width link row with a hairline below: title (Manrope 700 20/26), mono facts "ENGINEERING · SENIOR · HYBRID · {LOCATION} · PERMANENT" (level only when `show_level`), the salary line when `show_salary` ("£55,000–£65,000 a year"), "Closes 30 Nov 2026" when a closing date is set, and a chevron in `line-strong`. When more than 6 roles are open, add filters (practice, work model, employment type) as links, `noindex` on filtered views.
- **Empty state:** the approved empty-state copy; plus the associates line and a "Introduce yourself" link to `/contact?topic=careers` (or the repo's equivalent careers route on the contact page) **only** when `associates_line_enabled`.
- Benefits, hiring process, salary policy and equal-opportunities sections render only when their settings are filled in.
- Closing: the site's "Talk to Vitalos" band.

### 6.2 `/careers/[slug]` (role)

- Mono breadcrumb "CAREERS / ENGINEERING"; H1 title; summary as a dek.
- Facts grid (mono labels, Inter values) between hairlines: PRACTICE, LEVEL (when shown), LOCATION, WORK MODEL, EMPLOYMENT, SALARY (only when shown), VISA SPONSORSHIP (when not `not_stated`), CLOSES (when set).
- Primary button "Apply for this role" (anchor to the form, or the external URL with an "opens a new site" hint).
- Sections in order, each only if filled: About the role · What you'll do · What you'll bring · Nice to have · How we hire (role or default) · Equal opportunities (setting).
- Application form at the end (6.3).
- **Closed role:** H1, mono "CLOSED · {date}", "This role closed on {date}." and a link to open roles; `noindex`; no form; no JSON-LD. Paused, archived, draft or unknown → 404. Old slug → 308.
- JSON-LD `JobPosting` **only for open roles with every required field**: title, description (rendered HTML), datePosted (`first_opened_at`), validThrough (`closes_at`, when set), employmentType mapped (`FULL_TIME`, `PART_TIME`, `TEMPORARY`, `CONTRACTOR`), hiringOrganization (Vitalos, vitalos.co.uk, logo), jobLocation from `location_text` or `jobLocationType: TELECOMMUTE` with `applicantLocationRequirements` United Kingdom for remote, `baseSalary` only when shown, `directApply: true` for form roles. Never fabricate a missing field; omit the block instead.

### 6.3 Application form

- Fields (labels above, 44px inputs, 1px `line-strong`, radius 2, Inter 15/16 on mobile): Full name (required, `autocomplete="name"`); Email (required); Phone (optional, `type="tel"`); Where are you based? (optional); LinkedIn URL (optional); Portfolio or GitHub URL (optional); **CV** (required, PDF or Word, max 10 MB; drag-and-drop plus a button; shows the file name, size and a Remove button); Cover note (optional, counter from 2,500, max 3,000); Do you have the right to work in the UK? (required radio: Yes · I would need sponsorship · I'd prefer to discuss); Notice period (optional); consent checkbox (required): "I agree that Vitalos may process my application as described in the candidate privacy notice." with the link; invisible Turnstile; a hidden honeypot field.
- **Upload flow:** replaced by Amendment A9. Without JavaScript the form says "Turn on JavaScript to upload your CV and apply."
- Idempotent by a client submission id. Duplicate (same email and role within 30 days) is accepted and flagged in the admin; the applicant is not told.
- Errors (Inter 13, linked with `aria-describedby`, focus moves to the first invalid field; an error summary at the top for more than one): "Enter your name" · "Enter a valid email address" · "Upload your CV as a PDF or Word document" · "Your CV must be 10 MB or smaller" · "Choose an answer" · "Tick the box to agree to the candidate privacy notice" · "Couldn't upload your CV. Check your connection and try again." · "You're sending applications quickly. Try again in a few minutes." · "This role is no longer accepting applications."
- Success (replaces the form, focus moves to it): "Application received." (cobalt full stop) and "We've received your application for {role title}." followed by the hiring process text when set. No promises beyond that.
- Applications to a role that closed between page load and submit are rejected with the closed message.

### 6.4 Links

Footer link "Careers" (and on About, if About lists company links). Contact page careers route stays as it is.

### 6.5 Homepage: Careers section

- Placement: directly after the Insights section, before the closing band.
- Layout: `surface-100` band, hairline above; left 5 columns: eyebrow "CAREERS", heading "Build what you advise." (Manrope 800, cobalt full stop), first sentence of the approved intro, text link "All open roles" (or "About careers" when none are open). Right 7 columns: up to 3 open roles (setting 1–5; `show_on_home` roles first, then newest) as link rows like 6.1.
- Settings (`home_careers`): `enabled` (true), `heading`, `intro`, `count` (3), `when_no_roles` (`hide` default, or `show_message`, which shows the empty-state copy and, only if `associates_line_enabled`, the associates line).
- Changes to roles, careers settings or this section emit `home`.

## 7. Admin platform (super admin dashboard)

Follow the dashboard's existing shell, auth and patterns (white top bar with hairline, page title, sub-nav with an underline on the active item, mono status annotations, tables with hairlines, primary and secondary buttons). Every route and action checks permissions server-side; signed-out visits go to sign-in and return (relative return paths only).

### 7.1 Navigation

Two new sidebar items under the dashboard's content area: **Insights** (document icon) and **Careers** (briefcase icon, with a count badge of `new` applications). Routes under the dashboard base path:

- `/insights` → `/insights/posts`; `/insights/posts`, `/insights/posts/new`, `/insights/posts/[id]`; `/insights/authors`, `/insights/authors/[id]`; `/insights/topics`; `/insights/settings` (homepage section, page copy).
- `/careers` → `/careers/roles`; `/careers/roles/new`, `/careers/roles/[id]`; `/careers/applications`, `/careers/applications/[id]`; `/careers/settings` (page copy, values, benefits, process, policies, empty state, associates, notifications, retention, homepage section).
- `/content/sync` (3.7).

### 7.2 Insights › Posts

- List: tabs **All · Drafts · In review · Scheduled · Published · Archived** with counts; search (title, excerpt); filters (format, author, topic); columns: Title (with "UNPUBLISHED CHANGES" tag when the working copy differs from the snapshot), Format, Author, Status (Published `mineral-text`; Scheduled `accent-text` with date and time; In review; Approved; Draft and Archived `ink-muted`), Sync (3.7), Updated. Row actions: Edit, Preview, View on site (published only), Duplicate, Archive.
- Editor: main column with Title, Excerpt (counter to 220), and the body editor: a Markdown textarea with a toolbar (headings, bold, italic, link, lists, quote, code, table, image, footnote, callout), keyboard shortcuts, and **Write / Preview / Split** tabs where Preview uses the website's renderer. Image upload by drag-and-drop or paste goes to the media storage, asks for alt text before inserting, and stores dimensions. Autosave the working copy every 10 s and on blur with "SAVED 14:21" in mono; conflict detection by `updated_at` (if someone else saved, show "This post changed since you opened it" with Reload / Keep mine).
- Right rail: **Status & publishing** (current status, sync status, buttons that follow the workflow: Submit for review · Approve · Publish · Schedule (date and time, Europe/London) · Publish changes · Unpublish · Archive; destructive actions confirm inline); **Editorial checks** (4.5, disabled Publish explains which checks are missing); Slug (with the redirect warning); Format; Authors (multi, ordered; only confirmed authors are selectable for publishing); Topics and sectors; Practice; Cover (upload, alt, caption); Homepage (Featured, Pin to homepage); Call to action (label and link, internal paths or vitalos.co.uk only); SEO (title, description with counters, canonical, noindex) with a search-result preview; "This is a material update" checkbox (sets the public Updated date on the next publish); **Revisions** (list of published revisions with who and when; View, Compare with current (text diff), Restore to working copy); Delete (drafts never published only; otherwise Archive).
- **Preview** opens the website in draft mode (3.6).

### 7.3 Insights › Authors and Topics

Authors: list and editor (name, slug, role title, bio, photo upload with crop to square, LinkedIn URL, link to a dashboard user, **"This is a real person who has approved this profile"** confirmation recorded with who and when, active toggle). Deactivating an author with published posts is blocked until their posts are reassigned or archived. Topics: list with ordering, name, slug, description, kind; the approved seeds cannot be deleted while posts use them.

### 7.4 Careers › Roles

- List: tabs **Open · Drafts · Paused · Closed · Archived** with counts; columns: Title, Practice, Location, Status (Open `mineral-text` with "CLOSES 30 NOV"), Applications (new / total), Sync, Updated.
- Editor: fields from 4.2 in sections (Basics · Location and work model · Salary · Description sections (Markdown with the shared preview) · Application (form or external URL) · Dates · Homepage). Validation to **open**: title, practice, location, work model, employment type, summary, about and requirements filled; salary either shown with min and max (max ≥ min) or explicitly hidden with an inline note "Check whether salary information is required for this role"; external URL valid HTTPS when `apply_mode = external`. Actions: Open · Publish changes · Pause (hides the role and stops applications) · Close now · Reopen · Archive · Duplicate · Preview · View on site. Same working copy / snapshot / revision model, sync status and audit as posts.

### 7.5 Careers › Applications

- List: tabs **New {n} · Reviewing · Interview · Offer · Hired · Rejected · Withdrawn · All**; filter by role; search name or email; columns: Name, Role, Stage, Received (mono "2 DAYS AGO"), Right to work, Flags ("DUPLICATE"). Roles with `apply_mode = external` collect no applications here. Opening an application marks it seen; the badge counts `new` and unseen.
- Detail: header with name, role and stage select; contact block; answers; cover note; **Download CV** (a 60-second signed URL with `Content-Disposition: attachment`, every view written to `application_events`); assign a reviewer; internal notes; timeline of events; Previous / Next within the current filter; **Delete application** (hard delete of the row and CV, inline confirm, audited with a hashed id).
- Candidate emails (receipt, rejection, invitation to talk): templates with editable text in settings and a preview, **sent only when `CAREERS_CANDIDATE_EMAILS_ENABLED=true`** (off; approval list). Until then the detail page shows "Candidate emails are off. Reply from your own mailbox." with a mailto link.
- Alerts to the hiring team (internal only): in-app notification on each new application ("{Name} applied for {role}"), and an email to the notification recipients through the existing provider, deduplicated to one email per role per 10 minutes listing every new application in that window, deep link `{admin base URL}/careers/applications/{id}` (never a login token in the link). Sender `Vitalos Careers <careers@notify.vitalos.co.uk>` once the subdomain is verified; the existing sender and `@vitalos.co.uk` recipients until then.

### 7.6 Settings pages

Insights › Settings: homepage section (5.6) with a live preview of the section, index page copy. Careers › Settings: everything listed under careers settings (4.2) plus the homepage section (6.5) with a live preview. Every change is validated, audited, and emits its sync event.

## 8. Relay integration

(Relay is not built. Amendment A8: only a publish/unpublish hook behind `CONTENT_RELAY_SYNC_ENABLED=false`.) When Relay exists: on every post publish or publish-changes, upsert a Relay knowledge document (`type = 'insight'`, `source_ref = 'post:{id}'`, `url = /insights/{slug}`, body from the published snapshot); on unpublish, archive or delete, archive it. On role open or publish-changes, upsert `type = 'role'` (`source_ref = 'role:{id}'`, `url = /careers/{slug}`, body: title, practice, location, work model, employment type, salary only if shown, summary, sections, closing date); on pause, close, archive or delete, archive it. Also maintain one `type = 'page'` document "Careers at Vitalos" from the careers page copy and the current list of open roles. Done inside the outbox handler (after commit), retried with the event, never blocking a publish.

---

# Part B: the owner's reply (Amendment 1 and sections 9 to 14)

**Decision: go with the recommendation.** Keep the brief's behaviour and fit it to the current architecture (ADR-026, ADR-029). Write a new ADR that supersedes ADR-028 for Insights and Careers only, citing its revisit trigger ("a non-developer needs to edit content regularly"). Work in a separate worktree off `origin/main`; leave `feat/email-templates` untouched. Fallbacks accepted: the repo's design tokens instead of `docs/relay/reference/`, Relay sync off, and local databases in a VM slot as AGENTS.md requires.

Where Amendment 1 conflicts with sections 1–8, the amendment wins; everything else in 1–8 still defines the behaviour, copy and design.

## Amendment 1: architecture

### A1. Ownership and boundaries

- The Django super admin (admin.vitalos.co.uk, its own Postgres) owns all Insights and Careers data. Add Django apps `insights`, `careers` and `content_sync` beside `enquiries`, following the Enquiries app as the pattern. Models map one to one to the tables in section 4 (posts, authors, topics, post_authors, post_topics, post_related, post_revisions, editorial_checks, slug_redirects, site_sections, roles, role_revisions, applications, application_notes, application_events, careers settings, sync events), using Django migrations, `TextChoices` for enums and `JSONField` for snapshots and config. Working copy, published snapshot and immutable revisions work exactly as in decision 1.3.
- **No** `content`, `careers` or `sync` schemas in the website's Supabase. This job does not touch the website's database at all.
- The website never reads the admin's database and never writes content. The two apps talk only over signed HTTP, as Enquiries does. Reuse the Enquiries signing scheme and helpers on both sides, with **one key per direction and purpose** (read, revalidate, render, preview, careers submission), so each can be rotated or revoked on its own. If the scheme covers only POST, extend it to sign the method, the path with query string, a timestamp and a body hash.
- Email: reuse the admin's existing sending (as Enquiries notifications do). If no sender is verified, store emails in an admin email log and send only to `@vitalos.co.uk`.
- Insights or Careers content that currently lives in repo files (ADR-028) is imported into the admin as drafts (A7). The website stops reading those files for Insights and Careers once the admin is the source. Do not delete the files.

### A2. Contract instead of shared TypeScript

- `contracts/content-api/v1/openapi.yaml` is the source of truth for every request and response between the two apps. `contracts/content-api/v1/tags.json` defines the cache-tag names, their patterns and the event-to-tag mapping in 3.3. Shared fixture payloads live in `contracts/content-api/v1/fixtures/`.
- Admin: serializers are tested against the contract (if the admin uses DRF, generate the schema with drf-spectacular and diff it against the committed file in CI).
- Website: types generated with `openapi-typescript`; every response validated at runtime with zod schemas that mirror the contract; a contract test runs the shared fixtures through both the Django serializers and the website's zod schemas. CI fails on drift.
- The admin computes and sends slugs, reading time, formatted dates and salary strings, so the two apps can't disagree about them.

### A3. Read API on the admin

Signed, server-only, JSON `GET` endpoints under `/api/content/v1/`:

- `insights/posts?page&format&topic&author` (summaries, 12 per page, total), `insights/posts/{slug}` (full published snapshot, or `{ "redirect": "{newSlug}" }`, or 404), `insights/authors/{slug}`, `insights/topics`, `insights/topics/{slug}`, `insights/feed` (newest 20).
- `careers/page` (copy, settings, open roles grouped by practice), `careers/roles/{slug}` (open snapshot, `{ "state": "closed", "closedAt": … }`, redirect, or 404).
- `home` (both homepage sections, config plus items, in one call), `sitemap` (every public URL with lastmod), `site-state` (whether Insights and Careers are open; A6), `preview/{entity}/{id}` (working copy; needs a valid preview token as well as the request signature), `health`.
- Only published snapshots leave the admin, with the query-time filters applied on every request (`scheduled` with `publish_at <= now()` counts as published; `closes_at <= now()` counts as closed). Responses never include drafts, notes, applications, admin users or email addresses.
- Website calls: 2.5 s timeout, one retry on network errors and 5xx.

### A4. Caching and availability on the website

- Readers are cached with the tags from `tags.json` and `CONTENT_CACHE_TTL_SECONDS` (600): Cache Components if `apps/web` already has it on, otherwise `unstable_cache`.
- Publish and publish-changes events: `revalidateTag(tag, 'max')`, then the revalidate route warms each affected path with a server-side request, so the new version renders straight away while the old one is still served. Removal events (unpublish, archive, delete, pause, close, slug change): `revalidateTag(tag, { expire: 0 })`, so removed content is never served again.
- **The website stays up when the admin is down.** A failed read is never cached. Pages already cached keep being served. Homepage sections that can't load are left out (the homepage never errors because of them). An Insights or Careers page with nothing cached returns 503 with `Retry-After: 120`, never 404, so search engines don't drop it.
- Check the installed Next.js version's behaviour with the availability tests in section 13. If it differs, choose the approach that passes both the freshness and the availability tests, and record it.

### A5. Sync, scheduler and preview

- The outbox is `content_sync.SyncEvent` in the admin, written in the same `transaction.atomic()` block as the change, revision and audit row, delivered with `transaction.on_commit` to every URL in `CONTENT_WEB_TARGETS`, and retried by the tick. Signature, timestamp, tag and path validation, backoff and alerts as in 3.4.
- The per-minute tick is a management command, `content_tick`: promote due scheduled posts, close expired roles, deliver pending events, run retention, purge orphan uploads. Use `select_for_update(skip_locked=True)` so overlapping runs never double-process. Run it on the admin's existing scheduler. If there is none, add the lightest one the admin's hosting supports and record it. Last resort: a signed `POST /api/content/v1/tick` that the website's Vercel Cron calls every minute, if the plan allows.
- Preview: the admin signs a preview token with `CONTENT_PREVIEW_SECRET` (entity, id, revision hash, 15-minute expiry) and opens `{web}/api/content/preview?token=…`. The website verifies it, enables `draftMode()`, keeps the token in an HttpOnly, Secure, SameSite=Lax cookie, and reads the working copy from `preview/{entity}/{id}`, uncached. The preview bar, noindex and no-store work as in 3.6.
- The sync status UI (3.7) is built in the admin from `SyncEvent` rows.

### A6. Open and closed

Insights and Careers stay **closed** by default, behaving as they do today. Opening each becomes an admin setting (`insights_open`, `careers_open`, both off) served by `site-state`. While a section is closed: its pages behave as they do now, and it is left out of the homepage, sitemap, feed and footer; previews still work. Tests open them in the test environment only. Opening either in production is on the approval list.

### A7. Rendering, admin preview and the editor

- There is one Markdown renderer (the 4.4 feature set), and it lives in the website. The website exposes `POST /api/content/render`, signed by the admin, with body `{ markdown, context: "post" | "role" | "author" | "settings" }` (max 200 KB; rate-limited; no-store). It returns `{ html, toc, footnotes, warnings }`. Warnings cover missing alt text, an h1 in the body, images not on the media host, and stripped HTML.
- The admin's Preview and Split tabs call it server-side and show the HTML in a sandboxed iframe (`srcdoc`, no `allow-scripts`) with the website's article styles inlined. Publish is blocked while blocking warnings remain. If the render endpoint can't be reached, the tab says "Preview unavailable. Your changes are saved." and editing carries on.
- The admin UI uses the admin's existing stack and patterns (whatever Enquiries uses). The behaviour in section 7 stands; the look follows the admin's existing design.
- `manage.py import_repo_content` copies any ADR-028 Insights or Careers files into the admin as drafts (idempotent by file path; dry run by default).

### A8. Media, CVs and Relay

- Post and author images live in the admin's object storage under public-read uuid keys behind a CDN or public host. Add that host to `next/image` `remotePatterns` and CSP `img-src`. Allowed: JPEG, PNG, WebP or AVIF, up to 5 MB, with dimensions stored.
- CVs live in a private bucket or prefix in the same storage. If the admin has no object storage, add S3-compatible storage the hosting supports and record it (if it costs money, prepare it for approval and use the A9 fallback meanwhile).
- Relay (section 8): Relay isn't built, so add only a publish/unpublish hook in the outbox handler that a future Relay integration can subscribe to, behind `CONTENT_RELAY_SYNC_ENABLED=false`.

### A9. Applications (replaces the upload flow in 6.3; fields, copy and behaviour unchanged)

1. The browser calls the website's `POST /api/careers/uploads` with `{ roleSlug, filename, size, mime, turnstileToken }`. The website verifies Turnstile and rate limits, then asks the admin (signed) for an upload ticket. The admin returns a pre-signed PUT URL for `pending/{uuid}.{ext}` in private CV storage (10-minute expiry, exact content length, CORS limited to the website's origins). Fallback with no object storage: a single-use signed upload URL on the admin itself (`/api/careers/v1/uploads/{ticket}`, same CORS limits, 10 MB enforced at the proxy and in Django).
2. The browser uploads the file directly. It never passes through the website's function, which has a request size limit.
3. The browser submits the form to the website's `POST /api/careers/applications`. The website validates it and forwards it to the admin, signed, with the upload id. The admin checks the object (exists, size, magic bytes), moves it to `applications/{id}/cv.{ext}`, creates the application, writes the audit row and notifies the hiring team.
4. Rate limits on the website reuse whatever Enquiries uses. Duplicate detection happens in the admin.

**Additions to the approval list (0.2):** opening Insights or Careers in production; deleting the ADR-028 repo files once the admin holds the content; any new paid storage or scheduler.

## 9. Security, privacy and abuse

- **Authorisation (admin):** Django permissions on every view and endpoint, through the admin's existing auth and groups: `insights.change_post`, custom `insights.publish_post`, `careers.change_role`, `careers.publish_role`, `careers.view_application`, `careers.view_cv`, `careers.delete_application`. Never trust ids from the client for access decisions. Every state change writes the audit log.
- **Inter-app endpoints (both directions):** every request signed and timestamped (reject skew over 300 s), constant-time comparison, scoped keys (A1), rate-limited, `Cache-Control: no-store`. The read API never returns unpublished data. Preview needs both a valid signature and a valid preview token. The revalidate route validates every tag against `tags.json` and every path against the known route patterns.
- **Rendering:** only the website's sanitised renderer (4.4). Never render HTML from editors, candidates or imported files. CTA links must be internal or on vitalos.co.uk; external apply URLs must be HTTPS. The admin shows rendered previews only inside a sandboxed iframe without scripts.
- **Applications (personal data; CVs can contain special-category data):** private storage; upload tickets limited to `pending/`, single use, exact size; magic-byte checks (`%PDF-`, or a ZIP containing `word/document.xml`); original filenames stored separately, never used as storage keys. CVs are downloaded only by permitted admins, through 60-second signed URLs with `Content-Disposition: attachment`, and every view is recorded in `application_events`. Turnstile, honeypot and rate limits: per IP 5 uploads and 3 applications an hour; per email 3 applications a day. No CV content or candidate data in logs, and none sent to any AI provider.
- **Retention:** run nightly from `content_tick` or its own job. Delete applications and their CVs `retention_months` (default 6) after `decided_at` or the role's `closed_at`, whichever is later. `hired` applications are flagged for manual handling, not deleted. Pending uploads older than 24 hours are deleted. Every deletion is audited with a hashed id.
- **Privacy:** write, but don't publish, `docs/content/PRIVACY.md`. It contains a candidate privacy-notice section (purpose, data collected, lawful-basis options, processors (the admin's hosting and storage, the email provider, Cloudflare Turnstile, Vercel), retention, candidate rights, how to withdraw) and a short DPIA note for recruitment data.
- **CSP:** on the website, add the media host to `img-src`, the CV upload host to `connect-src` (object storage, or the admin for the fallback), and Turnstile (`https://challenges.cloudflare.com`) to `script-src` and `frame-src`. On the admin, make sure the preview iframe's inlined styles are allowed and that it cannot run scripts.
- **Logging:** ids, timings and error codes only; no bodies or personal data, in either app.
- **Robots:** previews and every non-production deployment send `noindex`.
- **Keys:** document how to rotate each scoped key with no downtime (accept old and new key ids during the overlap), following the Enquiries approach.

## 10. Configuration

Follow the naming of the existing Enquiries variables, and reuse existing ones (Turnstile, email, storage, cron) instead of adding duplicates. Add every variable, without values, to each app's `.env.example`.

Website (`apps/web`):

```
CONTENT_API_BASE_URL=https://admin.vitalos.co.uk
CONTENT_READ_KEY_ID=
CONTENT_READ_SECRET=              # secret; signs read-API calls to the admin
CAREERS_SUBMIT_KEY_ID=
CAREERS_SUBMIT_SECRET=            # secret; signs upload-ticket and application calls
CONTENT_REVALIDATE_SECRET=        # secret; verifies the admin's revalidate calls
CONTENT_RENDER_SECRET=            # secret; verifies the admin's render calls
CONTENT_PREVIEW_SECRET=           # secret; verifies admin-issued preview tokens
CONTENT_CACHE_TTL_SECONDS=600
CONTENT_MEDIA_HOST=               # public media host for next/image and CSP
CAREERS_UPLOAD_HOST=              # object storage (or admin) host for CSP connect-src
NEXT_PUBLIC_TURNSTILE_SITE_KEY=   # reuse
TURNSTILE_SECRET_KEY=             # reuse
```

Admin (Django):

```
CONTENT_WEB_TARGETS=              # comma-separated website base URLs (preview, production)
CONTENT_READ_CLIENT_KEYS=         # secret; accepted key ids and secrets for the read API
CAREERS_SUBMIT_CLIENT_KEYS=       # secret; accepted keys for upload tickets and applications
CONTENT_REVALIDATE_SECRET=        # secret; signs revalidate calls to the website
CONTENT_RENDER_SECRET=            # secret; signs render calls to the website
CONTENT_PREVIEW_SECRET=           # secret; signs preview tokens
CONTENT_MEDIA_BUCKET=
CONTENT_MEDIA_PUBLIC_BASE_URL=
CAREERS_CV_BUCKET=
CAREERS_CV_MAX_MB=10
CAREERS_EMAIL_FROM=               # the admin's existing verified sender, or the log fallback
CAREERS_CANDIDATE_EMAILS_ENABLED=false
CONTENT_RELAY_SYNC_ENABLED=false
```

## 11. Discovery

Write `docs/content/DISCOVERY.md` covering: the Django super admin (layout; Enquiries as the reference app; auth, groups and permissions; UI stack; audit log; notifications; email backend and sender; background jobs and scheduler; file and object storage; test runner; deployment target, how migrations run, request size limits at the proxy); the Enquiries integration end to end (signing, keys and rotation, the website route, the admin endpoint, Turnstile, rate limiting, error handling); ADR-026, ADR-028 and ADR-029 (the current "closed" mechanism for Insights and Careers, and any repo-file content); the website (Next.js version and Cache Components; homepage composition; sitemap, robots, metadata and CSP; footer and nav sources; image config; tests); the monorepo (both apps in it; how to run both locally in a VM slot per AGENTS.md).

## 12. Delivery phases (back to back; each ends with tests passing, a commit and a one-line status)

1. **Phase 0: Discovery and decisions.** `docs/content/PLAN.md`, `DISCOVERY.md` and `DECISIONS.md`. ADRs (next free numbers): (a) admin-managed Insights and Careers, superseding ADR-028 for those areas only; (b) the content API contract, signing scopes, caching, availability and sync; (c) recruitment data handling, storage and retention; (d) the scheduler and (e) the object storage, if either is new.
2. **Phase 1: Contract and plumbing.** `contracts/` (OpenAPI, `tags.json`, fixtures). Admin: Django apps with models, migrations and permissions; signing for every scope; the read API; the outbox with `on_commit` delivery; `content_tick`. Website: typed client with zod validation; cached readers with tags; `/api/content/revalidate`, `/api/content/render` (the 4.4 renderer) and `/api/content/preview`; `site-state` handling. _Done when:_ contract tests pass in both apps; with both apps running locally, a signed event revalidates a tagged read; tampered, stale or wrong-scope signatures return 401; migrations apply on a fresh admin database; a test that seeds every status proves the read API never returns unpublished data.
3. **Phase 2: Insights admin.** Posts list and editor, authors, topics, workflow and editorial checks, revisions and restore, media upload, render preview in the sandboxed iframe, draft-mode preview, sync status and the sync log, audit, `import_repo_content`. _Done when:_ a fixture post goes draft → review → approved → published with every check recorded, and Publish is blocked while a check or a blocking render warning is missing.
4. **Phase 3: Insights website and homepage section** (behind `insights_open`). Index, pagination, filters, topic and author pages, article, SEO, OG images, feed, sitemap, the `/blog` redirect, the homepage section and its settings. _Done when:_ the sync suite passes with ≤ 5 s p95 over 20 publishes; the availability suite passes; Lighthouse shows no homepage regression; axe passes; screenshots at 1440, 768 and 390 widths. **Open the PR.**
5. **Phase 4: Careers** (behind `careers_open`). Admin roles, applications, settings and alerts; `/careers`, role pages, the A9 application flow, JSON-LD, the homepage section; retention; candidate email templates behind their flag. _Done when:_ the careers suite passes. Open a role and it appears on `/careers` and the homepage within 5 s. Apply with a PDF and the admin shows the application, the CV download and an alert, with one internal email (or log entry) sent. Close the role and it leaves the list and the homepage, its page shows the closed state, and its JSON-LD and sitemap entry are gone.
6. **Phase 5: Integrations.** Import any ADR-028 content as drafts; the Relay hook (flag off); footer and About links (shown only when open).
7. **Phase 6: Hardening and handover.** Security review of every endpoint in both apps. Key-rotation steps; `PRIVACY.md`. Load test: 50 publishes in 5 minutes, all delivered within target. Availability drill: stop the admin, confirm the homepage stays up and cached pages are served, restart, confirm recovery. Runbook `docs/content/README.md`: architecture, env, how sync works, how to resync, failure modes, retention, how to open Insights and Careers, publish the first Insight and open the first role. PR ready or merged; final report.

## 13. Testing

- **Admin** (the repo's Python runner): workflow and editorial-check gating per revision hash; slug redirects; outbox atomicity (a forced failure rolls back the change and the event together); `content_tick` under concurrent runs (scheduled promotion and role closing happen exactly once); the read API with every status seeded returns no draft, scheduled-not-due, paused, archived or deleted item, no notes and no applications; signing (valid, tampered, stale, wrong scope); preview tokens; upload tickets and verification (PDF, DOCX, a renamed EXE, a ZIP that is not DOCX, oversize, a reused ticket); duplicate detection, retention, permissions on every view, and candidate emails never sending with the flag off.
- **Website** (Vitest): zod validation of every fixture; cache tags match `tags.json`; revalidate route (valid, tampered, stale, bad tag, bad path); render route sanitisation against an XSS corpus (script tags, `javascript:` links, event handlers, data URIs, SVG, nested Markdown/HTML tricks); JobPosting builder omits the block when a required field is missing; homepage fail-soft; the 503 behaviour.
- **Contract:** the shared fixtures through both the Django serializers and the website's zod schemas; the OpenAPI drift check.
- **E2E (Playwright + axe, both apps running locally per AGENTS.md):**
  - _Sync suite:_ publish (the article, index, topic page, author page, feed and homepage show the post within 5 s); publish changes (the new title appears everywhere within 5 s, and unpublished working-copy edits never appear); slug change (the old URL returns 308); unpublish (404, and gone from the homepage, feed and sitemap within 5 s); schedule for now + 70 s (the post appears within 2 minutes); website target down (SYNC PENDING, then SYNC FAILED after 3 attempts, then Retry once it is back, then synced); preview (shows a draft while the public URL stays 404 and the public cache is unaffected).
  - _Availability suite:_ stop the admin. The homepage renders without the two sections, a cached article is still served, and an uncached article returns 503 with `Retry-After`. Restart the admin and everything recovers without a redeploy.
  - _Careers suite:_ the Phase 4 scenario; validation errors and focus; oversize and wrong-type CVs; applying to a role closed after page load; a flagged duplicate; a keyboard-only application.
  - _Accessibility:_ 200% zoom and reduced motion.
- **Visual:** every public page and both homepage sections at 1440×900, 768×1024 and 390×844, light and dark, against the current site's header and section styles; admin screens at 1440 against the admin's existing design. Record intentional differences in `DECISIONS.md`.

## 14. Final report

- **Done:** what works; preview URLs (with Insights and Careers opened in preview only); the PR link (merged or ready); screenshots; the measured sync timings (p50 and p95); and the availability drill result.
- **Needs approval:** everything in 0.2 and the A1–A9 additions, each with exact next steps: opening Insights and Careers in production, publishing the first Insight and opening the first role (a two-line how-to for each); candidate emails; the sender domain, if the admin has none verified; the candidate privacy notice, the retention period and the equal-opportunities statement; CAR-01 confirmation for the associates line; deleting the ADR-028 repo files; any paid storage or scheduler; going live on vitalos.co.uk.
- **Blockers:** expected none. Anything unfinished must already have a working fallback; list it as a follow-up with the fallback in use.
- **Created:** every key id and secret name (never a value), env var, Django app and migration, scheduler job, storage bucket or prefix and its CORS rules, Vercel env var, GitHub secret, webhook target and ADR number.
