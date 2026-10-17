# Findings — 17 October 2026 review

Source: the live review of vitalos.co.uk and admin.vitalos.co.uk on 17 Oct 2026 (full text in the run prompt). Status: `open` → `fixed (commit)` | `prepared (approval)` | `follow-up (reason; fallback)`.

## 1A. Website — brand and visual

| #   | Sev | Finding                                                                           | Owner | Status |
| --- | --- | --------------------------------------------------------------------------------- | ----- | ------ |
| A1  | P0  | Single AI-generated refinery/cityscape photo is the hero background on every page | WS1   | open   |
| A2  | P0  | Glowing brain-on-a-chip 3D icon for AI Transformation (carousel + solution hero)  | WS1   | open   |
| A3  | P1  | Glossy 3D icons (lifecycle ring, Solutions carousel) clash with flat line icons   | WS1   | open   |
| A4  | P1  | Stock photography of people (Industries cards, health-care hero)                  | WS1   | open   |
| A5  | P1  | Empty MediaSlot placeholders visible in production (/about, /careers heroes)      | WS1   | open   |
| A6  | P1  | Every hero is the same dark block; page families indistinguishable                | WS1   | open   |
| A7  | P2  | Offer heroes show a lone icon in a card with a 'Typical duration' chip            | WS1   | open   |
| A8  | P2  | Turnstile renders dark inside the light contact form                              | WS1   | open   |
| A9  | P2  | 'Problems we solve' title clipped mid-reveal; reduced-motion not verified         | WS1   | open   |

## 1B. Website — content and IA

| #   | Sev | Finding                                                                             | Owner | Status |
| --- | --- | ----------------------------------------------------------------------------------- | ----- | ------ |
| B1  | P0  | 'Five practices' / 'five areas' contradicts six practices and six solutions         | WS2   | open   |
| B2  | P1  | Header nav differs from locked IA; Industries/Insights unreachable; 'Support' label | WS2   | open   |
| B3  | P1  | /work 404s and nothing shows proof of work; need a true 'How we prove it' approach  | WS2   | open   |
| B4  | P1  | /about is 249 words: no founder, story, location or company facts; empty hero image | WS2   | open   |
| B5  | P1  | /podcast promoted in footer with no episodes                                        | WS2   | open   |
| B6  | P1  | Insights batch 2 (20 articles) not imported; admin shows 0 drafts                   | WS3   | open   |
| B7  | P1  | Careers settings sections empty; 7 draft roles unreviewed; identical salary bands   | WS4   | open   |
| B8  | P1  | Trust Centre thin; no /.well-known/security.txt; no procurement-pack route          | WS2   | open   |
| B9  | P1  | Offer pages thin: vague duration, no next steps, no sample deliverable              | WS2   | open   |
| B10 | P2  | /faq: no FAQPage JSON-LD, filter, anchors or 'still have a question' route          | WS2   | open   |
| B11 | P2  | Contact: email only, no address, no steps, no intent pre-selection                  | WS2   | open   |
| B12 | P2  | 404 title is 'Vitalos'; no suggested routes                                         | WS2   | open   |
| B13 | P2  | CTA labels vary; check each lands on a matching page/form state                     | WS2   | open   |
| B14 | P2  | Articles: no share links, related posts, author photo slot, 'Updated' handling      | WS3   | open   |

## 1C. Website — technical, SEO, accessibility, performance

| #   | Sev | Finding                                                                                          | Owner              | Status |
| --- | --- | ------------------------------------------------------------------------------------------------ | ------------------ | ------ |
| C1  | P0  | No analytics of any kind                                                                         | WS5                | open   |
| C2  | P0  | Relay panel in DOM on every page as first <article>; silently restores transcript                | WS6 (WS5 verifies) | open   |
| C3  | P1  | Unnamed links; empty alt on many images; no axe run recorded                                     | WS5                | open   |
| C4  | P1  | CSP script-src 'unsafe-inline'; no X-Frame-Options/frame-ancestors; HSTS lacks includeSubDomains | WS5                | open   |
| C5  | P1  | Core Web Vitals / Lighthouse not measured                                                        | WS5                | open   |
| C6  | P1  | Mobile (390 px) not verified                                                                     | WS5                | open   |
| C7  | P2  | Sitemap top-level pages lack lastmod                                                             | WS5                | open   |
| C8  | P2  | No web manifest, theme-color or apple-touch-icon alias                                           | WS5                | open   |
| C9  | P2  | RSS autodiscovery only on /insights; no footer feed link                                         | WS5                | open   |
| C10 | P2  | llms.txt completeness; llms-full.txt if generator exists                                         | WS5                | open   |
| C11 | P2  | Schema validation in CI; FAQPage on /faq; Person on About/author; CollectionPage on indexes      | WS5 (+WS2)         | open   |

## 1D. Relay

| #   | Sev | Finding                                                               | Owner              | Status |
| --- | --- | --------------------------------------------------------------------- | ------------------ | ------ |
| D1  | P0  | ~127k input tokens per conversation: whole KB stuffed into every call | WS6                | open   |
| D2  | P1  | Gaps: greetings, typos, founder, solutions list, getting started      | WS6                | open   |
| D3  | P1  | Visitor sees username 'TEMITOPE.AGBOLA · VITALOS' for staff           | WS6 (+WS7)         | open   |
| D4  | P1  | Knowledge sync not scheduled; FAQ confirmations piling up             | WS6 (+WS7 renders) | open   |
| D5  | P2  | 'TEAM OFFLINE' with no next opening time or leave-email offer         | WS6                | open   |
| D6  | P2  | Thumbs-down reason not captured                                       | WS6                | open   |

## 1E. Super admin — bugs

| #   | Sev | Finding                                                                                | Owner | Status |
| --- | --- | -------------------------------------------------------------------------------------- | ----- | ------ |
| E1  | P0  | Relay Insights hand-off rate shows 2500%                                               | WS6   | open   |
| E2  | P1  | API docs mojibake 'Settings â†’ API tokens'                                            | WS7   | open   |
| E3  | P1  | Insights posts table overflows at 1440 px; Archive action cut off                      | WS7   | open   |
| E4  | P1  | Overview / Service lines / Architecture hollow; disagree with website                  | WS7   | open   |
| E5  | P1  | Overdue enquiry not notified; stale smoke-test notifications                           | WS7   | open   |
| E6  | P1  | Team page empty; user, team member and author not linked                               | WS7   | open   |
| E7  | P2  | Assignee controls show emails, not names                                               | WS7   | open   |
| E8  | P2  | Full name empty and not required                                                       | WS7   | open   |
| E9  | P2  | Sending domain never checked; attachment storage unconfigured; no Resend usage warning | WS7   | open   |

## 1F. Super admin — product gaps

| #   | Sev | Finding                                                                                     | Owner      | Status |
| --- | --- | ------------------------------------------------------------------------------------------- | ---------- | ------ |
| F1  | P1  | Overview should be the morning screen                                                       | WS7        | open   |
| F2  | P1  | Website analytics have no home in the admin                                                 | WS7 (+WS5) | open   |
| F3  | P1  | Identity: display name required; link user/team member/author; names everywhere             | WS7        | open   |
| F4  | P1  | Insights editor: Author 1–4 dropdowns, unstyled file input, no media library, no word count | WS3        | open   |
| F5  | P2  | Help & docs lacks workflow guides                                                           | WS7        | open   |
| F6  | P2  | Architecture: dry-run import from web content + module flag                                 | WS7        | open   |
| F7  | P2  | Shared admin@ superuser as primary owner: prepare change for approval                       | WS7        | open   |
| F8  | P2  | Admin mobile (390 px) pass                                                                  | WS7        | open   |

## Baseline Core Web Vitals

_Filled in by Phase 0 baseline / WS5._
