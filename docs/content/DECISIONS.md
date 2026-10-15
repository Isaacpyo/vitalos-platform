# Decisions: Insights and Careers

Numbered and append-only. ADRs hold the architecture; this file holds the smaller choices and fallbacks made while building (brief section 0).

1. **Architecture.** The owner chose the recommendation on 15 Oct 2026: the Super Admin owns the data, and the two apps talk only through signed HTTP (ADR-035, ADR-036). The website's Supabase is not touched.
2. **ADR numbers 035 to 038.** ADR-031 to ADR-034 are taken by the unmerged `feat/relay` branch.
3. **Brand references.** `docs/relay/reference/` does not exist on `main`, so the website uses `@vitalos/design-tokens` and the existing site components. The token package still holds `#2457FF` and `#081A2A`, pending the owner's decision in `docs/brand/token-reconciliation.md` (ADR-029). The brief's `#2458E6` is therefore not applied to the website; the action colour comes from the token.
4. **Detail cache tags are keyed by slug** (`insights:post:{slug}`), not id. `unstable_cache` needs a read's tags before the read (ADR-036). Every event also emits the broad section tag.
5. **`site` tag.** It is used for site state (open or closed). The brief's tag pattern does not allow `site-state`.
6. **The scheduler** is a Cloudflare Worker cron calling the website's tick route, which wakes the admin only when something is due, with an opportunistic tick in the admin as a backstop (ADR-038). A per-minute Container Apps job is prepared and is on the approval list (it costs money).
7. **Status codes from the proxy.** Next.js 16.4 can only set 401, 403 and 404 from a page, so the proxy asks an internal lookup route and answers 308, 404 (server-rendered), 503 with `Retry-After`, or passes through (ADR-036).
8. **Production CV storage** needs `CAREERS_CV_BUCKET` (R2, free tier). Without it, production refuses upload tickets (ADR-037).
9. **Admin search** is `icontains` on title and excerpt, not a Postgres full-text index. Tests run on SQLite, and the volume is small. Revisit above a few thousand posts.
10. **Retention** runs as a dry run until `RETENTION_ENFORCE=true` is set, the existing switch the enquiry retention uses.
11. **Admin cold starts.** The admin scales to zero, so a read can exceed the 2.5 s website timeout during a cold start. The website then serves its cache, or returns 503 if it has nothing cached. One warm replica costs money and is on the approval list.
12. **Contract strictness.** Base schemas that are extended through `allOf` (PostSummary, RoleSummary, AuthorRef, TopicRef, FormatChoice) are not closed with `additionalProperties: false`. The extended schemas use `unevaluatedProperties: false`, and the website's zod schemas are strict for every shape.

## Phase 1: website

13. **Legacy proxy check while unconfigured.** While `CONTENT_API_BASE_URL` is unset, the proxy keeps the ADR-027 CMS check for Insights and Careers detail paths (`legacyContentFamilies`). Once it is set, only the content lookup is used. The legacy table goes when the CMS-based pages are removed.
14. **Website reads of the admin's preview endpoint** are signed with the read key (scope `read`), and the preview token travels in `X-Vitalos-Preview-Token`.
15. **Lookup route authentication:** `x-vitalos-lookup: {ts}.{HMAC(k, ts\npath)}`, with a 60 s window, where `k = HMAC(CONTENT_READ_SECRET, "vitalos-content-lookup-v1")`. A per-process secret would not work, because the proxy and route handlers run as separate functions on Vercel. Unauthorised calls get 404.
16. **The proxy self-fetches only to a trusted origin:** the site, `VERCEL_URL` or localhost. Otherwise it uses `siteUrl`, so a forged Host header cannot redirect the signed lookup. Vercel previews with Deployment Protection fail the self-fetch, and the proxy then passes through.
17. **Proxy verdict cache:**
    - 30 s for ok, missing and redirect;
    - missing re-confirmed after 3 s;
    - unavailable kept 5 s, and a failure remembered 5 s;
    - lookup timeout 6 s, at most 2,000 entries.

    The cache is held on `globalThis`, so a revalidate call clears it on the same instance. 308 and rewritten-404 responses are `no-store`, because slugs can be reused.
18. **`/insights/page/1` returns 308 to `/insights`.** Pages beyond `totalPages` are missing.
19. **Rate limits** are in memory per instance, keyed by a salted IP hash, because the website's database is not touched:
    - revalidate 120 a minute;
    - render 60 a minute;
    - preview 30 a minute;
    - lookup 1,200 a minute;
    - tick 30 a minute.

    The revalidate body cap is 64 KB, and routes with no keys configured return 503.
20. **Warming after publish:** publish events warm the affected paths after the response (`after()`), with concurrency 4 and an 8 s timeout each.
21. **Renderer (post context):**
    - **Headings:** h1 is demoted to h2 with a blocking warning, h5 and h6 are clamped to h4, and a skipped level gets a non-blocking warning.
    - **HTML:** raw HTML is stripped, with a non-blocking warning.
    - **Images:** they must be on the exact media origin and not SVG, otherwise they are dropped with a blocking warning. A missing alt is blocking.
    - **Links:** they always open in the same tab, and external links get `rel="noopener noreferrer"`.
    - **Footnotes:** they render as a "Sources" list.
    - **Order:** sanitising runs before the trusted structure transforms (ids, callouts, table regions, figures, Shiki with the Night Owl theme on a midnight background), so no attribute that comes from input is ever allow-listed.

    Contexts `role`, `author` and `settings` allow no images and no highlighting.
22. **Configuration:**
    - A bare host in `CONTENT_MEDIA_HOST` or `CAREERS_UPLOAD_HOST` is read as `https://`.
    - Production requires https for those two and for the admin URL.
    - A base URL without a read key, or a key id without its secret, fails the build.
    - `CONTENT_CACHE_TTL_SECONDS` is limited to 30–86,400.
23. **Preview cookie** `vitalos_preview`: HttpOnly, SameSite=Lax, and Secure unless the site URL is plain http. It lasts until the token expires. Exit accepts only same-site relative paths.
24. **After a tick**, the tick route expires the `site` tag immediately, so the next read sees the new `nextDueAt`. Vercel calls it daily at 05:00, as a backstop to the Worker.
25. **Generated types** are at `apps/web/src/features/content/generated/openapi.ts`. Drift fails the web Vitest suite and `pnpm content:types:check`.
26. **The PreviewBar** is a server component fixed to the bottom of the viewport. `draftMode()` is read first, so pages stay static.
27. **Dependency peer warning.** `openapi-typescript` 7.13 declares a TypeScript 5 peer while the repo uses 6.0.3. Generation works, and the warning is the same kind as the existing ESLint plugin peer warnings.

## Phases 1 and 2: Super Admin

28. **Snapshots and live refs.** `published_snapshot` is the exact PostDetail JSON at publish time. On read, author and topic references are refreshed from the live rows, and related posts are filtered again against what is published now, so an unpublished post never leaks through a related list.
29. **Extra published-state columns.** These exist so lists never load bodies, and so the public slug and closing date change only on publish:
    - posts: `published_summary`, `published_slug`, `published_hash`, `published_pin_home`;
    - roles: `published_slug`, `published_hash`, `published_closes_at`.
30. **Slug changes go live on publish.** The redirect is created then, and the editor warns about it beforehand. Publishing a slug that a redirect currently holds deletes that redirect.
31. **Scheduling** checks every gate and freezes the snapshot when the post is scheduled. The tick, or the query-time filter, only flips the status and writes the revision, audit row and event. Cancelling a schedule returns the post to approved.
32. **Publishing fails closed when the renderer is unreachable.** Publish and Schedule are blocked with an explanation. Renders are cached for 10 minutes per body.
33. **The revision hash** covers every snapshot field: title, excerpt, body, format, slug, practice, cover, featured, pin to homepage, CTA, SEO, canonical, noindex, ordered authors, topics and related posts. A change to any of them invalidates the ticked checks. "Material update" is left out.
34. **The authors check** can only be ticked when every author is confirmed and active. The same rule is also a hard publish blocker.
35. **Permissions:**
    - `insights.publish_post`: approve, publish, schedule, unpublish, archive live posts and confirm authors.
    - `insights.change_post`: everything else on posts.
    - `insights.change_author` and `insights.change_topic` for authors and topics.
    - `content_sync.change_sitesection`: Insights settings.
    - SuperAdmin only: opening and closing sections, and Resync everything.
    - Viewers see the editor read-only.
36. **Workflow details:**
    - The "In review" tab includes approved posts.
    - Unpublish and Archive clear the snapshot and keep `published_slug`.
    - Delete is only for posts that were never published, and emits nothing.
    - Autosave is audited at most once per 10 minutes per post and editor.
37. **Author and topic edits** emit events only when they appear on a published post. An author slug change gets a redirect; topics have no redirect, because the contract has none. A topic used by any post cannot be deleted.
38. **Images.** Author photos must already be square, because there is no server crop without adding Pillow. Image dimensions are read from the file headers (PNG, JPEG, WebP, AVIF). Media keys are `content/{uuid}.{ext}`. Production refuses image uploads without `CONTENT_MEDIA_BUCKET`.
39. **Body image dimensions** travel as a URL fragment, `#w=1600&h=900`. The admin writes it when it inserts an uploaded image, and the website's renderer uses it and strips it (contract `bodyMarkdown` description).
40. **New `site.updated` event** (tags `site`, `insights`, `home`) for changes to the Insights page copy. It is added to `tags.json`.
41. **Delivery accounting.** With no targets, an event counts as delivered (`no_targets`). With targets but no revalidate key, delivery counts as failed (`not_configured`). Delivery is sequential per target, and retries go only to targets that have not acknowledged.
42. **`nextDueAt` includes overdue items**, so the website's tick calls the admin straight away.
43. **The sync-failure notification** uses kind `content_sync_failed` without adding it to the `Kind` choices, because adding a choice is an `AlterField`, which the deploy guard refuses.
44. **Preview** of a post with no author returns 404, because the contract requires at least one author, and the editor explains why. A token's `rev` is not checked against the current hash, because autosave changes it constantly.
45. **Opportunistic tick:** a conditional update on `TickState` allows one run a minute across processes, in a daemon thread, and it is off in tests. The read API is rate-limited per key id in Django's cache (600 a minute, `CONTENT_READ_RATE_LIMIT`).
46. **The read API** also sends `X-Robots-Tag: noindex`. A wrong method gets 405 before the signature is checked.
47. **Careers privacy fields.** The careers privacy notice URL and version are seeded empty until the owner approves the notice. The homepage careers intro is the first sentence of the approved intro.
48. **Vendored contract.** The Docker build context is `superadmin/`, so the contract is copied into `apps/content_sync/contract/`. A test asserts the copy is byte-identical to `contracts/content-api/v1/`, and Super Admin CI also runs on changes to `contracts/**`.
49. **The preview iframe** is a dedicated view with its own CSP (no scripts, inline styles allowed), not `srcdoc`. A `srcdoc` iframe would inherit the admin's nonce-based CSP and block inline styles.
50. **Topic slugs** turn "&" into "and" (for example `health-and-care`).
51. **Test settings** blank every content key, so a developer's `.env` cannot leak into tests.
