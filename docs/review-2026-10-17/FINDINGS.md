# Findings — 17 October 2026 review

Source: the live review of vitalos.co.uk and admin.vitalos.co.uk on 17 Oct 2026 (full text in the run prompt). Status: `open` → `fixed (commit)` | `prepared (approval)` | `follow-up (reason; fallback)`.

## 1A. Website — brand and visual

| #   | Sev | Finding                                                                           | Owner | Status                                                                                                        |
| --- | --- | --------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| A1  | P0  | Single AI-generated refinery/cityscape photo is the hero background on every page | WS1   | fixed — WS1 (brand-system `HeroArtwork`, all hero photos removed)                                             |
| A2  | P0  | Glowing brain-on-a-chip 3D icon for AI Transformation (carousel + solution hero)  | WS1   | fixed — WS1 (`LineDiagram`; AI journey staircase)                                                             |
| A3  | P1  | Glossy 3D icons (lifecycle ring, Solutions carousel) clash with flat line icons   | WS1   | fixed — WS1 (line icons in lifecycle ring and solutions; 6 new icons)                                         |
| A4  | P1  | Stock photography of people (Industries cards, health-care hero)                  | WS1   | fixed — WS1 (industry artwork variants; people photos deleted)                                                |
| A5  | P1  | Empty MediaSlot placeholders visible in production (/about, /careers heroes)      | WS1   | fixed — WS1 (`MediaSlot` renders nothing in production unless `reserve`)                                      |
| A6  | P1  | Every hero is the same dark block; page families indistinguishable                | WS1   | fixed — WS1 (11 page families; light compact hero for detail pages)                                           |
| A7  | P2  | Offer heroes show a lone icon in a card with a 'Typical duration' chip            | WS1   | fixed — WS1 (engagement-summary panel from offer fields)                                                      |
| A8  | P2  | Turnstile renders dark inside the light contact form                              | WS1   | fixed — WS1 (Turnstile follows the tone scope)                                                                |
| A9  | P2  | 'Problems we solve' title clipped mid-reveal; reduced-motion not verified         | WS1   | fixed — WS1; verified by WS5 `reveal-clipping` spec (one load-dependent flake on `/` mobile, passes on rerun) |

## 1B. Website — content and IA

| #   | Sev | Finding                                                                             | Owner | Status                                                                                                                                                 |
| --- | --- | ----------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | P0  | 'Five practices' / 'five areas' contradicts six practices and six solutions         | WS2   | fixed — WS2 (six practices incl. Labs everywhere; locked heading changed)                                                                              |
| B2  | P1  | Header nav differs from locked IA; Industries/Insights unreachable; 'Support' label | WS2   | fixed — WS2 (`NEXT_PUBLIC_NAV_VARIANT`; IA on preview, current in production) — production switch is an approval                                       |
| B3  | P1  | /work 404s and nothing shows proof of work; need a true 'How we prove it' approach  | WS2   | fixed — WS2 ("How we prove it" on home and About; no /work links)                                                                                      |
| B4  | P1  | /about is 249 words: no founder, story, location or company facts; empty hero image | WS2   | fixed — WS2; Founder section prepared behind `ABOUT_FOUNDER_ENABLED` (approval)                                                                        |
| B5  | P1  | /podcast promoted in footer with no episodes                                        | WS2   | fixed — WS2 (`PODCAST_ENABLED` off: footer block gone, /podcast 404)                                                                                   |
| B6  | P1  | Insights batch 2 (20 articles) not imported; admin shows 0 drafts                   | WS3   | prepared — WS3 (`import_insights_batch` defaults to draft, `--author`; 20 drafts verified on a test DB; production run needs the deploy + author slug) |
| B7  | P1  | Careers settings sections empty; 7 draft roles unreviewed; identical salary bands   | WS4   | fixed (role page, form) + prepared (settings drafts) — WS4; 7 draft-role verdicts are a follow-up (needs admin data)                                   |
| B8  | P1  | Trust Centre thin; no /.well-known/security.txt; no procurement-pack route          | WS2   | fixed — WS2 (ask-for block, security.txt, procurement intent)                                                                                          |
| B9  | P1  | Offer pages thin: vague duration, no next steps, no sample deliverable              | WS2   | fixed — WS2 (next steps); durations and bands: no source (OFFERS-INVESTMENT-DRAFT.md)                                                                  |
| B10 | P2  | /faq: no FAQPage JSON-LD, filter, anchors or 'still have a question' route          | WS2   | fixed — WS2 (anchors, filter, Contact/Ask Relay; one FAQPage)                                                                                          |
| B11 | P2  | Contact: email only, no address, no steps, no intent pre-selection                  | WS2   | fixed — WS2 (steps; no address, no response-time promise — confirmation)                                                                               |
| B12 | P2  | 404 title is 'Vitalos'; no suggested routes                                         | WS2   | fixed — WS2 (title, main routes, Ask Relay)                                                                                                            |
| B13 | P2  | CTA labels vary; check each lands on a matching page/form state                     | WS2   | fixed — WS2 (CTA topic bug fixed; CTA-AUDIT.md)                                                                                                        |
| B14 | P2  | Articles: no share links, related posts, author photo slot, 'Updated' handling      | WS3   | fixed — WS3 (author link, intent CTA; share/related/updated/reading time already existed from #56)                                                     |

## 1C. Website — technical, SEO, accessibility, performance

| #   | Sev | Finding                                                                                          | Owner              | Status                                                                                                                                    |
| --- | --- | ------------------------------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | P0  | No analytics of any kind                                                                         | WS5                | fixed — WS5 (Vercel Web Analytics was already on; events + typed `track()` added; custom events need Vercel Pro — approval)               |
| C2  | P0  | Relay panel in DOM on every page as first <article>; silently restores transcript                | WS6 (WS5 verifies) | fixed — WS6 (panel mounted only while open; Continue/Start new; no `<article>`)                                                           |
| C3  | P1  | Unnamed links; empty alt on many images; no axe run recorded                                     | WS5                | fixed — WS5 (logo name, decorative images); baseline showed 0 axe A/AA violations                                                         |
| C4  | P1  | CSP script-src 'unsafe-inline'; no X-Frame-Options/frame-ancestors; HSTS lacks includeSubDomains | WS5                | fixed — WS5 (`script-src-attr 'none'`, XFO DENY, COOP, HSTS includeSubDomains behind `ENABLE_HSTS`); nonce CSP rejected (ADR-047)         |
| C5  | P1  | Core Web Vitals / Lighthouse not measured                                                        | WS5                | follow-up — budgets unchanged to keep the required `seo` job stable; WS1's SVG hero removes the home LCP image; re-measure on the preview |
| C6  | P1  | Mobile (390 px) not verified                                                                     | WS5                | fixed — WS5 (`accessibility/mobile` spec: no overflow, no target under 24 px; 24–44 px list in ws5/NOTES)                                 |
| C7  | P2  | Sitemap top-level pages lack lastmod                                                             | WS5                | fixed — WS5 (git-date lastmod, shallow-clone safe)                                                                                        |
| C8  | P2  | No web manifest, theme-color or apple-touch-icon alias                                           | WS5                | fixed — WS5 (manifest, theme-color, apple-touch-icon)                                                                                     |
| C9  | P2  | RSS autodiscovery only on /insights; no footer feed link                                         | WS5                | fixed — WS5 (site-wide RSS autodiscovery, footer feed link)                                                                               |
| C10 | P2  | llms.txt completeness; llms-full.txt if generator exists                                         | WS5                | fixed — WS5 (six practices, section indexes)                                                                                              |
| C11 | P2  | Schema validation in CI; FAQPage on /faq; Person on About/author; CollectionPage on indexes      | WS5 (+WS2)         | fixed — WS5 (ItemList, FAQPage on /faq, Person on author pages; founder Person helper for WS2)                                            |

## 1D. Relay

| #   | Sev | Finding                                                               | Owner              | Status                                                                                                                                             |
| --- | --- | --------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | P0  | ~127k input tokens per conversation: whole KB stuffed into every call | WS6                | fixed — WS6 (usage tagged by source; per-turn tokens in Insights; budget leaks closed). Root cause: test traffic in `usage_daily`, not KB stuffing |
| D2  | P1  | Gaps: greetings, typos, founder, solutions list, getting started      | WS6                | fixed — WS6 (small talk, typo tolerance, 4 draft knowledge entries needing confirmation, Suggested answer)                                         |
| D3  | P1  | Visitor sees username 'TEMITOPE.AGBOLA · VITALOS' for staff           | WS6 (+WS7)         | fixed — WS6 + integration (first name only; never email-derived)                                                                                   |
| D4  | P1  | Knowledge sync not scheduled; FAQ confirmations piling up             | WS6 (+WS7 renders) | fixed — WS6 (hourly `relay-ingest` pg_cron; 24 h warning; `/overview` counts) — needs migration                                                    |
| D5  | P2  | 'TEAM OFFLINE' with no next opening time or leave-email offer         | WS6                | fixed — WS6 (next opening time, leave-email via hand-off form)                                                                                     |
| D6  | P2  | Thumbs-down reason not captured                                       | WS6                | fixed — WS6 (one-tap reason, shown in Insights) — needs migration                                                                                  |

## 1E. Super admin — bugs

| #   | Sev | Finding                                                                                | Owner | Status                                                                                            |
| --- | --- | -------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------- |
| E1  | P0  | Relay Insights hand-off rate shows 2500%                                               | WS6   | fixed — WS6 (`handoffRate` is a fraction; 4/1 → 25 % tested both sides)                           |
| E2  | P1  | API docs mojibake 'Settings â†’ API tokens'                                            | WS7   | fixed — WS7 (bytes fixed; UTF-8/mojibake test)                                                    |
| E3  | P1  | Insights posts table overflows at 1440 px; Archive action cut off                      | WS7   | fixed — WS7 (sticky primary action + More menu on posts, roles, applications)                     |
| E4  | P1  | Overview / Service lines / Architecture hollow; disagree with website                  | WS7   | prepared — WS7 (`sync_architecture_from_web` dry-run; module flag)                                |
| E5  | P1  | Overdue enquiry not notified; stale smoke-test notifications                           | WS7   | fixed — WS7 (overdue notifications + digest; `notifications_cleanup --purge-smoke-test` prepared) |
| E6  | P1  | Team page empty; user, team member and author not linked                               | WS7   | fixed — WS7 (Team page lists users; `link_people` prepared)                                       |
| E7  | P2  | Assignee controls show emails, not names                                               | WS7   | fixed — WS7 (names everywhere via `person` filter)                                                |
| E8  | P2  | Full name empty and not required                                                       | WS7   | fixed — WS7 (full name required; back-fill flagged for review)                                    |
| E9  | P2  | Sending domain never checked; attachment storage unconfigured; no Resend usage warning | WS7   | fixed — WS7 (daily domain check, 80 % email warning, storage set-up task)                         |

## 1F. Super admin — product gaps

| #   | Sev | Finding                                                                                     | Owner      | Status                                                                                                                              |
| --- | --- | ------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| F1  | P1  | Overview should be the morning screen                                                       | WS7        | fixed — WS7 (morning Overview)                                                                                                      |
| F2  | P1  | Website analytics have no home in the admin                                                 | WS7 (+WS5) | fixed — WS7 (link-out card + adapter; Vercel has no analytics read API)                                                             |
| F3  | P1  | Identity: display name required; link user/team member/author; names everywhere             | WS7        | fixed — WS7                                                                                                                         |
| F4  | P1  | Insights editor: Author 1–4 dropdowns, unstyled file input, no media library, no word count | WS3        | fixed — WS3 (ordered author list, drop zone, word count, layout); media library follow-up (CSP img-src now allows the media origin) |
| F5  | P2  | Help & docs lacks workflow guides                                                           | WS7        | fixed — WS7 (six guides on /help/)                                                                                                  |
| F6  | P2  | Architecture: dry-run import from web content + module flag                                 | WS7        | prepared — WS7 (`ARCHITECTURE_MODULE_ENABLED`, sync command)                                                                        |
| F7  | P2  | Shared admin@ superuser as primary owner: prepare change for approval                       | WS7        | prepared — WS7 (`transfer_primary_owner`, PRIMARY-OWNER.md; option B recommended)                                                   |
| F8  | P2  | Admin mobile (390 px) pass                                                                  | WS7        | fixed — WS7 (390 px pass, drawer, tables)                                                                                           |

## Baseline Core Web Vitals

Live site, 17 Oct 2026, Lighthouse 12.8.2 on an overloaded laptop (mobile TBT and performance are pessimistic; CLS and accessibility are reliable). Full detail: [baseline/BASELINE.md](baseline/BASELINE.md). The screenshots (186 JPEGs, 55 MB) are kept outside the repo at `D:/Development/vitalos-baseline/docs/review-2026-10-17/baseline/screens/`, because the repo is public and they would bloat its history.

| Route                                 | Mobile perf | Mobile LCP | CLS | Desktop perf | Desktop LCP | axe A/AA |
| ------------------------------------- | ----------- | ---------- | --- | ------------ | ----------- | -------- |
| /                                     | 52–58       | 4.54 s     | 0   | 98           | 1.09 s      | 0        |
| /what-we-do                           | 86          | 3.17 s     | 0   | 94           | 1.03 s      | 0        |
| /solutions/ai-transformation          | 86          | 3.54 s     | 0   | 98           | 0.97 s      | 0        |
| /offers/ai-opportunity-assessment     | 71          | 3.38 s     | 0   | 68           | 1.06 s      | 0        |
| /industries/health-care               | 79          | 3.63 s     | 0   | 94           | 0.96 s      | 0        |
| /about                                | 50          | 4.32 s     | 0   | 95           | 0.92 s      | 0        |
| /insights/introducing-vitalos         | 88 (rerun)  | 2.81 s     | 0   | 85           | 1.00 s      | 0        |
| /careers/senior-technology-consultant | 67          | 3.66 s     | 0   | 97           | 0.95 s      | 0        |
| /contact                              | 80          | 3.01 s     | 0   | 62           | 1.37 s      | 0        |
| /trust                                | 65          | 3.31 s     | 0   | 88           | 0.90 s      | 0        |
| /faq                                  | 62 (rerun)  | 2.78 s     | 0   | 98           | 0.90 s      | 0        |

Baseline notes that change the findings:

- **C3:** axe finds no WCAG A/AA violations on any route. There are no unnamed links or buttons. Images with empty `alt` that are not hidden: 19 on `/`, 15 on `/what-we-do`. The review's counts of 43 and 32 included hidden ones.
- **Relay launcher:** fails WCAG 2.5.3, Label in Name. The visible text is "Ask Vitalos"; the accessible name is "Open chat with Relay…". Sent to WS6.
- **C2:** before any interaction, production has no `#relay-panel` and no Relay `<article>`, yet the launcher's `aria-controls` points at the missing panel.
- **C5:** the home page is the slowest on mobile. Its HTML is 388 KB with 3–8 s of main-thread work, and LCP is the hero image (71 % of it is render delay).
- **Headers:** `Access-Control-Allow-Origin: *` is set on HTML responses. There is no X-Frame-Options and no COOP. HSTS has no `includeSubDomains`.
