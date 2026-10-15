# ADR 034 Relay realtime and scheduled jobs

Status: Accepted (engineering, 15 October 2026).

## Context

A visitor waiting for a person, and staff watching the inbox, both need updates within seconds. The Super Admin runs on gunicorn sync workers in a single small container that scales to zero, so long-lived connections there do not fit. Relay also needs reminders every few minutes, a daily digest and a frequent FAQ sync, but Vercel crons on this plan run at most once a day.

## Decision

1. **Ping, then fetch.** The server sends content-free pings (`{type, conversationId?, at}`) through the Supabase Realtime Broadcast HTTP API. Clients then fetch the real data from authorised endpoints.
   - Visitor channel: `relay:v:{channelKey}`, where the key is 32 random bytes.
   - Admin channel: `relay:admins`.

   A spoofed ping is harmless, and no personal data travels on the socket.

2. Clients use a small Phoenix WebSocket client written for Relay, so the browser does not load `supabase-js`. The API returns the publishable key and Realtime URL. CSP `connect-src` gains the Realtime `wss:` origin on the website, and only on the Super Admin's Relay pages.
3. **Polling fallback:**
   - visitor: every 4 s while the panel is open and a person is involved; every 20 s while it is closed after a person joined;
   - admin inbox: every 10 s.
4. **Scheduled jobs run in Supabase** (`pg_cron` + `pg_net`), calling the website's `/api/relay/cron/*` routes with `CRON_SECRET` read from Supabase Vault:
   - reminders every 5 minutes;
   - digest check hourly (it sends at 08:45 Europe/London on working days);
   - FAQ sync every 15 minutes, plus a nightly full run.

   Retention is a SQL function, scheduled nightly once the owner confirms the periods.

## Options

- **Server-Sent Events from the Super Admin**: rejected; they would tie up sync workers on a container that scales to zero.
- **`supabase-js` in the browser**: rejected; it is far larger than the protocol subset Relay needs.
- **Vercel Cron**: rejected; this plan allows daily jobs only.
- **GitHub Actions schedules**: rejected; runs every 5 minutes on a public repository breach the CI frequency rule (AGENTS.md).

## Consequences

The schedules live in a migration and in Vault, not in `vercel.json`. Cron routes are idempotent and safe to call twice.
