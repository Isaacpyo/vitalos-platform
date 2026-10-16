# URL rules

Routes are built only through `packages/cms/src/routes.ts` (the single source of public URLs). A new route or slug must follow these rules; `pnpm seo:check` and the route tests enforce them.

## Rules

1. **Lowercase, hyphenated, ASCII.** Slugs match `^[a-z0-9]+(-[a-z0-9]+)*$`; ampersands are dropped ("AI & Data" → `ai-data`). A request with capital letters gets a 308 to the lowercase path (proxy, Phase 2), so a mistyped backlink never splits signals.
2. **No trailing slash.** `/about/` gets a 308 to `/about` (the Next.js default, `trailingSlash: false`). Canonicals, the sitemap and internal links never end in `/` except the homepage.
3. **No dates, ids or file extensions in page URLs.** Exceptions are the machine files (`/sitemap.xml`, `/robots.txt`, `/llms.txt`, the IndexNow key file, `/insights/feed.xml`).
4. **At most three levels** (`/labs/{type}/{slug}`). Insights and Careers pagination and filters are fixed by their contract (PR #46) and are `noindex, follow` where they go deeper.
5. **Query strings are never indexed.** Every page's canonical is its clean path, with the query stripped (`buildMetadata`). Query-driven views are either the same page (`/contact?intent=ai` → canonical `/contact`) or `noindex, follow` (Insights filters). The sitemap never lists a URL with a query.
6. **One URL per page.** www and http are redirected to the canonical host (LAUNCH.md), and non-canonical hosts are `noindex` (DECISIONS 9).
7. **Changing a published slug** needs a 308 from the old path in the same pull request (`apps/web/src/features/redirects/additional-redirects.ts`, REDIRECTS.md). The map rejects chains, loops and blanket redirects at build time.
8. **Intentionally removed content answers 410**, not a redirect to an unrelated page and not a soft 404.

## Route inventory (checked 16 Oct 2026)

| Pattern                                                                                                                                                  | Levels | Indexable                                          | Result                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `/`                                                                                                                                                      | 0      | yes                                                | ok                                                                            |
| `/what-we-do`, `/solutions`, `/offers`, `/industries`, `/labs`, `/about`, `/how-we-work`, `/trust`, `/faq`, `/contact`, `/work`, `/insights`, `/careers` | 1      | yes (gated sections only while their gate is open) | ok                                                                            |
| `/what-we-do/{practice}`                                                                                                                                 | 2      | yes                                                | ok (`consulting`, `engineering`, `ai-data`, `experience`, `managed-services`) |
| `/solutions/{slug}`, `/offers/{slug}`, `/industries/{slug}`                                                                                              | 2      | yes                                                | ok                                                                            |
| `/labs/{type}`, `/trust/{topic}`, `/legal/{slug}`                                                                                                        | 2      | yes                                                | ok                                                                            |
| `/labs/{type}/{slug}`                                                                                                                                    | 3      | yes                                                | ok                                                                            |
| `/work/{slug}`, `/people/{slug}`                                                                                                                         | 2      | while their gate is open                           | ok                                                                            |
| `/insights/{slug}`, `/careers/{slug}`                                                                                                                    | 2      | while open (PR #46)                                | fixed by contract                                                             |
| `/contact/thank-you`                                                                                                                                     | 2      | **no** (receipt)                                   | ok: `noindex`, not in the sitemap                                             |
| `/api/*`                                                                                                                                                 | —      | no                                                 | disallowed in robots.txt                                                      |

No route breaks the rules, so no route is renamed and no new redirect is needed for URL hygiene. The only existing redirects are the legacy ones (REDIRECTS.md).

## Checks

- `routes.test.ts` (cms) builds every route from the slug lists.
- `pnpm seo:check` fails on a sitemap URL that is not 200, indexable and self-canonical; on a canonical with a query string; on a redirect chain; and on an internal link that redirects.
- `apps/web/src/features/redirects/redirects.test.ts` validates the redirect map.
