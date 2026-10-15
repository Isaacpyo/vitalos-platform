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
