# Screenshots

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
