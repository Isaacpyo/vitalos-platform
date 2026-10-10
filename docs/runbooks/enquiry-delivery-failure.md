# Enquiry delivery failure

Use when an enquiry was accepted (the visitor saw a reference such as `VIT-1A2B3C4D5E6F`) but the team was not notified, or the outbox shows stuck or failed rows. Design: ADR-019, `docs/architecture/enquiry-sequence.md`.

Principles: the database is the record, email is only a notification. Never ask the prospect to resubmit because a notification failed. Never paste enquiry content (name, email, goal) into tickets, chat or logs; read it only as an authorised owner and notify by an approved channel. Do not run these steps against production without owner authorisation.

## Current state (10 Oct 2026)

No email provider adapter exists and Vercel Cron is not configured. Production configuration allows `EMAIL_PROVIDER=none` only, so the dispatch endpoint answers 503 `notifications-not-configured` and outbox rows stay `pending`. Until a provider is approved and an adapter is built, this runbook is the normal way to find new enquiries: inspect the outbox (step 2) and notify the owner manually (step 6). The first production go-live must not happen without a decision on this (owner decisions 16 and 19).

## 1. Confirm the enquiry is stored

Using the reference or the correlation id from the visitor, support or logs (`x-request-id` header, `correlationId` in log lines), run in the Supabase SQL editor or `psql` as an authorised role (the tables deny `anon` and `authenticated`). The reference is `'VIT-' || upper(substr(replace(id::text,'-',''),1,12))`.

```sql
select id, received_at, status, intent, correlation_id
from public.enquiries
where correlation_id = '<correlation id>'
   or upper(substr(replace(id::text,'-',''),1,12)) = upper('<12 hex characters after VIT->')
order by received_at desc;
```

No row means the submission was never accepted (the visitor saw an error, 429 or 503), so a resubmission is legitimate; check logs for `enquiry.*` events with that correlation id.

## 2. Inspect the outbox (identifiers only)

```sql
-- Overview by state
select state, kind, count(*) as n, min(created_at) as oldest
from public.notification_outbox
group by state, kind
order by state, kind;

-- Rows needing attention
select o.id, o.enquiry_id, o.kind, o.state, o.attempts, o.available_at,
       o.locked_until, o.last_error, o.created_at, o.correlation_id
from public.notification_outbox o
where o.state in ('pending', 'processing', 'failed')
order by o.created_at;
```

Reading the states: `pending` waits for a dispatch (or is a scheduled retry when `available_at` is in the future); `processing` is leased by a dispatcher until `locked_until` and is reclaimed after the lease expires (5 minutes); `failed` is a dead letter (attempts exhausted, or a permanent error); `sent` is done. `last_error` holds an error code only, never provider text or enquiry content. Log events: `outbox.retry_scheduled`, `outbox.dead_letter`, `outbox.sent`, `outbox.mark_failed`, `enquiry.misconfigured`.

## 3. Find and fix the cause

| Symptom                                                             | Likely cause                                                                                          | Action                                                                            |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Rows `pending`, dispatch answers 503 `notifications-not-configured` | No notifier (`EMAIL_PROVIDER=none`)                                                                   | Expected today. Notify manually (step 6); the fix is an approved provider adapter |
| Dispatch answers 503 `unavailable`                                  | `OUTBOX_DISPATCH_SECRET` unset, or backend not `supabase`/misconfigured (`enquiry.misconfigured` log) | Check environment variables for the deployment                                    |
| Dispatch answers 401                                                | Wrong or missing Bearer secret                                                                        | Use the secret from the provider store; do not paste it into chat                 |
| Rows `pending` with old `created_at`, no dispatches                 | No scheduler; `after()` best-effort dispatch did not run                                              | Dispatch manually (step 4); owner decision on a scheduler                         |
| Rows `failed` with a provider error code                            | Provider outage, rejected sender, quota, bad recipient                                                | Fix the provider issue, then requeue (step 5)                                     |
| Rows `processing` past `locked_until`                               | A dispatcher crashed                                                                                  | They are reclaimed on the next dispatch; no action beyond dispatching             |

## 4. Dispatch a batch

The endpoint drains one batch (10 rows) per call and returns counts only. Pass the secret from your shell environment; do not print it.

```sh
curl -sS -X POST "https://<site origin>/api/internal/outbox/dispatch" \
  -H "Authorization: Bearer $OUTBOX_DISPATCH_SECRET"
# {"status":"ok","claimed":2,"sent":2,"retried":0,"failed":0}
```

Locally: `OUTBOX_DISPATCH_SECRET=... node tooling/scripts/dispatch-outbox-local.mjs [--url ...] [--watch 30]`. Retries back off 60 s, 120 s, 240 s and so on, capped at one hour; after 5 attempts a row becomes `failed`. Delivery is at-least-once: each message carries `<enquiryId>:<kind>` as its idempotency key so the provider can de-duplicate. Do not run overlapping manual loops against the same rows; claiming uses `FOR UPDATE SKIP LOCKED`, so concurrent runs are safe but wasteful.

## 5. Requeue dead letters

Only after the cause is fixed. This is a data change: owner authorisation required, record who and why.

```sql
update public.notification_outbox
set state = 'pending', attempts = 0, available_at = now(), locked_until = null, last_error = null
where id = '<outbox id>' and state = 'failed';
```

Then dispatch (step 4). Mark a row `sent` by hand only after the provider (or a human) has confirmed delivery:

```sql
update public.notification_outbox
set state = 'sent', sent_at = now(), locked_until = null, last_error = null
where id = '<outbox id>' and state in ('pending', 'failed');
```

## 6. Manual notification when an SLA is at risk

An authorised owner reads the enquiry from `public.enquiries` (columns `name`, `email`, `organisation`, `message`, `role`, `timeframe`, `intent`, `offer_slug`, `received_at`) and tells the responsible person through an approved channel, quoting only the reference. Then mark the outbox row `sent` as above so it is not sent twice, and keep the enquiry `status` honest (`received`, `acknowledged`, `actioned`, `closed`).

## 7. After the incident

- Record the timeline, cause and affected references (no personal data).
- Confirm no enquiry stayed `pending` without a human having seen it.
- If the cause was missing infrastructure (provider, scheduler, alerting), raise it against `docs/delivery/owner-decisions.md`.
- There is no alerting on stuck outbox rows yet; a simple check is the overview query above run on a schedule once an owner is named.
