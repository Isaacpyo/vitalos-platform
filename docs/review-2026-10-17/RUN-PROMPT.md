# Overnight review-and-fix run prompt (17 October 2026)

Copied verbatim from the run brief so every workstream agent works from the same text. Section numbers are referenced from PLAN.md and the agent briefs.

### 0. How you work

#### 0.1 Rules for the whole run

- **Run end to end without stopping.** No questions, no waiting for plan approval. When something is unclear, choose the most reasonable option, write it in `docs/review-2026-10-17/DECISIONS.md` with the reason, and keep going.
- **Parallel agents.** One subagent per workstream (section 3), each in its own git worktree on its own branch off `feat/review-2026-10-17`. Each agent owns its workstream completely, runs its own tests, commits per task, and reports back with a short summary. Keep every agent inside the file areas listed for it so merges stay clean; shared files (tokens, nav, layout, Django settings, shared packages) are changed only by the workstream named as their owner, and other agents send the orchestrator a request instead.
- **Repo rules:** read and follow `AGENTS.md`, `docs/adr/`, `CLAUDE.md`, and the root configs (worktree and VM-slot rules, pnpm + Turborepo, TypeScript strict, Django conventions, test runners). Reuse existing components, tokens, icons, utilities and Django apps; never add a second way of doing the same thing. Do not reuse the obsolete public repo `Isaacpyo/Vitalos`.
- **Never touch production.** No pushes to `main`, no merges to `main`, no DNS, no Vercel domain changes, no changes to the Vercel production project settings. Code goes to preview deployments only. Admin content changes go in as **drafts** or stay behind settings that are already off; nothing is published, opened, unpublished, closed or deleted in production content.
- **Integrity rule (hard):** never invent clients, logos, case studies, outcomes, metrics, testimonials, certifications, partnerships, awards, team size, offices, people, episodes or quotes. Every new sentence of public copy must trace to an approved source (0.4). Shortening is fine; adding claims is not. Where copy is needed and no source exists, leave a clearly marked gap in the report, not a guess on the page.
- **Brand precedence:** `brand/brand-book.md`, `brand/applications.md`, `brand/tokens.json`, `brand/messaging.md` (or their copies under `docs/relay/reference/brand/`) → the homepage as built in `apps/web` → this prompt. This prompt wins on behaviour, data, security and on what counts as a defect.
- **Secrets:** never commit or print a value. List every secret created by name in the report.
- **Time budget:** highest-value, lowest-risk items first (bugs, security, measurement, content drafts), larger visual work second. If a workstream is not finished, it merges what passes tests and lists the rest as follow-ups with the current fallback.

#### 0.2 Prepared for approval, never executed

- Merging the PR, and anything that deploys to vitalos.co.uk or admin.vitalos.co.uk production.
- Switching the production nav to the IA variant.
- Publishing any Insight, opening any role, or changing any Careers or Insights content that is currently live (drafts and proposals only).
- Enabling candidate emails, visitor emails from Relay, or any email to anyone outside `@vitalos.co.uk`.
- Changing, disabling or renaming the `admin@vitalos.co.uk` primary-owner account, or any user, role or 2FA setting.
- DNS records.
- Any spend.
- The About-page founder section, the Offers investment bands, the Careers benefits and hiring-process text, and the equal-opportunities statement: drafted, not published.
- Removing or hiding the Podcast and the Architecture/Service lines module (implemented behind flags so the decision is one toggle).

#### 0.3 Decisions already made

See `DECISIONS.md` entries 1–7.

#### 0.4 Approved sources for public copy

Only these: the existing pages and content files in the repo; `brand/messaging.md`; the Vitalos Master FAQ (synced into the admin's Relay knowledge base); the admin Company profile (legal name, company number, registered office, support email, social links); the published Insight "Strategy that gets engineered: introducing Vitalos" and its author profile; `docs/` in the repo including Stage documents if present; notes in `docs/review-2026-10-17/` written from those sources. Nothing from the open web, nothing from memory.

### 1. Findings

See `FINDINGS.md` for the full table (ids A1–F8, severity, owner, status). Detail per finding:

**1A Brand and visual.** A1 one AI-generated industrial/refinery cityscape photo is the hero background on every page; brand forbids AI-generated and stock imagery. A2 "glowing brain on a chip" 3D icon for AI Transformation (homepage Solutions carousel slide 01/06 and `/solutions/ai-transformation` hero). A3 glossy 3D icons in the How We Work lifecycle ring (home and `/how-we-work`) and the Solutions carousel clash with the flat line icons in Industries cards, Explore cards and mega menu. A4 stock photography of people: Industries cards on the homepage and `/industries/health-care` hero. A5 empty `MediaSlot` placeholders visible in production on `/about` and `/careers` heroes; production should render no block and not reserve space. A6 every hero is the same dark block; practice, solution, offer and industry pages near-identical. A7 offer heroes show a lone icon in a card with a "Typical duration" chip. A8 Turnstile renders dark inside the light contact form; set theme to match. A9 "Problems we solve" title clipped mid-reveal; reveal animations must never clip and must respect `prefers-reduced-motion`.

**1B Content and IA.** B1 "Five practices, one firm" on homepage, `/what-we-do`, `/about`, footer (five practice links) vs six; "one of five areas" in the article vs six solutions. B2 header nav vs locked IA; Industries and Insights not reachable from header; Offers and Industries absent from What We Do mega menu; "Support" label. B3 `/work` 404 and no proof of work; fix is a true "How we prove it" approach (Labs assets, delivery lifecycle, Trust Centre commitments, Insights); nothing may link to `/work`. B4 `/about` is 249 words: no founder, story, location, company facts; empty hero image; Explore cards title-only. B5 `/podcast` 33-word noindex page with no episodes; footer gives it a column. B6 Insights batch 2 (20 approved articles) not imported; 0 drafts. B7 Careers Benefits, hiring process, salary policy, equal-opportunities empty; 7 draft roles unreviewed; all three open roles show "£70,000–£85,000 a year" — verify each. B8 Trust Centre index 167 words, sub-pages thin; no `/.well-known/security.txt`; no clear procurement-pack request route. B9 offer pages ~300 words; "Typical duration: Short engagement" vague; no "what happens next", no sample deliverable, no investment band (bands need approval; draft only from Stage documents). B10 `/faq` 34 questions, no `FAQPage` JSON-LD, no filter, no anchors, no "still have a question" route. B11 contact: email only, no response-time promise, no address, no booking link; make the promise concrete only if Temitope confirms. B12 404 `<title>` is "Vitalos"; no suggested routes. B13 CTA labels vary; check each lands on a matching page/form state (offer CTA pre-selects that offer intent). B14 articles: no share links, no related posts, initials-only author block, no author photo slot, no "Updated" handling.

**1C Technical.** C1 no analytics. C2 Relay chat panel in the DOM on every page when closed, as the first `<article>`, silently restoring the previous transcript; render only when opened (or `inert` + `aria-hidden`, not `<article>`), do not restore without the visitor choosing to. C3 unnamed links (logo, header "Talk to Vitalos", hero "Explore what we do"); 43 empty-alt images on home, 32 on `/what-we-do`; decorative images `aria-hidden`; no axe run recorded. C4 CSP `script-src 'unsafe-inline'`; no `X-Frame-Options`; `frame-ancestors` unconfirmed; HSTS max-age only. C5 CWV/Lighthouse not measured; hero video and large hero photo are LCP risks. C6 mobile 390 px not verified (mega menu, Relay launcher over footer, forms, Turnstile). C7 `sitemaps/pages.xml` top-level pages lack `lastmod`; index lastmod 10 Oct. C8 no web manifest, no `theme-color`, no `apple-touch-icon.png` alias. C9 RSS autodiscovery only on `/insights`; add site-wide and a footer link. C10 `/llms.txt` completeness; `llms-full.txt` if a generator exists. C11 validate every JSON-LD type in CI; add `FAQPage` on `/faq`, `Person` on `/about` and the author page, `CollectionPage` + `ItemList` on indexes.

**1D Relay.** D1 509,640 input tokens for 4 conversations (~127k each): whole KB stuffed into every call; switch to retrieval (top-k, capped), short window, measure tokens per turn before/after. D2 unanswered: "who is the founder of Vitalos?", "what are your solutions?" (typo), "so how can I modernise my system with this?", "getting started", "Hello"; add greeting/small-talk handling, typo tolerance, entries for founder (from author profile), solutions list, getting started (Two ways to start). D3 visitor chat shows "TEMITOPE.AGBOLA · VITALOS" (username fallback); show first name + "Vitalos". D4 website CMS sync 31 h old, repo 34 h, Master FAQ 46 awaiting confirmation; schedule sync hourly; surface awaiting-confirmation on Overview. D5 "TEAM OFFLINE" with no expectation; add next opening time and leave-email offer. D6 log thumbs-down reason (wrong, incomplete, didn't understand).

**1E Admin bugs.** E1 Relay Insights "HAND-OFF RATE 2500%" (4 conversations, 1 hand-off → should be 25%); fix + unit test. E2 `/api/docs/` mojibake "Settings â†’ API tokens"; fix + UTF-8 test. E3 Insights posts table overflows at 1440 px, Archive cut off; sticky actions or menu. E4 Overview, Service lines, Architecture hollow (0 practices, "Headline KPI: Not set", "Owner not assigned"). E5 VIT-0001 overdue by 3 days and unassigned but no notification; stale smoke-test notifications. E6 Team page "No team members yet" while two users and an author exist; three unlinked identity records. E7 assignee and "who hears about new applications" show emails. E8 Account Full name empty and not required. E9 System health: sending domain never checked; attachment storage not configured; Resend 100/day with no warning threshold.

**1F Admin gaps.** F1 Overview as the morning screen. F2 website analytics panel on Overview (provider API or link-out). F3 identity: required display name; link user ↔ team member ↔ author by email; names everywhere; Team page lists real users. F4 Insights editor: Author 1–4 dropdowns → multi-select; native file input → styled control with preview; media library; word count / reading time; layout imbalance. F5 Help & docs: workflow guides. F6 Architecture: dry-run import from web content and a module flag. F7 `admin@vitalos.co.uk` primary owner, superuser, never signed in: prepare the change for approval. F8 admin 390 px pass.

### 3. Workstreams

#### WS1 — Visual system and imagery

Owns `apps/web` hero/section/icon/media components, `public/media`, brand artwork additions. Fixes A1–A9.

- **Hero system.** Replace the single photo background with a brand-system hero: generative, deterministic SVG/CSS artwork from the brand's graphic language (architectural grid, convergence lines, cobalt-and-mineral strokes of the mark) parameterised per page family (home, What We Do family, Industries, About/How We Work, Labs, Insights, Careers, Trust, Contact, 404) so families are distinguishable. Keep the dark hero where the homepage uses it; introduce a light compact hero for detail pages (offers, articles, roles, legal). Keep the hero video on the homepage only, with the existing pause control, `preload="metadata"`, a poster frame, no autoplay under `prefers-reduced-motion` or Save-Data.
- **Icons.** Retire glossy 3D icons. Draw missing icons as SVG components in the existing line-icon style. AI Transformation visual becomes an abstract diagram (assess → prototype → production → managed) in line style, never a brain, chip or robot. Lifecycle ring uses the line set.
- **Photography.** Remove stock photos from Industries cards and sector heroes; use family artwork or a `MediaSlot` that renders nothing in production until a real image exists. Register every slot in `media-slots.ts` with a brief; generate `docs/review-2026-10-17/IMAGE-BRIEF.md` (every slot, ratio, size, what a real photograph should show, who could take it).
- **Placeholders.** `MediaSlot` in production renders nothing and collapses layout when the file is missing, unless marked `reserve`. Preview/dev keep the labelled placeholder.
- **Offer hero.** Replace icon-in-a-card with a compact "engagement summary" panel (duration, who it is for, what you get, next phase) from the offer's existing content.
- **Turnstile** theme follows the site theme. **Motion:** audit reveals for clipping; all animation off under reduced motion.
- _Done when:_ no AI-generated or stock raster image remains in `apps/web/public` or any component (list removals); homepage diff shows only intended changes; each family has a distinct hero; axe clean on changed components; LCP on `/` and `/solutions/ai-transformation` holds or improves; screenshots at 1440 and 390 per family in `ws1/screenshots/`.

#### WS2 — Content and IA

Owns page content files, nav and footer config, `about`, `trust`, `faq`, `contact`, `404`, `podcast` routes, copy files. Fixes B1–B5, B8–B13.

- **Six practices**: correct every count, list, footer column, mega-menu column, structured data and sentence. Labs as sixth entry linking to `/labs`. Log every change in `COPY-CHANGES.md` (page, before, after, source).
- **IA nav variant**: `NEXT_PUBLIC_NAV_VARIANT` = `current` | `ia`. `ia`: What We Do (mega menu: Practices, Solutions, Offers, Industries, Labs columns), Industries, Work→Labs fallback, Insights, Labs, About; Trust Centre utility link; Talk to Vitalos CTA; mobile menu to match. `current` unchanged. Preview sets `ia`; production untouched.
- **Proof approach**: no `/work` route. "How we prove it" section pattern (homepage below Practices and on `/about`) showing only true things: delivery lifecycle and quality gates, Labs assets with maturity labels, Trust Centre commitments, Insights. Audit and remove any link/copy implying case studies, clients or a Work page.
- **About**: why Vitalos exists (existing copy), six practices, how we work (link), **Founder** section from the author profile and Company profile only (name, title "Founder", published bio; `MediaSlot` for photo; nothing invented) behind `ABOUT_FOUNDER_ENABLED=false`; company facts (legal name, company number, registered office city, UK-first, international by design); Explore cards with one-line descriptions.
- **Podcast**: `PODCAST_ENABLED=false` removes footer column, route (404), sitemap entry. Keep code.
- **Trust Centre**: "what you can ask for" block; `/.well-known/security.txt` (Contact, Expires one year out, Preferred-Languages: en, Canonical) linked from Security; procurement request as a pre-filled Contact intent.
- **Offers**: "What happens next" steps (from each offer's existing next-phase line and the lifecycle), "What you receive" from existing copy; specific duration only where a source states it. Investment bands only in `OFFERS-INVESTMENT-DRAFT.md` and only if a source states them.
- **FAQ**: `FAQPage` JSON-LD, per-question anchors, client-side filter, "Ask Relay" and "Contact" routes per section.
- **Contact**: registered office (city/postcode line; full address only if marked public — note: owner removed the address from footer/JSON-LD on 12 Oct), "what happens next" steps, intent pre-selection from `?intent=` (no personal data in query string). Response-time promise stays generic.
- **404**: `<title>Page not found | Vitalos</title>`, main routes list, "Ask Relay where to find it" if no search.
- **CTA audit**: table of every CTA label → destination → what the visitor sees; fix mismatches.
- _Done when:_ no "five practices", "5 practices", "five areas" anywhere; no link returns 404; both nav variants pass axe and keyboard; `COPY-CHANGES.md` complete; schema valid on `/faq`, `/about`; `security.txt` valid.

#### WS3 — Insights content operations

Owns Insights Django editor views/templates (coordinated with WS7) and article/author components in `apps/web`. Fixes B6, B14, part of F4.

- **Import batch 2 as drafts** using the existing `import_insights_batch` command and article files. Every post **Draft**, author Temitope Agbola, topics/format from front matter, SEO title and description, editorial checks unticked. Idempotent on slug. Nothing published. If the files are not in the repo, leave the command ready for `docs/review-2026-10-17/insights-batch-2/`.
- **Article presentation**: share links (copy, LinkedIn, X; no tracking), related posts (by shared topic, three, only when they exist), author block with `MediaSlot` photo and link to author page, "Updated {date}" when material-update flag set, reading time, "Talk to us" CTA pre-selecting intent.
- **Index page**: topic filters, featured (pinned) post, RSS link when >1 post; correct for one post.
- **Editor UX**: authors multi-select of confirmed authors; styled cover upload with drag-and-drop and preview; word count and reading time; media library if storage supports listing, otherwise follow-up.
- _Done when:_ 20 drafts import green (dry-run and real) against a test database; article page shows new blocks at 1440/390 without CLS regression; editor changes have Django tests.

#### WS4 — Careers content and hygiene

Owns careers settings drafts and role/application presentation in `apps/web`. Fixes B7.

- Draft Benefits, Default hiring process, Salary policy in `CAREERS-SETTINGS-DRAFT.md` from live Careers copy, How We Work, Master FAQ careers entries (CAR-02 verified; CAR-01 unconfirmed stays off), roles' existing text. Do not save to production.
- Verify each open role's salary band, level, location, work model against its source; list any that look copied.
- Review the 7 draft roles: one-line verdict each in `CAREERS-DRAFTS-REVIEW.md`.
- Role page: hiring-process block (hidden until settings filled) and an "About Vitalos" strip reusing the six-practices line; application form: styled file control, inline validation, confirmation state that does not promise emails that are off.
- _Done when:_ drafts and review exist; no production Careers setting changed; role page and form pass axe at 390 and 1440.

#### WS5 — Measurement, SEO, headers, a11y, performance

Owns `apps/web` layout/metadata/CSP/sitemap/analytics, Playwright + axe + Lighthouse config, CI. Fixes C1, C3–C11, verifies A8/A9 and C2.

- **Analytics**: cookie-free, no personal data; events `enquiry_started`, `enquiry_sent`, `application_started`, `application_sent`, `relay_opened`, `relay_question`, `relay_handoff`, `cta_click` (label, page), `outbound_click`; typed `track()` helper for other workstreams; CSP updated; draft privacy-notice paragraph; behind `NEXT_PUBLIC_ANALYTICS_ENABLED`.
- **Accessibility**: accessible names on every link/button; decorative images `aria-hidden` + empty alt; one `h1`; landmarks; focus visible; 200 % zoom; reduced motion. axe in Playwright for every public route, failing CI on violations.
- **Headers**: nonce-based CSP where Next.js supports it, keep Turnstile and Supabase sources, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, HSTS `max-age=63072000; includeSubDomains` (preload as approval item), `Cross-Origin-Opener-Policy: same-origin`. Record final policy in `DECISIONS.md`.
- **Performance**: Lighthouse CI budgets (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1, performance ≥ 90 mobile) on the route set; fix what the baseline shows. Before/after per route.
- **Mobile**: Playwright pass of every public route at 390×844 with screenshots; fix overflow, tap targets < 44 px, mega menu, Relay launcher over footer, form controls.
- **Sitemap/metadata**: real `lastmod`, site-wide RSS autodiscovery + footer feed link, `manifest.webmanifest`, `theme-color`, `apple-touch-icon.png`, `llms.txt` check, schema validation in CI for every JSON-LD type, `Person` on About (behind founder flag) and author page.
- _Done when:_ CI has axe, Lighthouse budgets, schema validation; every public route passes axe; budgets met; headers verified; analytics events fire in a Playwright test with the provider stubbed.

Baseline route set: `/`, `/what-we-do`, `/solutions/ai-transformation`, `/offers/ai-opportunity-assessment`, `/industries/health-care`, `/about`, `/insights/introducing-vitalos`, `/careers/senior-technology-consultant`, `/contact`, `/trust`, `/faq`.

#### WS6 — Relay quality and cost

Owns Relay in the admin and the widget package. Fixes D1–D6, C2, E1.

- **Retrieval, not stuffing**: top-k chunks (k ≤ 8, token-capped) via existing index or a lexical fallback with typo tolerance; short conversation window; log tokens per turn. Target ≤ 8k input tokens per turn on a fixed 25-question set from the Master FAQ (including the five gap questions), asserting the expected source is cited.
- **Gaps and small talk**: greeting/goodbye handling without lookup; spelling tolerance; new knowledge entries as **Needs confirmation** for founder, solutions list, getting started, "can you modernise my system". "Suggested answer" button per gap drafting an entry from the matching page.
- **Display name**: widget shows `first_name · Vitalos`, never username or email.
- **Freshness**: schedule website and repo syncs hourly via the existing scheduler; last-sync age with warning over 24 h; provide awaiting-confirmation counts for the Overview (WS7 renders).
- **Out of hours**: next opening time from Relay settings and a "leave your email" offer stored on the conversation (no visitor email sent).
- **Feedback**: thumbs-down asks one reason; reasons shown in Relay Insights.
- **Widget DOM**: mount panel on open, unmount on close; restore only on "Continue previous conversation"; `inert` while closed if it must stay mounted.
- **Hand-off rate**: fix + unit test (4 conversations, 1 hand-off → 25 %).
- _Done when:_ 25-question test passes ≤ 8k input tokens/turn; gap questions get a sourced answer or a correct hand-off; hand-off test passes; panel never in initial HTML.

#### WS7 — Super admin bugs, identity, Overview, Architecture, Help

Owns everything in the admin except Relay and the Insights editor files WS3 touches. Fixes E2–E9, F1–F3, F5–F8.

- **Bugs**: E2 mojibake (fix + test); E3 table overflow (sticky actions or kebab menu; same on roles and applications tables); E5 enquiry SLA notifications (in-app and email via existing provider to assignee or all super admins when first-response target passes; nightly overdue digest; `--purge-smoke-test` on whatever created smoke-test notifications); E9 daily sending-domain check with result, Resend usage warning at 80 % with notification, attachment storage as a setup task with exact steps.
- **Identity**: required `display_name` (migration back-fills from email local part, capitalised, flagged for review); `link_people --dry-run` links Team member and Insights author to user by email; names everywhere (assignees, "who hears about", audit trail, Relay); Team page lists users with role, service lines, last sign-in.
- **Overview** (morning screen): Enquiries needing attention (overdue first), Relay (waiting, gaps this week, awaiting confirmation, last sync age), Careers (new applications, roles open, drafts), Insights (drafts, in review, next scheduled), Website sync, System health, Website analytics (provider API when `ANALYTICS_API_KEY` exists, else link-out). Service-line cards move to the Service lines page. Every count links to its list.
- **Architecture**: `ARCHITECTURE_MODULE_ENABLED` (default true) hides Service lines, Architecture and architecture filters when false; `sync_architecture_from_web --dry-run` creating practices, solutions, offers from website content with public URLs.
- **Help**: three workflow guides (enquiries; Insights review and publish; applications and stages) and three Relay guides (confirm FAQ entry, answer a gap, take over a conversation), from the actual screens.
- **Primary owner**: prepare steps and a management command for the approved option; execute nothing.
- **Mobile**: 390×844 pass (sidebar drawer, tables, Relay inbox); fix what breaks.
- _Done when:_ Django tests cover each fix; `link_people --dry-run` matches correctly; Overview renders with real and empty data; screenshots at 1440 and 390 in `ws7/screenshots/`.

### 5. Quality bar

- Mobile designed, not shrunk: 390 px reviewed for every changed screen. Light and dark through tokens.
- WCAG 2.2 AA: axe clean; keyboard complete; visible focus; 200 % zoom; reduced motion honoured.
- Core Web Vitals no worse than baseline.
- No new dependency without a one-line justification in `DECISIONS.md`. No paid service switched on.
- British English, brand voice (plain, confident, calm; no emoji, no exclamation marks; never "revolutionary", "cutting-edge", "unleash", "supercharge", "seamless", "AI-powered").
- Every public copy change in `COPY-CHANGES.md` with its source. Every decision in `DECISIONS.md`. Every finding in `FINDINGS.md` with a status.
