# Insights and Careers: runbook

Insights (the blog) and Careers are authored in the Super Admin (admin.vitalos.co.uk) and shown on the website (www.vitalos.co.uk). The two apps share no database and talk only through signed HTTP (ADR-039, ADR-040).

- Brief: [`BRIEF.md`](BRIEF.md)
- Decisions: [`DECISIONS.md`](DECISIONS.md)
- Candidate privacy notice draft: [`PRIVACY.md`](PRIVACY.md)
- Owner decisions and approvals: GitHub issue #43

## Architecture in one picture

```
Editor ─▶ Super Admin (Django, its own Postgres)
            │  working copy ─ Publish ─▶ published snapshot + immutable revision
            │  same transaction: audit row + content_sync.SyncEvent (the outbox)
            │
            ├─ after commit: signed POST /api/content/revalidate ─────────────▶ Website (Next.js)
            │                                                                   revalidateTag(...)
            │                                                                   + warms the paths
            ◀─ signed GET /api/content/v1/... (published snapshots only) ──────┤ cached readers
            ◀─ signed POST /api/careers/v1/... (upload tickets, applications) ─┤ form routes
            ─▶ signed POST /api/content/render (preview = production) ─────────▶ the one renderer

Cloudflare Worker (every minute) ─▶ website /api/content/cron/tick ─▶ admin tick (only when due)
```

- **Contract:** [`contracts/content-api/v1/`](../../contracts/content-api/v1/), containing:
  - `openapi.yaml`: every payload in both directions, and the signing scheme;
  - `tags.json`: cache tags, the tags each read carries, the tags each event emits, and path patterns;
  - `fixtures/`.

  The admin keeps a byte-identical copy in `superadmin/apps/content_sync/contract/`, and a test checks the two match. Change both together.

- **Admin code:** `superadmin/apps/{content_sync,insights,careers}`.
- **Website code:** `apps/web/src/features/content/`, `apps/web/app/api/content/`, `apps/web/app/api/careers/`, and the Insights and Careers routes under `apps/web/app/(site)/`.

## Configuration

Names only; never put values in the repo. The admin's variables are in `superadmin/.env.example` and `superadmin/docs/DEPLOY.md` section 9. The website's variables are in the root `.env.example`.

### Key pairs

Values are lists of `keyId:secret`. The signer uses the first entry; the verifier accepts any listed entry.

| Purpose (scope)                    | Website variable                                           | Admin variable                                 |
| ---------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| Read API and tick (`read`, `tick`) | `CONTENT_READ_KEY_ID` + `CONTENT_READ_SECRET` (signer)     | `CONTENT_READ_CLIENT_KEYS` (verifier)          |
| Careers intake (`submit`)          | `CAREERS_SUBMIT_KEY_ID` + `CAREERS_SUBMIT_SECRET` (signer) | `CAREERS_SUBMIT_CLIENT_KEYS` (verifier)        |
| Revalidation (`revalidate`)        | `CONTENT_REVALIDATE_SECRET` (verifier)                     | `CONTENT_REVALIDATE_SECRET` (signer)           |
| Rendering (`render`)               | `CONTENT_RENDER_SECRET` (verifier)                         | `CONTENT_RENDER_SECRET` (signer)               |
| Preview tokens (`preview`)         | `CONTENT_PREVIEW_SECRET` (verifier)                        | `CONTENT_PREVIEW_SECRET` (signer and verifier) |

### Other variables

- **Website:**
  - `CONTENT_API_BASE_URL` (`https://admin.vitalos.co.uk`)
  - `CONTENT_CACHE_TTL_SECONDS` (600)
  - `CONTENT_MEDIA_HOST`, `CAREERS_UPLOAD_HOST`
  - existing: `CRON_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- **Admin:**
  - `CONTENT_WEB_TARGETS` (website base URLs, comma-separated; the first one serves Preview, View on site and the renderer)
  - `CONTENT_MEDIA_BUCKET`, `CONTENT_MEDIA_PUBLIC_BASE_URL`
  - `CAREERS_CV_BUCKET`, `CAREERS_CV_MAX_MB`
  - `CAREERS_EMAIL_FROM`, `CAREERS_CANDIDATE_EMAILS_ENABLED` (false)
  - `CONTENT_RELAY_SYNC_ENABLED` (false), `CONTENT_IP_SALT`, `CONTENT_READ_RATE_LIMIT`, `CONTENT_OPPORTUNISTIC_TICK`
  - existing: `OBJECT_STORAGE_*`, `RETENTION_ENFORCE`, `EMAIL_TRANSPORT`

### Generating key pairs

On any machine, without printing the values to a shared log:

```sh
openssl rand -hex 32   # one secret; pair it with a short key id such as "k1"
```

Set the same `keyId:secret` value in both apps:

- website: Vercel, Production and Preview;
- admin: the GitHub `production` environment, which the deploy copies into Container Apps secrets.

### Rotating a key with no downtime

1. **Verifier first:** prepend the new pair to the verifier's list, so it holds `k2:new,k1:old`, and deploy.
2. **Signer next:** switch the signer to `k2:new` and deploy.
3. **Remove the old key:** once nothing signs with `k1`, drop it from the verifier.

For the website-signed scopes (`read`, `submit`), step 1 is on the admin. For the admin-signed scopes (`revalidate`, `render`, `preview`), step 1 is on the website.

## How sync works

1. **Every admin change that affects the site** writes its data, revision, audit row and a `SyncEvent` in one transaction.
2. **After commit,** the admin POSTs `{eventId, kind, tags, paths}` to every target:
   - `publish` events: the website revalidates the tags stale-while-revalidate and warms the paths;
   - `remove` events: it expires the tags immediately.
3. **Failed deliveries** retry on each tick, with backoff of 1, 2, 4 … minutes and up to 10 attempts. After 3 failures the admin raises an in-app alert, and the item shows **SYNC FAILED · RETRY**.
4. **The read API applies query-time filters,** so a due scheduled post or an expired role is correct even before the tick runs. The website's cache TTL (600 s) is the last safety net.
5. **The website stays up when the admin is down** (ADR-040):
   - cached pages are served;
   - homepage sections are left out;
   - a page with nothing cached returns 503 with `Retry-After: 120`.

## Day-to-day operations

- **See sync status:** Super Admin › Website sync (`/content/sync/`). Each Insights or Careers list also shows per-item status, and the top bars show the overall state.
- **Retry one event:** Website sync › Retry on the row, or **SYNC FAILED · RETRY** on the item.
- **Resync everything:** Website sync › Resync everything (SuperAdmin; audited). It emits `site.resync`, which revalidates `site`, `insights`, `careers`, `home`, `feed` and `sitemap`.
- **Run the tick by hand:** `python manage.py content_tick` (add `--loop` locally).

## The scheduler (ADR-042)

The Cloudflare Worker in `infra/cloudflare-content-tick` calls `https://www.vitalos.co.uk/api/content/cron/tick` every minute with the website's `CONTENT_TICK_SECRET` (the route also accepts `CRON_SECRET`, which Vercel Cron uses). The website calls the admin only when its cached `nextDueAt` has passed, so idle minutes cost nothing on Azure.

**Deploy it** once the website change is live, from `infra/cloudflare-content-tick`:

```sh
npx wrangler secret put TICK_URL      # https://www.vitalos.co.uk/api/content/cron/tick
npx wrangler secret put TICK_SECRET   # the website's CONTENT_TICK_SECRET
npx wrangler deploy
```

**Backstops:**

- the admin's opportunistic tick, which runs on any admin or read-API traffic;
- a daily Vercel cron;
- the cache TTL.

**Paid alternative:** a Container Apps scheduled job (`superadmin/docs/DEPLOY.md`, "Content tick job"). It costs money and needs owner approval.

## Failure modes

| Symptom                                      | Likely cause                                                                                   | What to do                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Items stuck on SYNC PENDING or SYNC FAILED   | Website unreachable, or the revalidate key differs between the apps                            | Check `CONTENT_WEB_TARGETS` and `CONTENT_REVALIDATE_SECRET`, then Retry                          |
| Publish blocked with "renderer unavailable"  | The admin cannot reach `{first target}/api/content/render`, or `CONTENT_RENDER_SECRET` differs | Fix the target or key; the post stays saved                                                      |
| Website Insights or Careers pages return 503 | The admin is down or cold-starting, and the page was never cached                              | Wait for the admin. The 503 carries `Retry-After`; cached pages keep working                     |
| Scheduled post late                          | The Worker is not running, or the website's site state is stale                                | Check the Worker's cron logs; run `content_tick`; a scheduled event refreshes site state at once |
| Preview says "Preview unavailable"           | Render endpoint unreachable                                                                    | Editing continues; fix the target or key                                                         |
| CV upload refused in production              | No `CAREERS_CV_BUCKET`                                                                         | Create the R2 bucket (approval item)                                                             |

## Retention (ADR-041)

- **When:** every night the tick deletes each application and its CV `retention_months` (6) after the later of the decision date and the role's closing date.
- **Exceptions:** hired applications are flagged for manual handling instead of deleted. Pending uploads older than 24 hours are purged.
- **Dry run:** it changes nothing and only logs counts until `RETENTION_ENFORCE=true`, the same switch as enquiry retention.
- **Audit:** every deletion is audited with a hashed id.

## Opening Insights and Careers (owner approval)

Both are closed until the owner opens them. While closed, their pages return 404, and they are left out of the homepage, navigation, footer, sitemap and feed.

1. **Configure both apps:** set the variables above in Vercel (website) and the GitHub `production` environment (admin), then deploy both.
2. **Insights:**
   - Super Admin › Insights › Authors: add a real person, have them approve their profile, and tick "This is a real person who has approved this profile".
   - Super Admin › Insights › Posts › New post: write, Submit for review, Approve, tick the five editorial checks, then Publish.
3. **Careers:**
   - Create the R2 CV bucket with the CORS rule in `superadmin/docs/DEPLOY.md` section 9.
   - Approve the candidate privacy notice (`PRIVACY.md`) and set its URL and version in Careers › Settings.
   - Open the role in Careers › Roles.
4. **Open the sections:** Super Admin › Settings › Website content: switch on Insights and/or Careers. The site updates within seconds.

## Tests

- **Admin:** `cd superadmin && .venv/Scripts/python -m pytest` (Windows) or `pytest` (CI, PostgreSQL).
- **Website:**
  - unit tests: `corepack pnpm --filter @vitalos/web test`;
  - contract drift: `corepack pnpm content:types:check`.
- **Website against a fake admin** (fixtures; Insights and Careers function, axe and visual): `corepack pnpm exec playwright test -c tests/content/playwright.config.ts`.
- **Both real apps together** (sync timings, availability drill, careers flow): `corepack pnpm exec playwright test -c tests/content-sync/playwright.config.ts`. It needs `superadmin/.venv`, and timings go to `test-results/content-sync/timings.json`.
