# ADR 049 Super Admin identity model and the morning Overview

Status: Accepted (engineering), 17 Oct 2026. Builds on ADR-029 (enquiries and mail console), ADR-039 to ADR-042 (Insights, Careers, content sync and the content tick). Review run: `docs/review-2026-10-17/ws7/`.

## Context

The 17 Oct review found the Super Admin showing email addresses where people expect names (assignees, "who hears about new applications", the audit trail, Relay), a Team page saying "No team members yet" while two users and an author existed, and three records for one person that nothing linked (`User`, `architecture.TeamMember.user`, `insights.Author.admin_user`). `User.full_name` was optional and empty. The Overview showed four enquiry numbers and the service-line cards; an overdue enquiry raised no notification; System health showed fields no code wrote. Decision 7 of the run: one person is one Django user, who may also be a team member and an Insights author, linked by email, with a required display name.

## Decision

1. **One name field.** `User.full_name` is the display name. It is required in every form (create user, edit user, your profile). We did not add a separate `display_name`: two fields meaning the same thing drift apart. The column stays blank-able in the database so the migration is additive (no AlterField, so the deploy guard passes). `User.display_label` (full name, else a name derived from the email) and `User.first_name` are the only accessors templates and integrations use; the `person` template filter takes a user or an email address.
2. **Back-fill, flagged.** Migration `accounts.0004` adds `name_needs_review` and fills empty names from the email local part (`temitope.agbola@…` → "Temitope Agbola"), flagged for review. `UserManager` does the same for new accounts created without a name (for example `create_owner`). Saving the profile, or a super admin saving the user, clears the flag. The account page and the Overview nudge until then.
3. **Linking, never guessing.** `manage.py link_people` (dry run unless `--apply`) links team members to the user with the same email (case-insensitive) and person authors to the user with exactly the same name (authors have no email field). It never overwrites or removes a link; conflicts and unmatched records are reported. The Team page lists users (role, service lines, last sign-in) and then team members without an account.
4. **The Overview is the morning screen.** `apps/core/morning.py` builds sections for Enquiries (the needs-attention list, overdue first, and counts), Relay (waiting now, gaps this week, FAQ entries awaiting confirmation, oldest knowledge sync, read through the existing Relay client with a 3-second timeout and a 60-second cache; "Relay not reachable" when it fails), Careers, Insights, Website sync, System health and Website analytics. Every count links to the list it counts. Sections a user may not open are left out. The service-line cards live only on the Service lines page.
5. **Website analytics is a link-out card plus an adapter interface.** The website uses Vercel Web Analytics (ADR-046), which has no stable public read API. The card links to `ANALYTICS_DASHBOARD_URL`; `apps/core/analytics.py` defines the adapter interface, and a numbers panel appears only when `ANALYTICS_PROVIDER` names a registered adapter and `ANALYTICS_API_KEY` is set. No adapter is registered today.
6. **Alerts run from the content tick.** The tick (ADR-042) now also runs `enquiries.overdue.notify_overdue` (once per enquiry, guarded by `Enquiry.sla_breach_notified_at`: in-app to the assignee, or every super admin when unassigned, and email through the enquiry outbox following the existing preferences), the enquiry email outbox and the 08:00 digest, and the 80 % email-allowance warning (`core.email_usage`, once a day, in-app to super admins). Its daily part also queues still-overdue enquiries into the digest and checks the sending domain through `ResendOutbound.domain_status` (Resend `GET /domains`). New notification kinds are validated in code (`enquiry_overdue`, `system_warning`), like `careers_application`, so no AlterField is needed. The tick's HTTP response keeps its strict contract; the new counts go to `TickState.last_result` only.
7. **Architecture module.** `ARCHITECTURE_MODULE_ENABLED` (default true) hides Service lines, Architecture and the service-line filter, and their pages answer 404, so retiring the module is one toggle. `manage.py sync_architecture_from_web` (dry run unless `--apply`) creates or updates Practices, Solutions and Offers from `apps/architecture/data/web-architecture.json`, which `tooling/content/export-architecture.ts` exports from the website's repo content. Each website practice becomes the Practice of the service line with the same slug (six, with Labs last per decision 1); a solution goes under its first listed practice; an offer under the first solution that lists it. Records get a `public_url`. Nothing is archived or deleted.

## Options considered

- A new `display_name` field next to `full_name`: rejected (two names for one thing).
- Making `full_name` `blank=False` in the model: rejected for now; it is an AlterField the deploy guard stops, and the form-level requirement plus the back-fill give the same result.
- Parsing the TypeScript content files in Python: rejected as fragile (titles come from functions and shared constants). A committed JSON export, regenerated by one command, is simpler and reviewable.
- A Django scheduler or Celery for alerts: rejected; the content tick already runs every minute (opportunistic), from the website cron and from `manage.py content_tick`.
- Calling the Relay API for counts on every page: rejected; only the Overview asks, with a short timeout and a cache.

## Consequences

- Deploying this needs only additive migrations (`accounts.0004`, `enquiries.0002`, `architecture.0004`), so the automatic deploy guard passes.
- On the first tick after deploy, enquiries already past their target (VIT-0001) raise one overdue notification each.
- The 08:00 enquiry digest is now sent by the tick as well as by `send_enquiry_notifications`, so it is delivered even where that job is not scheduled.
- Relay's visitor-facing staff label should use `User.first_name` (WS6 owns `apps/relay/client.py`).
- `web-architecture.json` must be regenerated when practices, solutions or offers change on the website.
