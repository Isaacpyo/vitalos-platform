# ADR 040 Content API contract, signing scopes, caching, availability and sync

Status: Accepted (engineering, 15 October 2026). Builds on ADR-039.

## Context

Under ADR-039 the website renders Insights and Careers from data the Super Admin owns. The brief requires:

- changes on the site within 5 s (p95);
- scheduled transitions within 2 minutes;
- convergence within the cache TTL if everything else fails;
- nothing unpublished ever served;
- the site staying up when the admin is down.

The website runs Next.js 16.4 **without** Cache Components. Next.js cannot set a 503 status, or server-render a 404 body, from a page (ADR-027).

## Decision

### Contract

`contracts/content-api/v1/openapi.yaml` describes every request and response in both directions. `tags.json` holds the cache tags, the tags each read carries, the tags each event emits and the path patterns. `fixtures/` holds the shared payloads, which are obviously fictional.

- **Admin:** response builders are checked against the OpenAPI schemas (the fixtures and live responses are validated with `jsonschema`).
- **Website:** zod schemas mirror the contract, and the `openapi-typescript` types are generated and checked for drift.
- A contract test in each app validates every fixture.

The admin formats every derived value: dates in Europe/London, salaries, reading time and labels.

### Signing

Scheme `v1` extends the Enquiries scheme (ADR-029) to cover the scope, timestamp, method, path with query string and body hash. Details are in the OpenAPI description.

- **Scopes:** `read` (also used for `tick`), `submit`, `revalidate`, `render` and `preview`.
- **Keys:** each scope has its own keys, configured as `keyId:secret` lists. The signer uses the first entry and the verifier accepts any listed entry, so keys rotate with no downtime.
- **Checks:** clock skew over 300 s is refused, and comparisons are constant-time.
- **Preview tokens** are separate HMAC tokens with a 15-minute expiry, checked by both apps.

### Caching on the website

- **Reads** go through `unstable_cache`, keyed by endpoint and parameters and tagged per `tags.json`, with `revalidate = CONTENT_CACHE_TTL_SECONDS` (600).
- **Detail tags are keyed by slug, not id.** `unstable_cache` needs a read's tags before the read, and the admin knows both old and new slugs when it emits an event. Every event also emits the broad `insights` or `careers` tag, which every read in that section carries.
- **`POST /api/content/revalidate`:**
  - `publish` events call `revalidateTag(tag, "max")`, then warm each affected path with a server-side GET, so the new version renders while the old one is still served.
  - `remove` events call `revalidateTag(tag, { expire: 0 })` and `revalidatePath` for removed and old-slug paths, so removed content is never served again.
- **Draft Mode reads** (preview) are never cached.

### Availability and status codes

- A failed read throws and is never cached. Pages already cached keep being served: ISR keeps the last good render when a background regeneration fails.
- Homepage sections catch their own failures and are left out, so the homepage never errors because of them.
- **The proxy decides statuses that a page cannot set** (ADR-027). For Insights and Careers paths it asks `/api/content/lookup?path=…`, an internal route that uses the same cached readers as the pages, and acts on the answer:
  - `redirect` → 308 to the current slug;
  - `missing` (unknown slug, or the section is closed) → rewrite to the server-rendered 404;
  - `unavailable` (nothing cached and the admin unreachable) → 503 with `Retry-After: 120`;
  - `ok` → pass through.
- The proxy keeps each verdict in memory for 30 s per instance, and confirms a "missing" verdict that is older than 3 s, as ADR-027 does.

### Outbox and delivery

- **The outbox** is `content_sync.SyncEvent`. It is written in the same `transaction.atomic()` block as the change, the revision and the audit row.
- **Delivery** runs on `transaction.on_commit`: a signed POST to each URL in `CONTENT_WEB_TARGETS`, with a 3 s timeout.
- **Retries** happen on each tick (ADR-042), with backoff of 1, 2, 4 … minutes, up to 10 attempts. After 3 failed attempts staff get an in-app alert.
- **Status:** each item shows its sync status. `/content/sync` lists events and offers Retry and Resync everything.

### Query-time filters

The read API treats `scheduled` posts whose `publish_at` has passed as published, and roles whose `closes_at` has passed as closed, on every request. Correctness never depends on the scheduler.

## Options

- **Cache Components with `cacheTag` after the read.** Rejected for now: it means restructuring the whole site, and the brief says not to switch.
- **Ids in tags.** Not workable with `unstable_cache` (see above).
- **Page-level try/catch to show a "temporarily unavailable" page.** Rejected: its status would be 200 or 500, not 503.

## Consequences

- One extra internal request per Insights or Careers detail path per instance per 30 s, made by the proxy.
- The admin scales to zero, so a cold start can exceed the 2.5 s read timeout. A first render during a cold start returns 503 and retries. Cached pages are unaffected. Keeping one replica warm costs money, so it is on the approval list.
- Revisit when the site adopts Cache Components: the proxy lookup and slug-keyed tags could then go.
