# Decisions and assumptions: Vitalos Super Admin, Phase 1 and 1.5

The brief asked for autonomous delivery, so every judgement call made without asking is recorded here. Items marked **Confirm** need the founder's sign-off. They are easy to change in the app or in code.

## Repository and process

1. **Location.** The repository had no Python or Django project, so the app is a new top-level `superadmin/` (ADR-026). The brief's paths are read relative to the Django project: `apps/architecture`, `apps/accounts`, `config.settings.prod` and `docs/DEPLOY.md` are `superadmin/apps/…`, `superadmin/config/…` and `superadmin/docs/…`. The repository root `apps/` already holds the Next.js apps. The CI workflow lives at the repository root, `.github/workflows/superadmin.yml`, because GitHub requires it there.
2. **Branch.** `feature/super-admin` was created from `main`, as the brief asked. The session also had a default working branch, which was not used.
3. **Architecture records.** A Python app in a TypeScript-first monorepo is an architecture change. ADR-026 records it, and `ARCHITECTURE.md`, the container and data-ownership diagrams, `README.md` and `stage-status.md` are updated. `superadmin/` is excluded from the Node Prettier gate and uses ruff instead. Dependabot now covers `pip` and `docker` for `/superadmin`, and CODEOWNERS covers `/superadmin/`.
4. **Docs location.** `DEPLOY.md`, `DECISIONS.md`, `PHASE2.md` and `screenshots/` live in `superadmin/docs/`, next to the code they describe.

## Stack and versions

5. **Django 5.2 LTS** (supported to April 2028) satisfies "Django 5.x". Python 3.12. Dependencies are pinned with `uv pip compile` in `requirements*.txt`.
6. **Tailwind v4.1.11 standalone CLI.** The binary is downloaded by `bin/tailwind.sh` and its SHA-256 verified. The CSS is built in Docker and CI and is not committed. The source lives in `assets/tailwind.css`, outside the static tree, so that manifest post-processing works.
7. **HTMX 2** is served from the copy vendored by django-htmx, with no CDN. Attribute inheritance is disabled, so every element states its own target and swap. The history cache is disabled, so page snapshots with possibly confidential data are never written to `localStorage`.
8. **Playwright 1.56** (Python) is pinned so that it uses the same Chromium build (1194) as the monorepo tooling and the build image.
9. **PostgreSQL versions.**
    - **CI and compose:** PostgreSQL 17, and the image's `pg_dump`/`pg_restore` are version 17.
    - **Production:** whatever the provider runs. Supabase projects run 15 (newer projects 17); create a Neon project on 17. Django 5.2 supports 14 and later. On 11 Oct 2026 the full test suite (110 tests) passed against Supabase's own PostgreSQL 15 image, connected as its non-superuser `postgres` role.
    - **Backups:** a dump from a newer client can carry settings an older server rejects; a 17 client against a 16 server produced a `transaction_timeout` error on restore in testing. So the backup workflow reads the server's version and dumps with the matching `postgres:<major>` client (#19).
10. **API tokens.** Instead of DRF's single `authtoken`, there is a small `ApiToken` model: several named tokens per user, an expiry, revocation, last-used time, and only a SHA-256 hash stored. The secret is shown once. It is sent as `Authorization: Bearer vsa_…`.
11. **Swagger UI** uses drf-spectacular's split view and sidecar assets, so no inline scripts or CDNs are needed.

## Hosting and deployment (amended 11 Oct 2026 for zero monthly cost)

12. **Azure Container Apps, UK South, at £0/month.** Temitope asked for zero monthly cost and pre-approved this change. The app runs on the Container Apps consumption plan inside the permanent free grant. PostgreSQL is a free tier, **Supabase by default or Neon** (#15), the image is a public ghcr.io package, and DNS and TLS are Cloudflare free plus an Azure managed certificate. This replaces Key Vault, Azure Container Registry, Azure Database for PostgreSQL and the Azure Files backup job, which together would cost money every month.
    - No hosting CLI or MCP was connected in the build session, and the build sandbox's cloud credentials were not Vitalos's, so they were not used.
    - Deployment is an idempotent script, `deploy/azure/deploy.sh` (`--dry-run` prints the plan), run by the manual, environment-gated `Super Admin deploy` workflow.
    - The workflow logs in with Azure OIDC, so no Azure keys are stored. The OIDC identity has only **Contributor on `rg-vitalos-superadmin`**.
    - The subscription Owner creates the resource group, Log Analytics workspace and environment once (DEPLOY.md §2.1).
13. **Imperative CLI, not Terraform.** The brief asked for provisioning through the CLI. ADR-012 prefers Terraform, so ADR-026 records this as a single-environment bootstrap exception, and converting it to Terraform is in Phase 2.
14. **Sizing and the free grant.**
    - **Shape:** a consumption-only environment (no workload profiles). One app at **0.25 vCPU / 0.5 GiB, min replicas 0, max replicas 1**, scaling on HTTP concurrency 50, with gunicorn at `WEB_CONCURRENCY=2` to fit 0.5 GiB.
    - **Free grant:** 180,000 vCPU-s, 360,000 GiB-s and 2 million requests per subscription per month. That covers about 200 hours of a running replica, because 180,000 / 0.25 = 360,000 / 0.5 = 720,000 s.
    - **Release job:** its runs last seconds and draw on the same grant.
    - **Assumptions:** the grant is shared by everything in the subscription. Nothing else in that subscription uses Container Apps; if something does, the £1 budget alert in DEPLOY.md is the tripwire.
    - **Trade-off: cold starts.** After about 5 idle minutes, the first request waits for a replica to start, which can include pulling the image (about 95 MB compressed), and on Neon the database wakes too. Expect a few seconds, occasionally more. That is acceptable for an internal tool, and later requests are fast.
    - **Single replica:** a deploy briefly swaps revisions. There is no high availability; Phase 2 covers paid tiers.
15. **Database: Supabase free plan by default, or Neon free plan** (both London, AWS eu-west-2; UK data residency). On 11 Oct 2026 Temitope chose Supabase, so DEPLOY.md documents it as the default. Neon stays a supported alternative, and nothing in the app depends on which is used.
    - **A dedicated Supabase project, never the website's.** ADR-026 rejected sharing the web app's Supabase, to keep internal governance data and access models separate. Supabase's free plan allows 2 active projects per organisation, and the website already uses one, so this is the second (assumption: no other free project exists in that organisation).
    - **Connection:** `DATABASE_URL` is held as a GitHub `production` environment secret, re-applied on every deploy (so rotating it means updating that secret and redeploying), and passed to the containers as a secret. It always carries `sslmode=require`, which `deploy.sh` checks.
      - **Supabase:** the **session pooler** string from **Connect → Session pooler** (port 5432, user `postgres.<project-ref>`).
      - **Neon:** the **pooled** string.
    - **Why Supabase's session pooler:** Supabase's direct host (`db.<project-ref>.supabase.co`) is **IPv6-only**, and neither Container Apps nor GitHub-hosted runners have IPv6 egress, so it is unreachable from both. `deploy.sh` refuses that host with a pointer to DEPLOY.md §2.3. The session pooler is reachable over IPv4, keeps one server connection per client connection, and supports `pg_dump`, so the app, the release job and the backup all use it.
    - **Settings are unchanged** from the Neon design, as instructed: `CONN_MAX_AGE=0`, `CONN_HEALTH_CHECKS=True` and `DISABLE_SERVER_SIDE_CURSORS=True`.
      - With Neon, these suit its 5-minute autosuspend and PgBouncer's transaction mode, which cannot hold cursors.
      - With Supabase's session pooler, they are conservative but correct: one short-lived pooled connection per request, and no reliance on cursors.
    - **Release job:** `bin/release.sh` runs `migrate`, `seed_architecture` and `create_superadmin` as a one-off Container Apps job *before* the app gets the new image. Each step is retried 3 times with 5 s and 15 s backoff, to cover a slow or refused first connection, such as a Neon cold start.
    - **Bootstrap account:** `create_superadmin` only creates a missing account. It never re-activates, re-promotes or changes an existing one; `--password` resets only the password.
    - **Access and limits:** the app uses the project's owner role (Supabase `postgres`, Neon `neondb_owner`) over TLS with a generated password. A least-privilege application role is a Phase 2 item, and IP allow-listing is not used on the free plans (assumption).
      - **Supabase free:** 500 MB of database.
      - **Neon free:** 0.5 GB and a monthly compute allowance.
      - The app needs at most about 4 connections at once: 2 gunicorn workers on one replica, the release job and the backup.
    - **Supabase inactivity pause.** Free Supabase projects are paused after **7 days without activity**. The nightly backup connects every day, which keeps the project active. This assumes Supabase counts a daily database connection as activity. If backups stop (Actions minutes, #51), the project can pause and the app fails until it is restored from the dashboard. The data is kept while it is paused. The uptime-monitor ban (#21) still holds.
    - **Supabase Data API lock-down (security).** Supabase's default privileges grant `anon`, `authenticated` and `service_role` full read and write on every new table in `public`, with row-level security off. Supabase exposes those roles through its Data API (PostgREST/GraphQL), and the `anon` key is public by design.
      - **Tested on Supabase's PostgreSQL 15 image:** after migrating, `anon` had `SELECT`, `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` on `accounts_user`, which holds password hashes, and on the TOTP device table.
      - **Fix:** the app never uses Supabase's APIs, so DEPLOY.md §2.3 has Temitope disable the Data API when creating the project, and run a REVOKE script (including default privileges) before the first deploy.
      - **Verified:** after the script, `anon`, `authenticated` and `service_role` have no access to the app's tables, including tables that later migrations create. The app, migrations and backup keep working.
      - This is not optional: skipping it would expose the user table to anyone holding the project URL and its public key.
16. **Secrets: Container Apps secrets** (no Key Vault).
    - **Where they live:** `django-secret-key`, `database-url`, `bootstrap-admin-password` (plus `sentry-dsn` if set) are secrets on both the app and the release job, referenced with `secretref:`. No registry credential is stored: the image is public (#17).
    - **Generation:** the workflow generates the secret key and bootstrap password with `openssl rand`, masks them, and writes them only into Container Apps secrets. A redeploy reads back and keeps the existing values (tested with a stubbed `az`), so sessions and the bootstrap password survive.
    - **Bootstrap password:** the app container does not receive it as an environment variable. It is stored on the app only so Temitope can retrieve it once (DEPLOY.md §3), and should be changed in the app after first sign-in.
    - **Who can read them:** anyone with Contributor on the resource group can read these secrets. Keep that role to the founder and the deploy identity.
17. **Registry: GitHub Container Registry, public package `vitalos-platform/superadmin`, no pull token.** Temitope instructed this on 11 Oct 2026; it replaces the earlier default of a private package with a pull PAT.
    - **Push and pull:** the workflow pushes `ghcr.io/<owner>/vitalos-platform/superadmin:<sha>` with `GITHUB_TOKEN` (`docker/build-push-action`). Container Apps pulls anonymously, so there is no `GHCR_PULL_TOKEN`, no registry credential on the app or job, and no PAT to expire. On an existing app or job, `deploy.sh` removes any ghcr.io registry credential left from the PAT setup.
    - **Visibility is a one-time manual step.** GitHub creates every new package as private, and its REST API can't change package visibility. Temitope sets it to Public in the package settings after the first build (DEPLOY.md, "What Temitope does once", step 6). Before any Azure call, `deploy.sh` checks that the image can be pulled anonymously, using a ghcr.io anonymous token and a manifest `HEAD`. If not, it stops with the settings link, so a private package fails early and clearly rather than as a stuck revision.
    - **What public means:** anyone can pull the image and read the Super Admin's application code; nothing else becomes public, and the repository stays private. The image holds **no secrets or data**. The secret key, database URL and bootstrap password are injected at runtime from Container Apps secrets, and `.dockerignore` excludes `.env*` (except `.env.example`), `.dev_secret_key`, SQLite files, tests and docs. A scan of the built image on 11 Oct 2026 found no `.env`, key, SQLite or private-key files; the only `.pem` files are the public CA bundles from certifi. Security does not depend on the code being private: authentication, TOTP, CSP and server-side authorisation hold either way.
    - **Cost:** public packages have free storage and transfer, so the earlier private-pull limit of 1 GB/month (about 10 cold starts) no longer applies. Only the 3 newest versions are kept (`actions/delete-package-versions`), with provenance attestations off, to keep the package list tidy.
18. **DNS and TLS: Cloudflare free** (ADR-007) **and an Azure managed certificate** (free).
    - **Records:** the workflow writes a **DNS-only (grey cloud)** CNAME `admin` to the app FQDN, plus the `asuid.admin` TXT verification record, then runs `hostname add` and `hostname bind --validation-method CNAME`.
    - **Safety:** it never silently replaces a record that points elsewhere (`DNS_OVERWRITE=1` to force). Without `CLOUDFLARE_API_TOKEN` it prints the two records, writes `bound=false` and stops before binding, so the run succeeds and can be resumed.
    - **Orange cloud:** turning on the Cloudflare proxy is optional hardening (DEPLOY.md §4). It needs SSL mode **Full (strict)** and `TRUSTED_PROXY_COUNT=2`. Azure renews managed certificates only while the CNAME is visible, so set the record back to grey around renewal, or use a Cloudflare Origin CA certificate instead.
    - **Nameservers:** `stage-status.md` notes that Cloudflare nameserver activation was pending, so DEPLOY.md starts by checking which DNS host is authoritative.
19. **Backups: a daily GitHub Actions dump, plus Neon history when on Neon.**
    - **Supabase free has no automatic backups** (no scheduled backups or point-in-time recovery), so **the Actions dump is the only backup**. DEPLOY.md recommends `BACKUP_PASSPHRASE`, watching the run history, and an occasional copy kept outside GitHub. Paid Supabase plans add daily backups (PHASE2.md).
    - **Neon:** point-in-time restore over its free-plan history window (6 hours at the time of writing), plus the dump.
    - **Daily dump:** `.github/workflows/backup.yml` runs at 02:00 UTC and uploads a gzipped plain dump as a workflow artifact kept **14 days** (free). The artifact name ends in `-pg<major>`.
      - **Connection:** `pg_dump` needs a session. On Supabase it uses the session pooler string as is. On Neon it switches to the direct (non-pooler) host.
      - **Client version:** it reads the server's version and dumps with the matching `postgres:<major>` client (#9), so the dump restores on that version.
      - **`--schema=public` only:** the app keeps all its tables in `public`. On Supabase, a whole-database dump as `backup_reader` fails on Supabase's own schemas (`permission denied for schema auth`, tested). Even as `postgres`, it would carry platform tables (`auth`, `storage`) that must not be restored over a new project's own.
      - **Restore:** `CREATE SCHEMA public;` is filtered out, because the schema already exists in a new database (DEPLOY.md §6).
      - **Verified on Supabase's 15 image and on PostgreSQL 17:** both dumped and restored into a fresh database with no pending migrations.
    - **`backup` environment:** the workflow uses an environment named `backup` with **no required reviewers**. Placing it in `production` would hold every scheduled run for approval. It needs its own `DATABASE_URL`, ideally the read-only `backup_reader` role, and, recommended, `BACKUP_PASSPHRASE` for AES-256 encryption. Artifacts are otherwise readable by anyone with read access to the repository.
      - The exact `backup_reader` SQL is in DEPLOY.md §6.1. It was verified on Supabase's PostgreSQL 15 image as the non-superuser `postgres`, and on PostgreSQL 17 set up like Neon.
      - On Supabase, the pooler user name is `backup_reader.<project-ref>`. That format is untested without an account; the first manual backup run checks it.
    - **Schedule:** scheduled runs start only once the workflow is on `main`. Each run takes about 1–2 Actions minutes. On Supabase, the run also keeps the project from being paused (#15).
    - **`bin/backup.sh`** stays as a portable manual tool, and CI still exercises it. It also dumps only `public` now, for the same reason.
20. **HSTS.** One year, with `includeSubDomains` (which only affects `*.admin.vitalos.co.uk`). Preload is **not** set, because preload-list submission is a decision for the whole `vitalos.co.uk` domain. Django's `security.W021` warning is therefore silenced in prod settings, and CI runs `check --deploy --fail-level WARNING`.
21. **Health probe.** `/healthz/` answers before host validation, because platform probes use the container IP as the Host header, and it is exempt from the HTTPS redirect. It touches the database, so an external uptime monitor would keep the app (and Neon) awake and use up the free grants. Don't add one; the platform's default TCP probes do not touch the database. On Supabase, the nightly backup already prevents the inactivity pause (#15).

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

    The rules apply equally to pages, search, the activity feed (both the row's classification then and the record's classification now), related names in history and CSV, the company profile, CSV export and the API. Aggregates such as "active project count" are deliberately shown to everyone.

    Edit rights need both line access and read access: a ServiceLead cannot create, edit, archive or restore a Restricted record, even in their own line.
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

34. **Roles.** SuperAdmin manages everything. A Django superuser's role cannot be changed in the app; remove the superuser flag in Django admin first. ServiceLead reads all permitted records and edits structure, projects, KPIs and decisions for its own lines. Viewer is read-only. A user with no role is refused (403). A Django superuser always counts as SuperAdmin. Service lines, team membership, users, company profile and CSV import are **SuperAdmin-only**.
35. **TOTP is mandatory for SuperAdmin.** Enrolment happens at first sign-in. Other users can enrol optionally, and once they do it becomes mandatory for them. Until the second factor is complete, the app chrome is not rendered, so no polling requests bounce. `/django-admin/` additionally requires a *verified* Django superuser. A user can replace their authenticator after re-entering their password.
36. **Lockout.** After 5 failed sign-ins for one email and IP, sign-in is locked for 30 minutes (django-axes). Locking by email alone would let anyone lock the founder out; distributed guessing is mitigated by mandatory TOTP for SuperAdmin and the 12-character minimum password. The client IP is taken from `X-Forwarded-For`, trusting `TRUSTED_PROXY_COUNT=1` hop (the Container Apps ingress). TOTP verification has its own exponential throttling.
37. **Sessions.** 8-hour absolute lifetime, HTTP-only `Secure` cookies, SameSite Lax, and a 12-character minimum password. Logout is POST-only.
38. **CSP.** Scripts and styles need the per-request nonce or must come from `'self'`. There are no inline handlers or style attributes; colours are drawn with SVG `fill` attributes. Inline styles are allowed only on the Django admin and Swagger UI views, both third-party templates, and scripts stay strict there too.
39. **Logging.** JSON lines carrying `request_id`; incoming `X-Request-ID` values are accepted only if they match `[A-Za-z0-9._-]{8,64}`. Sentry is optional and runs with `send_default_pii=False`.
40. **The API is read-only** and throttled to 600 requests per hour per user. Tokens inherit their user's classification visibility. The schema and docs require a role.

## Features

41. **Search** uses PostgreSQL full-text search (`english` configuration, prefix matching for live typing, weighted name over summary) across all architecture models. It falls back to `icontains` on SQLite. There are no GIN indexes yet, because the data volume is tiny; they are in Phase 2.
42. **The activity feed** merges django-simple-history rows across models, newest first, with field-level diffs and archive/restore detection. Team-member service-line filtering uses *current* membership, because M2M history is not tracked.
43. **CSV.** Each data set has its own file: practices, solutions, offers, projects, KPI values and team members. Rows match on natural keys (slugs, project `id`, KPI name + date, team email or `id`). A project row without an `id` creates a new project. A blank classification keeps the record's current classification. A file without an `is_archived` column leaves archive state untouched. Every row is validated with the model's own rules. Imports are all-or-nothing, dry-run is the default, and they are SuperAdmin-only. Exports escape spreadsheet formulas, and the escaping is reversed on import, so a round trip changes nothing (tested).
44. **Notifications.**
    - Role assignment notifies the user.
    - A project status change notifies SuperAdmins, the line owner and the project lead's login. The person who made the change is excluded.
    - A KPI target breach, on the recorded value, notifies SuperAdmins and the line owner.
    - The bell polls every 60 seconds. Email delivery is Phase 2.
45. **Smoke-test data.** The brief requires creating records on the live site. The live smoke test is opt-in and meant for the first deploy only. It names its records "Smoke test …" with the client "Synthetic smoke test", archives them afterwards (keeping the history), and removes the temporary authenticator it enrolled. Once a real authenticator exists, it skips itself.
46. **Screenshots** in `docs/screenshots/` were captured from the **production image running locally** (prod settings, gunicorn, PostgreSQL), not from the live URL, which was not reachable. The live run uploads its own set as a workflow artifact. The TOTP enrolment screenshot is excluded because it shows a secret.

## Repository CI

47. **Independent review.** A read-only reviewer agent reviewed the PR. Its authorisation, CSV, activity, DNS and bootstrap findings were fixed with regression tests. Its database-networking finding is now superseded by the move to Neon; the least-privilege database role remains in #15 and Phase 2.
48. **CodeQL is disabled until code scanning is turned on.** The `analyze` job in `.github/workflows/codeql.yml` failed on every push and PR, on `main` too, because code scanning is not enabled in the repository settings. Each failure also used about 3 Actions minutes (#51). On Temitope's instruction (11 Oct 2026) the job is disabled with `if: vars.CODEQL_ENABLED == 'true'`, so it reports as skipped rather than failing. The repository variable is unset, so the condition is false. This is the `if: false` approach: `actionlint` rejects a literal `if: false` as a constant condition, and a skipped job still satisfies a required status check, whereas renaming the file to `.disabled` would leave a required check missing. The workflow file is kept so its history and configuration remain.
    - **Re-enable** once code scanning is on (**Settings → Code security → Code scanning**, which needs GitHub Advanced Security for a private repository): add the repository variable `CODEQL_ENABLED` = `true` (**Settings → Secrets and variables → Actions → Variables**), or delete the `if:` line, and check that the first run uploads results. Until then nothing scans the JavaScript/TypeScript code. Python in `superadmin/` is still checked by `bandit`, `pip-audit` and `ruff` in the Super Admin CI.

## Zero-cost amendment (11 Oct 2026)

49. **Workflow shape.** `Super Admin deploy` keeps the `DEPLOY` confirmation, the smoke-test toggle and the `production` environment gate, and runs as plan → build → deploy:
    - **plan:** `deploy.sh --dry-run`, which lists every resource with the expected cost **£0.00** and the free-grant assumptions. It needs no secrets.
    - **build:** pushes `ghcr.io/<owner>/vitalos-platform/superadmin:<sha>` (a public package, #17). This runs before the approval gate; pushing an image changes nothing in production.
    - **deploy:** behind the `production` gate.
50. **File names.** The backup workflow is `.github/workflows/backup.yml`, as requested, with the display name "Super Admin backup", because the monorepo has other apps.
51. **GitHub Actions minutes are a shared, finite quota (found 11 Oct 2026).** On this PR's final push, GitHub refused to start a CI job: "recent account payments have failed or your spending limit needs to be increased". The account's included private-repository Actions minutes (2,000/month on GitHub Free) or its spending limit were exhausted. The deploy and backup workflows draw on the same quota, so while it is exhausted:
    - deploys cannot run;
    - **daily backups silently stop**. On Supabase that leaves no backup at all, and after 7 days the project can be paused (#15). On Neon it leaves only the 6-hour history.

    To keep £0 hosting dependable, either cut CI usage or accept a small Actions spending limit. The always-failing CodeQL job is now disabled (#48), which saves about 3 minutes per push. CI usage is also kept down by running the container smoke job only when `superadmin/` changes (it already does). **Confirm** which. Check usage under **GitHub → Settings → Billing → Actions**.
52. **Verification limits.** No Azure, Supabase, Neon or Cloudflare credentials were available in the build session either time, so the real deploy has still not run. The script was exercised with a stubbed `az` (first deploy, redeploy, Actions masking and the no-Cloudflare resumable stop), and `shellcheck` and `actionlint` are clean. Every Azure CLI flag was checked against `az` 2.91. Locally, the production image passed the 25-check browser smoke test inside the free-grant shape (container limited to 0.25 vCPU / 512 MB, using about 150 MiB with 2 gunicorn workers), with the Neon-oriented DB settings. The backup workflow's script produced a gzipped and encrypted dump, which decrypted and restored into PostgreSQL 17 (6 service lines and their history).
53. **Supabase as the documented default (11 Oct 2026).** Temitope chose Supabase's free plan: London, session pooler on port 5432, `sslmode=require`. DEPLOY.md, this file, PHASE2.md, ADR-026 and the PR now say "Supabase or Neon", with Supabase as the default. Retry and health-check settings are unchanged (#15).
    - **Code changes:** only what Supabase requires.
      - `backup.yml` dumps only `public`, with a client matching the server's version.
      - `bin/backup.sh` also dumps only `public`.
      - `deploy.sh` refuses Supabase's IPv6-only direct host.
      - Comments and plan text say "Supabase or Neon".
    - **Tested locally against Supabase's own image (`supabase/postgres:15.19.0.004`):**
      - the test suite;
      - the `backup_reader` SQL;
      - the Data API lock-down;
      - the backup workflow step itself;
      - a restore into a fresh Supabase database.
    - **Not testable without a Supabase account:**
      - the dashboard steps;
      - the pooler's `<role>.<project-ref>` user name;
      - the IPv4 reachability of the session pooler from Container Apps;
      - how Supabase measures inactivity.

      The first deploy and the first manual backup run check the first three.

## What was set up on 11 Oct 2026

54. **Azure subscription.** The deploy uses the personal **"Azure subscription 1"**, a free trial whose credit expires on **10 Nov 2026**. It must be upgraded to **Pay-As-You-Go before then**, or the subscription is disabled and the app stops; within the free grant the upgrade still costs £0. Moving the subscription to the Vitalos Entra tenant is a Phase 2 item (PHASE2.md).
55. **GitHub environment.** The workflow's `environment: production` resolves to the existing **`Production`** environment that Vercel created, because GitHub matches environment names case-insensitively. No second environment was created. The Azure app `github-vitalos-superadmin-deploy` has federated credentials for both `environment:production` and `environment:Production`, so the token's `subject` claim matches whichever spelling it carries.
56. **No approval pause.** Required reviewers aren't available for environments in this private repository on its current GitHub plan, so the deploy job doesn't wait for approval. On the first run the public-image check is what stops it: run the deploy, let it stop at the check, set the package to Public, then **Re-run failed jobs** (DEPLOY.md step 6). The typed `DEPLOY` confirmation and the manual-only trigger remain the guard against accidental deploys.
57. **Database.** Supabase project **`vitalos-superadmin`** (ref `uhvcjsnuxdthjfainvmm`), region London, **PostgreSQL 17.11**. The Data API was disabled at creation, the Data API lock-down SQL (DEPLOY.md §2.3) was applied, and `backup_reader` was created (§6.1) and verified.
58. **ADR renumbered.** The Super Admin ADR was ADR-016 on this branch, but `main` had since accepted ADR-016 for styling, design tokens and typography (reserved in `docs/delivery/stage-1-plan.md`). When `main` was merged into this branch it became **ADR-026**, the next free number, with its text unchanged. References in this file now say ADR-026.
59. **CodeQL runs again (supersedes #48).** While this PR was open, `main` fixed CodeQL in #20: the `analyze` job no longer uploads, keeps its results in the run as an artifact, and fails on error or warning findings (ADR-014 amendment). It now passes on `main`. Keeping #48's `CODEQL_ENABLED` guard would have switched that working gate off on merge, so the guard was removed when `main` was merged into this branch. The job costs about 3-5 Actions minutes per push (#51); turning it off again to save minutes would be an owner decision, because `docs/delivery/stage-status.md` counts it under G8.
60. **OIDC subject corrected (supersedes the subjects in #55).** The first deploy on 11 Oct 2026 failed at the Azure sign-in with AADSTS700213. The repository uses GitHub's immutable subject format (`use_immutable_subject: true`), so the token's subject is `repo:Isaacpyo@54102915/vitalos-platform@1372649383:environment:production`: owner and repository IDs after the names, and the environment as the workflow spells it, in lowercase. Neither credential from #55 could match. A credential with that subject (`github-production-immutable`) was added; its first version ended in a pasted newline and was rejected until that was removed. DEPLOY.md §2.1 now creates only this credential. The two `repo:Isaacpyo/vitalos-platform:…` credentials are never used and can be deleted.
61. **First deploy: unescaped database password (11 Oct 2026).** With sign-in fixed, the release job failed: the `DATABASE_URL` password contained unescaped URL-reserved characters, so Django read part of it, plus the host, as the database name and refused it as longer than 63 characters. That error message wrote a fragment of the password to Log Analytics, so the password of whichever database that string named (see #62) is to be rotated. `deploy.sh` now rejects a `DATABASE_URL` whose password moves part of it into the path or host, without printing the URL, so this fails in the GitHub job instead of inside Azure.
62. **`SUPERADMIN_DATABASE_URL`, not `DATABASE_URL` (11 Oct 2026).** The `Production` environment is shared with the website and already held a `DATABASE_URL` for the website's database, which the deploy then read. The first release job would have run the Super Admin's migrations against the wrong database; it stopped while parsing the URL, before connecting (#61). The deploy workflow now reads `SUPERADMIN_DATABASE_URL`, so the two can't be confused. The `backup` environment is used only by the Super Admin and keeps `DATABASE_URL`.

## Enquiries, mail and console upgrade (12 Oct 2026)

Design: [ADR-029](../../docs/adr/ADR-029-superadmin-enquiries-mail-console.md) (Proposed). Operator steps: [email-setup.md](email-setup.md).

63. **Sidebar and information architecture.** The Overview is at `/`. The service line cards moved to `/service-lines/`. There is no `hx-boost`: full page loads with cookie-rendered state (sidebar collapsed or open) avoid a flash of the wrong layout and keep the Content-Security-Policy simple. Tailwind is hand-rolled rather than Basecoat: the Tailwind CLI is standalone with no npm in this project, and the CSP forbids inline styles, which Basecoat's JavaScript needs.
64. **Brand assets.** The reversed wordmark and the colour symbol come from the supplied PNGs in `apps/web/app/assets/`, only trimmed and resized, not redrawn. The favicon comes from the Midnight app tile. No pure-white monochrome mark exists, so none is shown; a one-colour mark needs a supplied asset.
65. **Palette scoped to the Super Admin.** Midnight `#0B1320`, Cobalt `#2F6BFF` / `#2458E6` / `#7FA3FF`, Mineral `#18B7A0` / `#0E7C6B` / `#3FD0BA`, with Manrope, Inter and JetBrains Mono self-hosted. `packages/design-tokens` for the website still holds `#2457FF` and `#081A2A` pending the owner decision in `docs/brand/token-reconciliation.md`; the website is not changed.
66. **Primary owner model.** One primary owner, `PRIMARY_OWNER_EMAIL` (`admin@vitalos.co.uk`), created by `create_owner` on release with no password. Only the owner grants or revokes SuperAdmin. The owner cannot be demoted or deactivated. Existing SuperAdmins are kept. There is no `SUPER_ADMIN_EMAILS` list and no `APP_ENV`: SuperAdmins are managed in the app and the existing `APP_ENVIRONMENT` stays.
67. **One-time set-password links.** `issue_setup_link --email admin@vitalos.co.uk` prints a single-use link valid for 30 minutes to the terminal only, so the owner never depends on mail being set up first.
68. **Forgot password only when mail can be delivered.** The option appears when `EMAIL_TRANSPORT` is not `log` (or in development), so a user is never told a link was sent when none was. `PASSWORD_RESET_ENABLED` overrides it.
69. **Sign-in pre-fill is off by default.** `DEFAULT_SIGNIN_EMAIL` is empty because pre-filling a public page reveals who signs in. A remembered-email cookie is used instead.
70. **Append-only audit trail** in `apps/audit`, viewed at `/audit/`. Rows are never edited or deleted through the app.
71. **Enquiries access** is limited to SuperAdmin and ServiceLead.
72. **Enquiry message HTML** is shown in a sandboxed iframe with its own Content-Security-Policy. Remote images load only on request.
73. **Attachments are not stored without object storage.** With no `OBJECT_STORAGE_*` settings the message text is kept and attachment names and sizes are listed. With a private S3-compatible bucket (for example Cloudflare R2) they are stored.
74. **New dependencies:** `nh3` (HTML sanitising) and `django-storages[s3]` (attachment storage). The lockfiles are compiled with `--python-platform linux` so they match the Linux image.
75. **Passkeys deferred.** TOTP is already mandatory for SuperAdmin. `django-otp-webauthn` is the suggested package later.
76. **Entra OIDC remains Phase 2 item 1** ([PHASE2.md](PHASE2.md)); nothing in this upgrade replaces it.
77. **Mail design.** Inbound is a Cloudflare Email Worker (primary), with Resend Inbound on a subdomain as the fallback and Microsoft Graph later, all behind a `MailProvider` interface. Outbound is Resend. `EMAIL_TRANSPORT` defaults to `log`, so nothing is sent until a person turns it on. See ADR-029.

## Email templates (12 Oct 2026)

78. **Mail is a dropdown.** The sidebar's Mail item groups Enquiries (unchanged, SuperAdmin and ServiceLead) and Email templates (SuperAdmin only). `NavItem` gained `children`, each with its own permission; the dropdown shows when any child is visible, and the collapsed rail shows the children as icons. Every view still enforces its role on the server (`role_required(SUPERADMIN)` plus a service-level check).
79. **One layout for every email (ADR-030).** Templates render with `apps/mailer/layout.py`, a Python mirror of `@vitalos/email-layout`. It reads the generated `email-layout/email-layout.json` and must reproduce the golden fixtures in `email-layout/fixtures` byte for byte (`tests/test_email_layout.py`).
80. **Inline images, not hosted ones.** The logo and social icons are CID attachments. `apps/mailer/messages.build_message` builds multipart/related mail, and the Resend backend now sends `content_id` for inline images. Nothing is fetched from a third-party host.
81. **Footer facts live in Settings > Company.** New fields: legal name, company number, registered office, website, support email, and LinkedIn, X, Instagram and Facebook URLs (https only). A data migration fills blank fields with the owner-published facts; a missing fact shows a placeholder such as `[Company number]`.
82. **Templates are seeded as Draft.** `manage.py seed_email_templates` (run by `bin/release.sh`) creates any of the 81 seed templates in `apps/email_templates/seed/*.json` that do not exist yet and never changes an existing one. The owner reviews the wording and sets a template to Active.
83. **Versions on every content save; archive instead of delete.** Each save that changes content bumps the version and writes an immutable snapshot. Restoring a version saves it again as the newest version. There is no delete in the app.
84. **Send test goes only to the signed-in admin**, and only when that address ends in `@vitalos.co.uk`. It sends the saved version with sample data, at most 10 an hour per admin, and is audited. With `EMAIL_TRANSPORT=log` nothing leaves the process.
85. **Unsubscribe is real.** Outreach and marketing templates must have a reason-for-contact line; their footer links to `/mail/unsubscribe/<signed token>/`. A GET shows a confirm button; a POST (including RFC 8058 one-click, which is CSRF-exempt because the signed token is the check) adds the address to `EmailSuppression`. Sends of those kinds carry `List-Unsubscribe` and `List-Unsubscribe-Post`. The audit trail records the event without the address.
86. **Merge variables have fallbacks.** `apps/email_templates/variables.py` lists every variable with a description and a fallback. Unknown names are left as written and reported; known names with no value use the fallback, which the preview lists.
87. **Preview data is real.** The preview uses the newest non-anonymised, non-spam enquiry as the recipient and the signed-in admin (name and team role title) as the sender. The preview iframe is sandboxed with its own Content-Security-Policy (no scripts; inline styles and data: images only).
88. **The enquiry notification is mirrored, not driven, by the library.** `enquiry-received` is marked "Sent by the website": the website renders it from code on the same layout, so editing the library copy does not change what the website sends.
89. **Repository made public; OIDC subject moved (13 Oct 2026, supersedes the subject in #60).** The source moved to a new public repository created from rewritten history (ADR-001), so its immutable ID changed. The Azure app `github-vitalos-superadmin-deploy` now also trusts `repo:Isaacpyo@54102915/vitalos-platform@1417273525:environment:production` (and the `Production` spelling). The old private repository is kept as `Isaacpyo/vitalos-platform-archive`; its renamed subject matches no credential, so it can no longer deploy. `BOOTSTRAP_ADMIN_EMAIL` is a `production` environment secret, so the bootstrap address stays out of public logs.
