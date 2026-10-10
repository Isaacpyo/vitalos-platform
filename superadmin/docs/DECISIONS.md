# Decisions and assumptions: Vitalos Super Admin, Phase 1 and 1.5

The brief asked for autonomous delivery, so every judgement call made without asking is recorded here. Items marked **Confirm** need the founder's sign-off. They are easy to change in the app or in code.

## Repository and process

1. **Location.** The repository had no Python or Django project, so the app is a new top-level `superadmin/` (ADR-016). The brief's paths are read relative to the Django project: `apps/architecture`, `apps/accounts`, `config.settings.prod` and `docs/DEPLOY.md` are `superadmin/apps/…`, `superadmin/config/…` and `superadmin/docs/…`. The repository root `apps/` already holds the Next.js apps. The CI workflow lives at the repository root, `.github/workflows/superadmin.yml`, because GitHub requires it there.
2. **Branch.** `feature/super-admin` was created from `main`, as the brief asked. The session also had a default working branch, which was not used.
3. **Architecture records.** A Python app in a TypeScript-first monorepo is an architecture change. ADR-016 records it, and `ARCHITECTURE.md`, the container and data-ownership diagrams, `README.md` and `stage-status.md` are updated. `superadmin/` is excluded from the Node Prettier gate and uses ruff instead. Dependabot now covers `pip` and `docker` for `/superadmin`, and CODEOWNERS covers `/superadmin/`.
4. **Docs location.** `DEPLOY.md`, `DECISIONS.md`, `PHASE2.md` and `screenshots/` live in `superadmin/docs/`, next to the code they describe.

## Stack and versions

5. **Django 5.2 LTS** (supported to April 2028) satisfies "Django 5.x". Python 3.12. Dependencies are pinned with `uv pip compile` in `requirements*.txt`.
6. **Tailwind v4.1.11 standalone CLI.** The binary is downloaded by `bin/tailwind.sh` and its SHA-256 verified. The CSS is built in Docker and CI and is not committed. The source lives in `assets/tailwind.css`, outside the static tree, so that manifest post-processing works.
7. **HTMX 2** is served from the copy vendored by django-htmx, with no CDN. Attribute inheritance is disabled, so every element states its own target and swap. The history cache is disabled, so page snapshots with possibly confidential data are never written to `localStorage`.
8. **Playwright 1.56** (Python) is pinned so that it uses the same Chromium build (1194) as the monorepo tooling and the build image.
9. **PostgreSQL 17** is used everywhere (Azure, CI, compose). The image's `pg_dump`/`pg_restore` are version 17 (Debian trixie), and pairing them with a 16 server produced a restore warning in testing.
10. **API tokens.** Instead of DRF's single `authtoken`, there is a small `ApiToken` model: several named tokens per user, an expiry, revocation, last-used time, and only a SHA-256 hash stored. The secret is shown once. It is sent as `Authorization: Bearer vsa_…`.
11. **Swagger UI** uses drf-spectacular's split view and sidecar assets, so no inline scripts or CDNs are needed.

## Hosting and deployment

12. **Azure Container Apps, UK South.** It is first in the brief's order. No hosting CLI or MCP was connected in the build session. Cloud credentials present in the build sandbox were not Vitalos's and were deliberately not used. Deployment is therefore an idempotent script, `deploy/azure/deploy.sh`, plus a manual, environment-gated GitHub workflow, `superadmin-deploy.yml`, using Azure OIDC. This is the one remaining step (see DEPLOY.md).
13. **Imperative CLI, not Terraform.** The brief asked for provisioning through the CLI. ADR-012 prefers Terraform, so ADR-016 records this as a single-environment bootstrap exception, and converting it to Terraform is in Phase 2.
14. **Sizing.** PostgreSQL Burstable B1ms with 32 GB. The app runs 1–3 replicas at 0.5 vCPU / 1 GiB, with a minimum of 1 to avoid cold starts at sign-in. **Confirm** cost against the Azure pricing calculator; no figures are quoted here.
15. **Database networking.** Public endpoint, restricted to Azure services (`0.0.0.0` rule), with TLS required (`sslmode=require`) and a generated 32-character password. Private networking (VNet integration and a private endpoint) is a Phase 2 hardening item.
16. **Secrets manager: Azure Key Vault**, with RBAC and purge protection. Containers read secrets through a user-assigned managed identity using Key Vault references. The bootstrap password is the Key Vault secret `bootstrap-admin-password`, given only to the release job as `BOOTSTRAP_ADMIN_PASSWORD`.
17. **DNS: Cloudflare** (ADR-007). A **DNS-only** CNAME (not proxied, to avoid double-CDN and certificate issues) plus the `asuid` TXT verification record, with a free managed certificate from Container Apps. `stage-status.md` notes that Cloudflare nameserver activation was pending, so DEPLOY.md starts by checking which DNS host is authoritative.
18. **Backups.** Azure managed backups with **14-day** retention and point-in-time restore are the primary mechanism. A nightly `pg_dump` job (02:15 UTC) to Azure Files, with 14 daily copies, is a portable secondary. Pruning deletes only expired dump files, never database data.
19. **Release job.** Every deploy runs `bin/release.sh` (migrate, `seed_architecture`, `create_superadmin`) as a one-off Container Apps job *before* the app is switched to the new image.
20. **HSTS.** One year, with `includeSubDomains` (which only affects `*.admin.vitalos.co.uk`). Preload is **not** set, because preload-list submission is a decision for the whole `vitalos.co.uk` domain. Django's `security.W021` warning is therefore silenced in prod settings, and CI runs `check --deploy --fail-level WARNING`.
21. **Health probe.** `/healthz/` answers before host validation, because platform probes use the container IP as the Host header, and it is exempt from the HTTPS redirect.

## Data model

22. **Seed scope.** Section 1 defines the company and six service lines only. **No practices, solutions, offers, KPIs, KPI values, projects, people or decisions were invented.** AGENTS.md forbids fabricated evidence and clients. Dashboards start empty, which is honest.
23. **Seed is create-only.** `seed_architecture` creates missing records and never overwrites edits, because it runs on every release.
24. **Service line taglines, mode mapping, colours and icons are working drafts.** **Confirm** them, then edit in the app:

    | Line             | Tagline (draft)                                        | Modes          |
    | ---------------- | ------------------------------------------------------ | -------------- |
    | Consulting       | Strategy, architecture and transformation advisory.    | ADVISE         |
    | Engineering      | Product, platform and cloud engineering.               | BUILD          |
    | AI & Data        | Data foundations and responsible AI in production.     | ADVISE, BUILD  |
    | Experience       | Service, product and interface design.                 | ADVISE, BUILD  |
    | Managed Services | Run, support and continuously improve live services.   | OPERATE        |
    | Labs             | Ventures, prototypes and new Vitalos products.         | CREATE         |

    Colours are UI accents, not brand assets. Consulting uses Vitalos Blue `#2457FF`. No logo was drawn: the approved Figma mark is not in the repo, so the UI uses the `VITALOS` wordmark in text.
25. **Service line owners** start unassigned. Only Temitope is a known person, and assigning them by default would also make them the recipient of every notification.
26. **Classification is record-level.** Every record has one of Public, Internal, Confidential or Restricted. Defaults: Company is Public, Project is **Confidential** (the brief's "value … classification=Confidential"), and everything else is Internal. Visibility rules:
    - Public and Internal: any user with a role.
    - Confidential: SuperAdmin, plus a ServiceLead who has access to that service line.
    - Restricted: SuperAdmin only.

    The rules apply equally to pages, search, the activity feed, CSV export and the API. Aggregates such as "active project count" are shown to everyone.
27. **Retire versus archive.** *Retire* (`is_active=False`) keeps a service line visible in Architecture but removes it from the homepage. *Archive* hides any record everywhere until it is restored. Archiving does not cascade to children. Hard delete exists only in `/django-admin/`.
28. **Additions to the specified fields:**
    - `KPI.direction` (higher or lower is better) is needed to detect a target breach.
    - `KPI.is_headline` and `order` choose the homepage KPI. Otherwise the first KPI is used.
    - An `order` field on Practice, Solution and Offer.
    - `User.full_name`.
29. **Enumerations.** **Confirm** both:
    - Offering status: Draft / Active / Retired, as specified.
    - Maturity: Emerging / Developing / Established / Leading.
    - Project status: Pipeline / Active / On hold / Completed / Cancelled.
30. **Money** is GBP with no currency field. The time zone is Europe/London and the locale en-GB.
31. **Slugs** are generated from names and are unique within their parent. A service line slug forms its URL, `/s/<slug>/`.
32. **Team members.** A team member can optionally be linked to one login. ServiceLead access comes from owning a line or being linked to it as a team member.
33. **Decisions** can be company-wide (no service line). Only SuperAdmin edits those. Notion links must be `https://*.notion.so` or `notion.site`.

## Roles and security

34. **Roles.** SuperAdmin manages everything. ServiceLead reads all permitted records and edits structure, projects, KPIs and decisions for its own lines. Viewer is read-only. A user with no role is refused (403). A Django superuser always counts as SuperAdmin. Service lines, team membership, users, company profile and CSV import are **SuperAdmin-only**.
35. **TOTP is mandatory for SuperAdmin.** Enrolment happens at first sign-in. Other users can enrol optionally, and once they do it becomes mandatory for them. Until the second factor is complete, the app chrome is not rendered, so no polling requests bounce. `/django-admin/` additionally requires a *verified* Django superuser. A user can replace their authenticator after re-entering their password.
36. **Lockout.** After 5 failed sign-ins for one email and IP, sign-in is locked for 30 minutes (django-axes). The client IP is taken from `X-Forwarded-For`, trusting `TRUSTED_PROXY_COUNT=1` hop (the Container Apps ingress). TOTP verification has its own exponential throttling.
37. **Sessions.** 8-hour absolute lifetime, HTTP-only `Secure` cookies, SameSite Lax, and a 12-character minimum password. Logout is POST-only.
38. **CSP.** Scripts and styles need the per-request nonce or must come from `'self'`. There are no inline handlers or style attributes; colours are drawn with SVG `fill` attributes. Inline styles are allowed only on the Django admin and Swagger UI views, both third-party templates, and scripts stay strict there too.
39. **Logging.** JSON lines carrying `request_id`; incoming `X-Request-ID` values are accepted only if they match `[A-Za-z0-9._-]{8,64}`. Sentry is optional and runs with `send_default_pii=False`.
40. **The API is read-only** and throttled to 600 requests per hour per user. Tokens inherit their user's classification visibility. The schema and docs require a role.

## Features

41. **Search** uses PostgreSQL full-text search (`english` configuration, prefix matching for live typing, weighted name over summary) across all architecture models. It falls back to `icontains` on SQLite. There are no GIN indexes yet, because the data volume is tiny; they are in Phase 2.
42. **The activity feed** merges django-simple-history rows across models, newest first, with field-level diffs and archive/restore detection. Team-member service-line filtering uses *current* membership, because M2M history is not tracked.
43. **CSV.** Each data set has its own file: practices, solutions, offers, projects, KPI values and team members. Rows match on natural keys (slugs, project `id`, KPI name + date, team email or `id`). Every row is validated with the model's own rules. Imports are all-or-nothing, dry-run is the default, and they are SuperAdmin-only. Exports escape spreadsheet formulas, and the escaping is reversed on import, so a round trip changes nothing (tested).
44. **Notifications.**
    - Role assignment notifies the user.
    - A project status change notifies SuperAdmins, the line owner and the project lead's login. The person who made the change is excluded.
    - A KPI target breach, on the recorded value, notifies SuperAdmins and the line owner.
    - The bell polls every 60 seconds. Email delivery is Phase 2.
45. **Smoke-test data.** The live smoke test names its records "Smoke test …" with the client "Synthetic smoke test". It archives them afterwards, keeping the history, and removes the temporary authenticator it enrolled.
46. **Screenshots** in `docs/screenshots/` were captured from the **production image running locally** (prod settings, gunicorn, PostgreSQL), not from the live URL, which was not reachable. The live run uploads its own set as a workflow artifact. The TOTP enrolment screenshot is excluded because it shows a secret.

## Repository CI

47. CodeQL (`analyze`) is red on `main` and on this PR because code scanning is not enabled in the repository settings. This is unrelated to the change and needs a repository-owner setting.
