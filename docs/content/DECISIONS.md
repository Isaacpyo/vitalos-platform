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

## Phases 4 and 5: Super Admin

52. **The role editor** uses a normal form save with `updated_at` conflict detection; there is no autosave (the brief asks for autosave on posts only). Open, Publish changes and Reopen render every filled section (context `role`), and they are blocked by blocking warnings or an unreachable renderer.
53. **Opening and reopening roles.** Opening needs any closing date to be in the future. `opens_at` is not in the editor, because no scheduled-opening behaviour is defined. Reopen takes a fresh snapshot and emits `role.opened`.
54. **Role lifecycle.** Pause, Close and Archive keep the snapshot, and Archive sets `closed_at` so retention has an anchor. Roles are never hard-deleted, because applications reference them; Archive is used instead.
55. **Role and application permissions:**
    - `careers.change_role`: edit and duplicate roles.
    - `careers.publish_role`: open, publish changes, pause, close, reopen and archive.
    - `careers.view_application`: work on applications.
    - `careers.view_cv`: download CVs.
    - `careers.delete_application`: delete applications.
56. **Applications are refused (409)** when Careers is closed, the role is not open, the published closing date has passed, or the role applies externally. A repeated `submissionId` returns the first response (200), even after the role has closed.
57. **Upload tickets and the fallback PUT:**
    - The extension must match the declared type, and only the SHA-256 of the fallback token is stored.
    - The fallback PUT allows requests with no `Origin` header (the token is the capability) and answers 403 for an origin that is not allowed.
    - Magic bytes are checked at upload and again at submit.
    - A ticket is consumed by a conditional update, so one upload gives one application.
    - The CV is copied to its final key and the pending object is then deleted.
58. **Email limit and duplicates.** Each email address may submit at most 3 applications in a rolling 24 hours, across all roles. `duplicate_of` points at the earliest application with the same email and role within 30 days.
59. **IP hashing.** `ip_hash` is HMAC-SHA256 with `CONTENT_IP_SALT`, falling back to Django's `salted_hmac` when the salt is unset. The raw IP is never stored.
60. **Hiring-team alerts.** In-app notifications use kind `careers_application`, not added to the choices, because that would need an `AlterField`. The internal email is plain text with names and admin links only, at most one per role per 10 minutes, and it counts towards `RESEND_DAILY_LIMIT`.
61. **Candidate email templates** are seeded with neutral wording (`{name}`, `{role}`). They need owner approval together with `CAREERS_CANDIDATE_EMAILS_ENABLED`.
62. **Retention:**
    - Admin Delete and retention share one deletion function, which audits a salted hash of the id.
    - Nothing is due while a role has no `closed_at`.
    - With `RETENTION_ENFORCE` off, retention changes nothing and only logs counts.
63. **`import_repo_content` treats an item as a placeholder** when `placeholder` or `isPlaceholder` is true, or when `status` is `"placeholder"`, and refuses it. Unknown authors are created unconfirmed, and imported roles always hide the salary.
64. **The R2 CORS rule for the CV bucket** allows only the production website origins, PUT only, headers Content-Type and Content-Length, and a max age of 600 s (`superadmin/docs/DEPLOY.md` section 9).
65. **Deploy variables.** `superadmin-deploy.yml` maps the new `CONTENT_*` and `CAREERS_*` GitHub variables and secrets to `deploy.sh`, which masks them and stores the secrets as Container Apps secrets.

## Phase 3: website

66. **Rendering.** Pages are static or ISR. Detail routes are generated on first request and share the readers' tags and TTL. The feed is static, and the OG image is ISR with the post's tags. The body is rendered while the page is generated; the ISR HTML is the cache.
67. **Build-time behaviour.** If the content API is not configured at build time, Insights is built as closed, so turning the API on needs a redeploy (as any Vercel env change does). If the admin is unreachable during `next build`, reads count as closed so a deploy cannot fail on it; ISR regenerates within the TTL. At runtime a failed read throws and is never cached.
68. **Format filters** keep `/insights?format=…` as the public URL. A `beforeFiles` rewrite serves them from `/insights/format/[format]`, so no page reads `searchParams`. Filtered views are `noindex, follow` with the canonical on `/insights`.
69. **Topic pagination** is `/insights/topics/{slug}/page/{n}` (added to `pathPatterns`). Author pages are not paginated; the contract returns at most 100 posts.
70. **Featured post:** the admin's choice, else the newest post. It is never repeated in the grid, and filtered views and later pages have no featured row.
71. **Typography and colour.** The brief's typography is mapped onto the existing site tokens (DECISIONS 3): Geist and the display, h1 and body sizes. The cobalt full stop is `text-tone-link`. The initials square uses the tile tokens, because there is no "mineral" token. The site has no dark theme yet, so the dark captures match the light ones.
72. **Breadcrumb.** The article shows the brief's visible mono breadcrumb and emits BreadcrumbList JSON-LD.
73. **Homepage band.** The homepage already had an Insights band (between Labs and Leadership), so brief 5.6 says to wire that band rather than add one. It now reads the admin's `home` data on a white ground, fails soft, and is followed by the Careers slot.
74. **Navigation, footer and homepage follow `insights_open`** and fail closed. With the API configured, every page carries the `site` tag through the site chrome and is ISR on the TTL.
75. **The Industry and People pages** no longer link CMS insights.
76. **Author bios on articles** come from cached author reads, one per author, which fail soft. `AuthorRef` in `PostDetail` carries no bio, and the contract is left as it is.
77. **Preview.** Draft Mode shows the working copy when the preview session matches the slug. Previews emit no JSON-LD and work while the section is closed.
78. **OG image.** It uses next/og's default font (Manrope is not loaded on the site), the text wordmark and the token colours. The Article publisher is the site's Organization node, with a logo only when one is configured.
79. **RSS** uses `dc:creator` for author names, because RSS `<author>` must be an email address. The channel description is the Insights intro.
80. **`/blog` redirects.** `/blog` and `/blog/:path+` return 308 to `/insights` (an exact rule plus a `sectionMoves` pattern list, tested to stay in step).
81. **Sitemap.** CMS `/insights` entries are always dropped, and CMS `/careers` entries are dropped once the API is configured. Admin entries are validated against `pathPatterns`. If the admin read fails, the static entries are kept.
82. **The CTA arrow** is a text "→", because the repo has no square-capped arrow asset.
83. **`tests/content/`** runs the website against a fake admin that serves the contract fixtures and verifies scheme v1 independently. It covers function, axe on every Insights page and the homepage, and screenshots at 1440, 768 and 390. It is not in CI.

## Integration fixes

84. **Scheduling refreshes the website's site state.**
    - **Finding:** the browser checks and the two-app suite showed that scheduling a post emitted no event, so the website's cached `nextDueAt` stayed stale until the TTL. The Worker tick would then miss the 2-minute target.
    - **Fix:** new events `post.scheduled` and `post.unscheduled` (kind publish, tag `site`, no paths), and `site` added to `role.opened` and `role.changes_published`, whose closing dates also feed `nextDueAt`.
85. **Admin sub-navigation scrollbar.** Insights and Careers sub-navigation hide vertical overflow; the tab underline's `-mb-px` made a stray scrollbar.

## Phase 4: website

86. **Careers filters** use the same rewrite technique as the Insights formats: `/careers?{practice|workModel|employmentType}=value` is served from `/careers/filter/{dimension}/{value}`. One filter at a time; links appear only above six roles; filtered views are `noindex, follow`.
87. **Turnstile** is verified at the upload-ticket step only, because tokens are single use. The application step relies on the single-use upload capability, rate limits, the honeypot and a same-origin check. Without Turnstile keys the check is off outside production and fails closed (503) in production.
88. **The application route re-reads the role** through the cached reader to refuse a closed role early (409). The admin checks again. `source` is always `role_page`.
89. **Copy not in the brief:** "We couldn't send your application. Check your connection and try again." is used when the application step cannot reach the admin. Upload failures use the brief's "Couldn't upload your CV…".
90. **The application form is hidden until hydration**, so without JavaScript only the brief's `<noscript>` line shows, rather than a form that would submit nowhere.
91. **The form is offered only when the role carries a privacy notice URL.** A null `privacy.noticeUrl` means no form and "Applications are not open yet". The notice is seeded empty until the owner approves it.
92. **JobPosting JSON-LD:**
    - `hiringOrganization` is the name plus `sameAs` the site URL, with a logo only when one is configured.
    - `jobLocation` carries only `addressLocality` from the free-text location; no country is invented. Remote roles use TELECOMMUTE with United Kingdom.
    - `baseSalary` appears only when the salary is shown, and `directApply` only for form roles.
    - The whole block is omitted if anything required is missing.
93. **The external apply link** opens in the same tab and says "opens a new site", both visibly and for screen readers.
94. **CSP `connect-src`** uses `CAREERS_UPLOAD_HOST`, falling back to the admin API origin.
95. **`pnpm content:export-repo`** writes `{posts, roles}` from the `repo` source, matched by `sourcePath` `repo:{kind}/{slug}`, with no placeholders. Today it writes empty lists.
96. **Unused CMS builders removed.** The CMS `articleJsonLd` and `jobPostingJsonLd` builders and the old CMS Careers templates are removed, because nothing uses them. `@vitalos/cms` exports are unchanged.

## Phase 6: security review (15 Oct 2026)

97. **Scope and result.** A read-only review of every inter-app endpoint in both apps found no high-severity issue and no authentication bypass. The signing scheme, read-API leak filters, renderer sanitisation, upload tokens and CV access held up.
98. **Fixed after the review:**
    - **Retention order (medium):** retention now deletes the storage object before the row, and a storage failure can no longer skip the nightly work.
    - **Random-slug probing (medium):** it can no longer exhaust the admin's read rate limit. The website pre-filters slugs against the cached sitemap with a small confirm budget, and the lookup is rate-limited by the real client IP.
    - **Strict signature headers:** malformed headers give 401, not 500.
    - **Single-line fields:** these are normalised at intake, so a newline cannot inject lines into staff emails.
    - **Production settings on the admin:** they enforce key length and https targets.
    - **Audit rows:** careers rows reference applications only by a salted hash.
    - **Per-IP caps:** the admin caps upload tickets and applications per hashed client IP, because the website's per-IP limits are per serverless instance.
    - **Lookup origin:** the proxy trusts localhost lookup origins only in local runs.
99. **Abandoned uploads.** Pending uploads and unused tickets older than 24 hours are purged for real even while `RETENTION_ENFORCE` is off. They are not records covered by the retention policy. The dry-run switch still governs applications.
100.  **Candidate emails** go to an address the applicant typed, so once enabled they act as a small relay (3 a day per address). Review this with the owner before switching them on (#43).
101.  **The presigned CV PUT binds the exact size.** With botocore 1.43 and S3v4, `X-Amz-SignedHeaders` includes `content-length` and `content-type`, so the ticket stays a PUT and the contract is unchanged. A test asserts this without any network call.
102.  **Failed daily steps retry on the next tick, not tomorrow.** A storage failure keeps the application row, logs `cv_delete_failed` and moves on. Signature hex must be lowercase, as the contract says.
103.  **Per-IP caps.** The upload-ticket endpoint takes an optional `X-Vitalos-Client-Ip` header (documented in the contract; outside the canonical string, trusted because only the website holds a submit key) for a cap of 10 tickets an hour per hashed IP. Applications are capped at 5 an hour per hashed `clientIp`, on top of 3 a day per email. Without the header, tickets have no IP cap.
104.  **404s on post and role detail reads count in a separate miss bucket**, 10 times the read limit, so slug probing cannot push the website's real reads into 429.
