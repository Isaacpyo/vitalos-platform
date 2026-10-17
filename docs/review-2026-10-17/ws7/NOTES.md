# WS7 notes — Super Admin bugs, identity, Overview, Architecture, Help

Branch `review/ws7-admin`. Decisions: [DECISIONS.md](DECISIONS.md). ADR: [ADR-049](../../adr/ADR-049-superadmin-identity-and-morning-overview.md). Primary owner: [PRIMARY-OWNER.md](PRIMARY-OWNER.md). Public copy: none changed (the admin is not public); see [COPY-CHANGES.md](COPY-CHANGES.md).

## What shipped

- **E2** `config/settings/base.py`: the API description's double-encoded "→" is fixed (and a mojibake "…" in a test). `tests/test_encoding.py` decodes `/api/schema/` as UTF-8 and scans every superadmin text file for mojibake sequences.
- **E3** Posts, roles and applications tables: one primary action (Edit, or Review) in a sticky right-hand column, plus a keyboard-accessible "More" menu (`<details data-row-menu>`, fixed-positioned by `static/js/app.js` so the scroll wrapper never clips it). Archive confirms inside the menu (`partials/row_menu_confirm.html`). CSS in `assets/tailwind.css` (`.col-actions`, `.row-menu-*`).
- **E5** `apps/enquiries/overdue.py`: once per enquiry (`Enquiry.sla_breach_notified_at`, migration `enquiries.0002`) the assignee, or every super admin when unassigned, gets an in-app notification and an email through the existing outbox, following their preferences. Still-overdue enquiries go into the 08:00 digest once a day. Runs from the content tick and `manage.py notify_overdue_enquiries [--digest]`; `send_enquiry_notifications` also runs it. Inbox has an Overdue filter. Smoke-test leftovers: `manage.py notifications_cleanup --purge-smoke-test [--apply]`; `e2e/smoke.py` clears its own bell.
- **E9** Daily sending-domain check (`apps/enquiries/domain.py`, `ResendOutbound.domain_status`, `manage.py check_sending_domain`) writes `domain_status`/`domain_checked_at`; health shows it (ok, warn, or info for log transport; warn when older than 2 days). 80 % email warning: `apps/core/email_usage.py`, once a day, in-app to super admins, counting enquiry, careers, candidate and Relay email. Attachment storage shows as a set-up task with numbered steps (variable names, bucket name, doc section).
- **E6–E8, F3** Required full name; migration `accounts.0004` back-fills and flags; `User.display_label`/`first_name`; `person` template filter; names in enquiry assignee/notes/list, careers reviewer/notes/timeline/role revisions/"who hears about new applications", audit trail sentence and filter, settings (users, tokens, site), email templates lists, Insights author confirmations and editorial checks, sidebar account menu, flash messages. `manage.py link_people [--apply]`. Team page lists users with role, service lines and last sign-in, then team members without an account.
- **F1, F2, E4** Morning Overview (`apps/core/morning.py`, `templates/architecture/home.html`): needs-attention list, Enquiries, Relay, Careers, Insights, Website sync, System health, Website analytics; every count links to its filtered list. Service-line cards only on Service lines. Analytics link-out card plus adapter interface (`apps/core/analytics.py`).
- **F6, E4** `ARCHITECTURE_MODULE_ENABLED` (default true). `manage.py sync_architecture_from_web [--apply]` from `apps/architecture/data/web-architecture.json` (export: `tooling/content/export-architecture.ts`). New field `public_url` on Practice/Solution/Offer (migration `architecture.0004`, additive).
- **F5** Six guides on `/help/` (`apps/core/guides.py`).
- **F7** `manage.py transfer_primary_owner --to <email> [--apply]` and `PRIMARY-OWNER.md`. Nothing executed.

## Migrations (all additive; the deploy guard's pattern list is not hit)

- `accounts.0004_name_needs_review`: AddField + RunPython back-fill.
- `enquiries.0002_sla_breach_notified_at`: AddField.
- `architecture.0004_offering_public_url`: AddField `public_url` on practice, solution, offer and their historical models.

## Follow-ups

- Move every internal enquiry alert email to the shared HTML layout (ADR-030) in one change (W7-10).
- WS6: use `User.first_name` / `display_label` in `apps/relay/client.py:76` and `templates/relay/_thread.html` assignee options (still `full_name|default:email`, which now always has a name).
- Superadmin CI could run `notifications_cleanup --purge-smoke-test --apply` inside the CI container after the smoke test (CI workflows are WS5's).
- Re-run `tooling/content/export-architecture.ts` whenever practices, solutions or offers change on the website; a CI freshness check would catch drift.
- Production one-offs (approval items, not run): `link_people --apply`, `sync_architecture_from_web --apply`, `notifications_cleanup --purge-smoke-test --apply`, `transfer_primary_owner`.
