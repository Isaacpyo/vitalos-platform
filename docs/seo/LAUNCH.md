# SEO launch plan

**Executed on 16 Oct 2026** (DECISIONS 30); §5 monitoring runs until mid-November. Originally prepared, not executed: Every step that changes the live site, DNS, Vercel domains, Search Console or Bing needs the owner (AGENTS.md stop list). The steps are in order; do not skip the checks between them.

Context (AUDIT.md): `www.vitalos.co.uk` already serves this app and is crawlable, and the apex 308s to www. "Launch" here means three things: merging this branch, moving the canonical host from www to the apex (the brief's target), and telling the search engines.

## 1. Before merging (gate)

`pnpm seo:check` runs in CI on every non-draft pull request and fails on:

| Rule         | Fails when                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Titles       | missing, duplicate, or longer than 60 characters                                                                                                           |
| Descriptions | missing, duplicate, or outside 120 to 155 characters                                                                                                       |
| Canonical    | missing, more than one, or not the page's own URL                                                                                                          |
| Headings     | not exactly one h1                                                                                                                                         |
| Indexing     | a sitemap page says `noindex` (meta or header)                                                                                                             |
| Links        | an internal link answers 4xx or 5xx, a redirect chain (two or more hops), or an internal link that redirects; generic anchor text ("Learn more" and so on) |
| Structure    | an orphan (no internal link to it); a page more than 3 clicks from the homepage                                                                            |
| Rendering    | fewer than 40 words of main content in the server HTML                                                                                                     |
| Images       | an `<img>` with no `alt` attribute                                                                                                                         |
| JSON-LD      | invalid JSON, or any rule in `json-ld-rules.ts`                                                                                                            |
| Social       | no `og:image`, Twitter card not `summary_large_image`, or `og:url` not canonical                                                                           |
| Sitemap      | a listed URL that is not 200, indexable and canonical; a URL off the canonical origin                                                                      |
| Preview      | a foreign host (`vitalos-platform.vercel.app`) that is not `noindex` or whose robots.txt does not `Disallow: /`                                            |
| robots.txt   | production blocks a key path or lists no sitemap                                                                                                           |
| `/llms.txt`  | does not answer 200                                                                                                                                        |
| Lighthouse   | below a template's budget (`tooling/seo/budgets.json`)                                                                                                     |

Before merging, also:

- [ ] Compare the crawls: every URL in `crawl/live.csv` still answers 200, or 308 to its new URL, in `crawl/after.csv` (see the end of AUDIT.md).
- [x] Owner decisions made on 16 Oct 2026: no visible breadcrumbs, AI training crawlers allowed, free Vercel analytics on.

## 2. Move the canonical host from www to the apex (owner: Vercel domains)

The site is indexable only on the host in `NEXT_PUBLIC_SITE_URL` (DECISIONS 9). Change the env var and the domain together, so neither host serves pages that are `noindex` while still being linked. Using a staged deployment keeps that window to seconds:

1. **Check the starting point.** `curl -sI https://vitalos.co.uk/` → `308 https://www.vitalos.co.uk/`. Note the current production deployment URL (for rollback): `npx vercel ls vitalos-platform --prod`.
2. **Set the env var.** Vercel → vitalos-platform → Settings → Environment Variables → Production: `NEXT_PUBLIC_SITE_URL=https://vitalos.co.uk`. Set the GitHub repository variable `SITE_URL=https://vitalos.co.uk` too (IndexNow workflow): `gh variable set SITE_URL --body https://vitalos.co.uk`.
3. **Build without going live.** `npx vercel deploy --prod --skip-domain` from `main` (or use Redeploy in the dashboard with "Assign domains" unticked). Wait for it to finish, and keep its URL.
4. **Flip the domains** (Vercel → Settings → Domains): make `vitalos.co.uk` the production domain (no redirect), and set `www.vitalos.co.uk` to **Redirect to `vitalos.co.uk`, 308 Permanent Redirect**.
5. **Promote immediately.** `npx vercel promote <staged deployment URL>`.
6. **Verify** (each must hold):
   - `curl -sI https://www.vitalos.co.uk/what-we-do` → `308`, `location: https://vitalos.co.uk/what-we-do` (path kept).
   - `curl -sI http://vitalos.co.uk/` → `308` to `https://vitalos.co.uk/`.
   - `curl -s https://vitalos.co.uk/robots.txt` → the full crawler policy and `Sitemap: https://vitalos.co.uk/sitemap.xml`.
   - `curl -sI https://vitalos.co.uk/` has no `X-Robots-Tag`; `curl -sI https://vitalos-platform.vercel.app/` has `X-Robots-Tag: noindex, nofollow`.
   - `curl -s https://vitalos.co.uk/indexnow-key.txt` returns the key.
   - `pnpm seo:check --live https://vitalos.co.uk` passes.
7. Leave `www.vitalos.co.uk` attached as a redirect permanently. Backlinks and the old index point at it.

**Rollback**: in Domains, make `www.vitalos.co.uk` primary again and set the apex to redirect to www; set `NEXT_PUBLIC_SITE_URL` and `SITE_URL` back to `https://www.vitalos.co.uk`; promote the deployment noted in step 1. Then re-run step 6 with the hosts swapped.

## 3. Cloudflare (DNS host) checks

DNS is on Cloudflare (`jose`/`kimora.ns.cloudflare.com`) with the records **not proxied** (DNS only): responses come straight from Vercel, with no `cf-ray`. So Cloudflare's bot rules do not touch the site today. Check this once, and again if anyone turns the proxy on:

- [ ] `vitalos.co.uk` and `www` stay **DNS only** (grey cloud). If they are ever proxied: turn off "Block AI bots" (or match it to `crawler-policy.ts`), turn off "Managed robots.txt" (Cloudflare would prepend its own AI-crawler rules to ours), allow verified bots in Bot Fight Mode, and purge the cache after the host move so no cached `noindex` or old robots.txt is served.
- [ ] Leave "Crawler Hints" off: it sends its own IndexNow pings, and ours already cover deploys.

## 4. Tell the search engines (owner: sign-in needed)

**Google Search Console**

1. Sign in at search.google.com/search-console with the Google account that owns the `google-site-verification` TXT records on `vitalos.co.uk`. The **Domain property `vitalos.co.uk`** should already be there and covers both hosts. If it is not, add a Domain property; Google shows a TXT record, and adding it is a DNS change, so it needs owner approval. Alternatively, add a URL-prefix property for `https://vitalos.co.uk/` with the HTML-tag method: set `GOOGLE_SITE_VERIFICATION` in Vercel production (token only) and redeploy.
2. Sitemaps → submit `https://vitalos.co.uk/sitemap.xml`. Remove any old `https://www.vitalos.co.uk/sitemap.xml` submission.
3. URL Inspection → Request indexing for `/`, `/what-we-do`, `/solutions/application-modernisation`, `/solutions/ai-transformation`, `/what-we-do/engineering`, `/offers/technology-health-assessment` and `/contact`.
4. Run the Rich Results Test on `/` and one solution page (breadcrumbs should be detected).

**Bing Webmaster Tools**

1. Sign in at bing.com/webmasters with a Microsoft account; choose **Import from Google Search Console** (it verifies through Google), or add the site and verify with `BING_SITE_VERIFICATION` (meta tag).
2. Sitemaps → submit `https://vitalos.co.uk/sitemap.xml`.
3. IndexNow → confirm the key is detected; the next production deploy pings automatically. To ping now: `node tooling/seo/indexnow-deploy.mjs --site https://vitalos.co.uk`.
4. Turn on the AI Performance report (Copilot citations).

**Social previews**

- LinkedIn Post Inspector (linkedin.com/post-inspector): inspect `https://vitalos.co.uk/` and one practice page, to refresh LinkedIn's cache and confirm the 1200×630 image.

## 5. Four weeks of monitoring

| When            | Check                                                                                                         | Action                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Day 1           | Step 2.6 again; Search Console › Pages for new errors                                                         | Roll back (§2) if the redirects or noindex behave unexpectedly                                                              |
| Weekly, 4 weeks | Search Console › Pages (404s, "Page with redirect", "Excluded by noindex"); Crawl stats; Bing › Site Explorer | A 404 with traffic or links: add a 308 (REDIRECTS.md). An indexable page excluded by noindex: check host and `X-Robots-Tag` |
| Weekly          | Indexed count for www vs apex                                                                                 | The www count should fall and the apex count rise. If www stays indexed after 4 weeks, check the 308s and the sitemaps      |
| Weekly          | Core Web Vitals (Search Console, Speed Insights if switched on)                                               | REPORTING.md row 6                                                                                                          |
| Week 4          | Full monthly check (REPORTING.md)                                                                             | Start the monthly cadence                                                                                                   |

**Code rollback**: `npx vercel rollback` (or promote the previous deployment) returns the previous build within seconds. Redirects and robots ship with the deployment, so they roll back with it.
