# Screenshots

## Console upgrade (12 Oct 2026): `console/`

Captured from `manage.py runserver` (development settings, SQLite) with seeded architecture data and the sample mail in `tests/fixtures/eml/` ingested, signed in as the primary owner. Every page also passed axe-core (WCAG 2.2 AA tags) with no violations in light and dark (`e2e/a11y.py`, which CI now runs against the production image).

Each page has three variants: `-1440-expanded-light`, `-1440-collapsed-dark` (sidebar icon rail) and `-375-light` (mobile; the sidebar is an off-canvas sheet).

| File prefix    | Shows                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| sign-in        | Sign-in with the reversed wordmark on a Midnight panel                 |
| overview       | KPI cards, needs attention, system status, service lines               |
| enquiries      | Three-pane inbox: views with counts, list, empty thread pane           |
| enquiry-thread | Threaded conversation, bounce and system note, composer, details panel |
| activity       | Activity with the Changes and Audit trail tabs                         |
| audit-trail    | Filterable audit trail with CSV export                                 |
| settings-email | Inbound and outbound status, signature, SLA, retention, canned replies |

## Phase 1 smoke test (10 Oct 2026)

The files below predate the sidebar and show the original top-bar layout.

These were captured by `e2e/smoke.py` (25/25 checks passed; see `smoke-results-local-production-image.json`) on 10 Oct 2026.

They show the **production image** (`config.settings.prod`, gunicorn, PostgreSQL) running locally on `http://localhost:8001`. They are **not** from the live URL, which had not been deployed. All "Smoke test …" records are synthetic, and the test archives them afterwards. The TOTP enrolment page is deliberately left out because it shows a secret.

After the live deploy, the deploy workflow uploads the same set from https://admin.vitalos.co.uk as the `superadmin-live-smoke-screenshots` artifact. Save those in `live/`.

| File                     | Shows                                                         |
| ------------------------ | ------------------------------------------------------------- |
| 01-login                 | Sign-in                                                       |
| 03-homepage              | North-star header and the six service line cards              |
| 04-dashboard-overview    | Service dashboard, Overview tab                               |
| 05-structure             | Practice → Solution → Offer tree after create and edit        |
| 06-projects              | Projects tab with inline status select                        |
| 07-kpis                  | KPI with a recorded value flagged off target                  |
| 08-search                | Live search dropdown in the top bar                           |
| 09-activity              | Activity feed from history                                    |
| 10-history               | Django admin history rows for the created practice            |
| 11-architecture          | Whole-company tree with reorder and retire controls           |
| 12-notifications         | Notifications (KPI breach)                                    |
| 13–15 settings           | Company profile, users and roles, CSV import and export       |
| 16-api-docs              | Swagger UI for `/api/v1/`                                     |
