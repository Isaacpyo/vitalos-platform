# SEO audit (Phase 0)

Baseline taken on 16 Oct 2026 from `main` at `615a87d`, before any SEO work on `feat/seo`. The final crawl and the comparison are at the end of this file.

## How it was measured

- **Local production build.** `next build` and `next start` with `VITALOS_DEPLOY_ENV=production`, `VITALOS_CONTENT_SOURCE=repo`, `VITALOS_ENQUIRY_BACKEND=disabled` and `NEXT_PUBLIC_SITE_URL=https://vitalos.co.uk`. It was crawled as `Host: vitalos.co.uk` with `tooling/seo/crawl.mjs`. That script reads server HTML only, with no JavaScript, as a crawler's first pass does. Results: [`crawl/before.csv`](crawl/before.csv) and [`crawl/before.json`](crawl/before.json).
- **Live site.** `https://www.vitalos.co.uk` was crawled the same way. Results: [`crawl/live.csv`](crawl/live.csv) and [`crawl/live.json`](crawl/live.json).
- **Legacy URLs.** The Wayback Machine CDX index for `vitalos.co.uk` (the section below).
- **Lighthouse.** Lighthouse 13.5.0 (mobile, simulated throttling) on one URL per template: [`lighthouse/before.json`](lighthouse/before.json). The budgets are in `tooling/seo/budgets.json`.

## The premise was wrong: the live site is this app

The brief describes the live site as a single page served from another project. It is not. `https://www.vitalos.co.uk` is the `vitalos-platform` Vercel project, deployed from `main`. It serves the same 59 URLs as the local build, its sitemap lists 53 of them, and its robots.txt allows crawling. The site is already public and crawlable, so every URL change from now on needs a redirect. The canonical host today is **www**: the apex 308s to `https://www.vitalos.co.uk/`. The brief's target of an apex canonical with www redirecting to it means a host move. That is a Vercel domain change and is prepared in [LAUNCH.md](LAUNCH.md), not executed (DECISIONS 2).

## Summary

| Area                                                          | Before                                                                                         |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| URLs crawled (200)                                            | 59 of 59 (53 in the sitemap, plus 6 `/contact?intent=…` links)                                 |
| One h1 per page                                               | 53 of 53                                                                                       |
| Absolute, self-referencing canonical (query strings stripped) | 53 of 53                                                                                       |
| Unique titles                                                 | 52 of 53 (`Application Modernisation` is used twice)                                           |
| Title length                                                  | 7 to 58 characters; the homepage title is just "Vitalos"                                       |
| Description between 120 and 155 characters                    | 14 of 53 (39 are short; 3 pages share the site default)                                        |
| Open Graph image                                              | 0 of 53; Twitter card is `summary` everywhere                                                  |
| Structured data                                               | Organization and WebSite on the homepage; BreadcrumbList on inner pages; nothing on `/contact` |
| Images with an `alt` attribute                                | 575 of 575                                                                                     |
| Click depth from the homepage                                 | 1 for 38 pages and 2 for 14; no orphans                                                        |
| Lighthouse SEO / accessibility / best practices               | 100 / 100 / 100 on all 12 templates                                                            |
| Lighthouse performance (mobile lab)                           | 71 to 88                                                                                       |
| LCP (mobile lab)                                              | 3.8 to 5.0 s on every template (target 2.5 s)                                                  |
| CLS                                                           | 0 everywhere                                                                                   |
| TBT                                                           | 79 to 418 ms (home 418, what-we-do 378)                                                        |
| Live response time                                            | median 361 ms, p90 557 ms                                                                      |

## Findings by severity

### High

1. **The production deployment is indexable on a second host.** `https://vitalos-platform.vercel.app/` serves production publicly. Its robots.txt says `Allow: /` and it sends no `X-Robots-Tag`, so search engines can index a duplicate of the whole site. Canonical tags point to www, which limits the damage, but nothing stops the duplicate. Cause: `noindex` is decided once at build time from the deploy env (`features.indexable`), never from the request host. Branch and commit preview URLs already sit behind Vercel Authentication and send `X-Robots-Tag: noindex`. _Fix (Phase 2): only the canonical host is indexable. Every other host gets `Disallow: /` and `X-Robots-Tag: noindex`._
2. **LCP is 3.8 to 5.0 s in the mobile lab on every template.** The LCP element is the decorative hero photograph (`cloud-infrastructure-960.webp`, 74 KB, `sizes="100vw"`, `fetchpriority=high`). At 412 px wide the browser still downloads the 960 w file, and two render-blocking stylesheets cost an estimated 420 ms. Lighthouse estimates 133 KiB of image savings, 51 KiB of unused JavaScript and 14 KiB of legacy polyfills. _Fix (Phase 2): smaller and lighter derivatives of the same approved photograph, which sits under a black overlay of 72% or more; per-template budgets in CI._
3. **No page has a social preview image.** No `og:image` exists, so LinkedIn and X show a bare link. _Fix (Phase 3): generated 1200×630 images per template from one brand template._
4. **There is no canonical host decision for the brief's target.** The canonical is www today and the brief wants apex. Moving the host on a live, crawlable site needs the 308, `NEXT_PUBLIC_SITE_URL`, the sitemap and Search Console to change together. _Prepared in LAUNCH.md (owner approval: Vercel domain settings)._

### Medium

5. **The homepage title is just "Vitalos"** (7 characters): it names no topic, so it cannot rank for what Vitalos does. Its description is the 90-character site default, which `/faq` and `/labs/research` share. _Fix (Phase 2)._
6. **39 of 53 descriptions are shorter than 120 characters**, so search engines are more likely to rewrite them. _Fix (Phase 2): descriptions drafted from each page's own copy, logged in `docs/design/COPY-CHANGES.md`._
7. **Cannibalisation:** the solution and the offer both use the title "Application Modernisation". The pages compete for the same query. _Fix (Phases 1 and 2): the solution owns "application modernisation"; the offer is titled for its engagement ("Application Modernisation Programme")._
8. **Practice titles repeat the brand** ("Vitalos Consulting | Vitalos"). _Fix (Phase 2): topic first ("Technology Consulting | Vitalos"); the h1 keeps the practice name._
9. **Structured data is thin.** There is no Service on the 24 service pages (practices, solutions and offers), no WebPage, and no FAQPage where the solution pages show genuine Q&A. The nodes are separate blocks with no shared `@graph` linking WebPage, breadcrumb and Organization. `/contact` has no breadcrumb. _Fix (Phase 3)._
10. **The crawler policy is implicit.** robots.txt allows every agent through `*`, so AI search agents and training crawlers are allowed by accident rather than by policy. There is no switch for training crawlers. _Fix (Phase 2): one policy file with a flag._
11. **One flat sitemap.** It has no split by type, and index pages carry no `lastmod`. Detail pages use the content's drafted date (2026-10-10), which is a real content date, not the build time. _Fix (Phase 2): a sitemap index split into pages, insights and careers; `lastmod` only from content dates._
12. **`/insights` was public on the earlier site** (Wayback, May 2026). It now returns 404 while the Insights gate is closed. That is acceptable while the section is closed, because a 404 is not a soft 404, and the URL comes back when the section opens (PR #46). _No change; recorded here._

### Low

13. No `llms.txt`, no IndexNow, no search engine verification tags, and no analytics provider. The event taxonomy exists in `features/analytics`, but no provider is wired to it. _Phases 2 and 4._
14. Legacy query links such as `/contact?type=healthcare` (Wayback) land on `/contact`. The canonical strips the query, so they cause no harm. _No change._
15. The production Vercel environment still holds `NEXT_PUBLIC_SANITY_*` and `SANITY_*` variables, although Sanity was removed (ADR-028). This is hygiene, not SEO. _Listed for the owner; not changed here._
16. Local first-render times reach 2.8 s for some pages (concurrency of 6, cold server). The live CDN numbers above are the ones that count.

### Already good (keep)

- Every page has exactly one h1, and detail-page h1s name the service plainly.
- Canonicals are absolute and self-referencing, and `?intent=` and other query strings are canonicalised to the clean path.
- All indexable words are in the server HTML. The crawl reads no JavaScript and found every page's copy.
- Redirects answer 301 in one hop (`/services`, `/technologies`, `/privacy`, `/terms`, `/about/leadership`), and retired paths can answer 410.
- 404s are real and `noindex`; unknown detail slugs return a server-rendered 404 (ADR-027).
- `lang="en-GB"`, every image has `alt`, CLS is 0, and Lighthouse accessibility is 100.
- Preview and branch deployments are protected by Vercel Authentication and send `noindex`.

## Legacy URL inventory (for migration)

From the live crawl and the Wayback Machine CDX index (captures from March to July 2026, from an earlier client-rendered site titled "Vitalos – AI-Powered Solutions for Health, Wellness & Innovation"):

| Legacy URL                                        | Today                     | Decision                                                 |
| ------------------------------------------------- | ------------------------- | -------------------------------------------------------- |
| `/`                                               | 200                       | keep                                                     |
| `/about`, `/contact`, `/industries`, `/solutions` | 200                       | keep                                                     |
| `/services`                                       | 301 → `/what-we-do`       | keep, move to 308 with the redirect table (REDIRECTS.md) |
| `/technologies`                                   | 301 → `/labs`             | keep (308)                                               |
| `/privacy`, `/terms`                              | 301 → `/legal/…`          | keep (308)                                               |
| `/insights`                                       | 404 (gate closed)         | returns when Insights opens (PR #46)                     |
| `/contact?type=care` and four other `type` values | 200, canonical `/contact` | keep                                                     |
| `/#what-we-do`, `/#about` (named in the brief)    | homepage, no such section | client map to `/what-we-do` and `/about` (Phase 2)       |

The earlier site was a client-rendered single-page app, so its in-page anchors are not recoverable from the archive. The client map covers the anchors the brief names plus the obvious section names (REDIRECTS.md).

## Final crawl (after)

Taken on 16 Oct 2026 from `feat/seo` rebased on `main` at `ac46daa`, built and crawled the same way (`pnpm seo:check --lighthouse --record docs/seo/crawl/after`). Results: [`crawl/after.csv`](crawl/after.csv), [`crawl/after.json`](crawl/after.json) and [`lighthouse/after.json`](lighthouse/after.json). `seo:check` passes with no problems.

| Area                                                       | Before                                                     | After                                                                                                                                                                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URLs crawled (200)                                         | 59 of 59                                                   | 60 of 60 (adds `/sitemap.xml`, now linked from the footer, #40)                                                                                                                                                      |
| Indexable pages in the sitemap                             | 53 (one flat file)                                         | 53 (an index with `/sitemaps/pages.xml`; Insights and Careers children appear when those sections open)                                                                                                              |
| One h1 per page                                            | 53 of 53                                                   | 53 of 53                                                                                                                                                                                                             |
| Self-referencing canonical                                 | 53 of 53                                                   | 53 of 53                                                                                                                                                                                                             |
| Unique titles                                              | 52 of 53                                                   | 53 of 53                                                                                                                                                                                                             |
| Title length                                               | 7 to 58 characters                                         | 17 to 58 characters, topic first, brand last                                                                                                                                                                         |
| Description between 120 and 155 characters                 | 14 of 53                                                   | 53 of 53, all unique                                                                                                                                                                                                 |
| Open Graph image                                           | 0 of 53                                                    | 53 of 53 (generated 1200×630, `summary_large_image`)                                                                                                                                                                 |
| Structured data                                            | Organization and WebSite on home; BreadcrumbList elsewhere | One `@graph` per page: WebPage (CollectionPage, AboutPage, ContactPage, FAQPage), BreadcrumbList, Service (24 pages), Organization (logo, company number, `areaServed`, `knowsAbout`), WebSite; every page validated |
| Visible breadcrumbs                                        | none                                                       | none (owner decision, 16 Oct 2026); BreadcrumbList JSON-LD below the homepage                                                                                                                                        |
| Click depth                                                | ≤ 2                                                        | ≤ 2 (no change)                                                                                                                                                                                                      |
| Foreign host (`*.vercel.app`)                              | indexable                                                  | `noindex` and `Disallow: /`                                                                                                                                                                                          |
| robots.txt                                                 | `*` only                                                   | named search, AI search and AI training groups from one policy                                                                                                                                                       |
| `/llms.txt`, IndexNow key                                  | none                                                       | both, production canonical host                                                                                                                                                                                      |
| Lighthouse SEO / accessibility / best practices            | 100 / 100 / 100                                            | 100 / 100 / 100                                                                                                                                                                                                      |
| Lighthouse performance (mobile lab)                        | 71 to 88                                                   | 86 to 94                                                                                                                                                                                                             |
| LCP, simulated (mobile lab)                                | 3.8 to 5.0 s                                               | 3.0 to 4.0 s                                                                                                                                                                                                         |
| LCP, applied slow-4G throttling (home, practice, solution) | about 2.96 s (practice)                                    | about 2.1 s                                                                                                                                                                                                          |
| TBT                                                        | 79 to 418 ms                                               | 47 to 140 ms                                                                                                                                                                                                         |
| CLS                                                        | 0                                                          | 0                                                                                                                                                                                                                    |

Every URL in the live crawl (`crawl/live.csv`) answers 200 in the after crawl, so nothing that is live today breaks.

### Still open

- **Simulated LCP is above 2.5 s.** The lab simulation counts every early request on a local server; applied throttling puts LCP at about 2.1 s. The field number (Speed Insights, once analytics is switched on) is the one to judge. The remaining weight is the Motion runtime (about 35 KB gzip, ADR-024, owner-approved) and Geist Sans.
- **The footer's podcast links are placeholders that do not resolve yet** (`open.spotify.com/show/vitalos` and `podcasts.apple.com/gb/podcast/vitalos`, #40, owner instruction). Every page links to them. Replace them when the shows exist, or hide the block until then.
- **The header logo is lazy-loaded** although it is above the fold (Chrome reports a LazyLoadImageIssue). It is not the LCP element, so it was left alone.
- **The production Vercel environment keeps the unused `SANITY_*` variables** (finding 15).
