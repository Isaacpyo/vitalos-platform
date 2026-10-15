# ADR 038 Content scheduler (the per-minute tick)

Status: Accepted (engineering, 15 October 2026). The paid alternatives are on the approval list.

## Context

The brief needs a tick every minute. The tick:

- promotes scheduled posts;
- closes roles whose closing date has passed;
- retries undelivered sync events;
- runs retention;
- purges orphaned uploads.

The Super Admin runs on Azure Container Apps, scaled to zero, inside the free grant (ADR-026). It has no running scheduler: the enquiry notification job is prepared but not created (`superadmin/docs/email-setup.md` section 8). A Container Apps job every minute (about 43,000 runs a month), or anything that wakes the app every minute, would exceed the free grant once Azure moves to pay-as-you-go. Vercel crons on this plan run at most daily. Relay schedules through `pg_cron` in the website's Supabase project, but this job must not touch that database (owner amendment A1).

## Decision

1. **`manage.py content_tick`** does all of the tick's work. Rows are claimed with `select_for_update(skip_locked=True)` and every transition is conditional, so overlapping runs never process anything twice. A `--loop` flag runs it every 60 s for local development and E2E tests.
2. **The admin runs the tick itself, opportunistically,** at most once a minute and in a background thread. It does so whenever it serves a content API request or a signed-in admin page in Insights, Careers or Content. Whenever the site is being read or edited, due work is therefore done.
3. **A free per-minute trigger that wakes the admin only when needed.**
   - The website's `GET /api/content/cron/tick` route is authorised with `CRON_SECRET`. It reads the cached site state, whose `nextDueAt` is the earliest future `publish_at`, `closes_at` or retry time.
   - It calls the admin's signed `POST /api/content/v1/tick` only when that time has passed. Otherwise it returns without contacting the admin, so idle minutes cost nothing on Azure.
   - A Cloudflare Worker cron trigger (`infra/cloudflare-content-tick`, Workers free plan, every minute) calls the route.
4. **Backstops.** The query-time filters (ADR-036) make the read API correct at any moment. The cache TTL (600 s) bounds how long the website can show a stale state. A daily Vercel cron calls the same tick route.

## Options

- **A Container Apps scheduled job every minute.** Prepared (`superadmin/docs/DEPLOY.md`, "Content tick job"), but it costs money once the free grant is exceeded, so it is on the approval list.
- **`pg_cron` in the website's Supabase.** Rejected: owner amendment A1.
- **A GitHub Actions schedule.** Rejected: 5-minute minimum, unreliable timing, and the repository rule against crons that mostly produce nothing.

## Consequences

- Scheduled posts and closing dates are applied within about a minute when the Worker runs. They take effect within the TTL in the worst case, and at once for anyone reading the read API.
- `nextDueAt` is read from the website's cached site state, which is refreshed by every sync event and by the TTL. A retry that becomes due while the website is down is noticed within the TTL.
- Revisit if the admin gets an always-on replica (then a Container Apps job or an in-process scheduler is simpler).
