# ADR 031 Vitalos Relay: website owns conversations, the Super Admin presents them

Status: Accepted (engineering, 15 October 2026). Production enablement pending owner approval (`RELAY_ENABLED`).

## Context

Vitalos Relay is an AI chat assistant on the website with a hand-off to staff. Visitors talk to the website (`apps/web`). Staff answer in the Super Admin, a separate Django application with its own database (ADR-026). Sharing the website database with the Super Admin was rejected in ADR-026 and ADR-029: enquiries reach the Super Admin only as signed webhooks. Relay needs both apps. Visitor traffic, retrieval and the model call belong next to the site. Staff identity, roles, two-factor sign-in, alerts and email preferences already live in the Super Admin.

## Decision

1. **The website owns Relay data.** Conversations, messages, hand-offs, knowledge, gaps, presence, usage, settings and visitor-facing email live in the `relay` schema of the website database. Only server code using the Supabase secret key touches them (RLS on, no anon or authenticated policies). Business rules (status transitions, AI pause, rate limits, retrieval, prompts) are in `@vitalos/relay-core`, server-only.
2. **The Super Admin presents and forwards.** A Django app (`superadmin/apps/relay`) renders the Relay tab (inbox, thread, knowledge, insights, settings) and calls a **signed admin API** on the website (`/api/relay/admin/*`). Each request carries an HMAC-SHA256 over the timestamp, method, path, admin identity and body hash (`RELAY_ADMIN_API_SECRET`), with a 300-second window. The identity header names the authenticated Django user and role. The website trusts it only when the signature is valid.
3. **The website notifies the Super Admin by signed webhook** (`/api/inbound/relay`, `RELAY_WEBHOOK_SECRET`). Events: hand-off requested, visitor replied, reminder, no answer, token cap, FAQ attention and daily digest. The Super Admin turns them into in-app notifications and emails through its existing mailer and shared layout (ADR-030), with per-user preferences and a 10-minute dedupe. Events are idempotent by id.
4. **New Super Admin tables belong to Relay** (`RelayNotification`, `RelayPreference`, `RelayAlertLog`, `RelayInboundEvent`, `RelayInboxState`). They are created with `CreateModel` only, so the automatic deploy guard is not tripped.
5. **Contract** in `docs/relay/API.md`. Each side can be tested alone: the Super Admin against `FakeRelayClient`, the website against signed fixtures.

## Options

- **Django reads and writes the `relay` schema directly** (a second database connection): rejected. It reverses ADR-026/029, duplicates conversation rules in Python, and the Super Admin backups dump only its own `public` schema.
- **A new Next.js admin app**: rejected. It would add a second staff sign-in, role model and audit trail beside the Super Admin.
- **Move Relay storage into the Super Admin database**: rejected. Every visitor message would cross to a 0.25 vCPU container that scales to zero, and the model pipeline would depend on it.

## Consequences

- Admin pages make one server-to-server call per view or action (sub-second within Europe). Realtime pings plus short polling keep the inbox live (ADR-038).
- Two secrets must match across Vercel and Azure. To rotate, set the new value on the website first, accepting both during a window (`RELAY_ADMIN_API_SECRET_PREVIOUS`), then on the Super Admin.
- If the Super Admin is down, visitors still chat and hand off. Alerts arrive once it is back: webhooks retry, reminders fire again, and the inbox is read live from the website.

## Revisit triggers

The Super Admin moves to Entra SSO (the identity header gains the Entra object id); Relay needs staff-side data the website must not hold; volume makes per-view API calls slow.
