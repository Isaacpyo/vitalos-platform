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
9. **PostgreSQL 17** is used everywhere (Neon, CI, compose). The image's `pg_dump`/`pg_restore` and the backup workflow's `postgres:17` client are version 17. Pairing a version 17 client with a version 16 server produced a restore warning in testing. **Create the Neon project on PostgreSQL 17.**
10. **API tokens.** Instead of DRF's single `authtoken`, there is a small `ApiToken` model: several named tokens per user, an expiry, revocation, last-used time, and only a SHA-256 hash stored. The secret is shown once. It is sent as `Authorization: Bearer vsa_…`.
11. **Swagger UI** uses drf-spectacular's split view and sidecar assets, so no inline scripts or CDNs are needed.

## Hosting and deployment (amended 11 Oct 2026 for zero monthly cost)

12. **Azure Container Apps, UK South, at £0/month.** Temitope asked for zero monthly cost and pre-approved this change. The app runs on the Container Apps consumption plan inside the permanent free grant. PostgreSQL is Neon's free tier, the image is on ghcr.io, and DNS and TLS are Cloudflare free plus an Azure managed certificate. This replaces Key Vault, Azure Container Registry, Azure Database for PostgreSQL and the Azure Files backup job, which together would cost money every month.
    - No hosting CLI or MCP was connected in the build session, and the build sandbox's cloud credentials were not Vitalos's, so they were not used.
    - Deployment is an idempotent script, `deploy/azure/deploy.sh` (`--dry-run` prints the plan), run by the manual, environment-gated `Super Admin deploy` workflow.
    - The workflow logs in with Azure OIDC, so no Azure keys are stored. The OIDC identity has only **Contributor on `rg-vitalos-superadmin`**.
    - The subscription Owner creates the resource group, Log Analytics workspace and environment once (DEPLOY.md §2.1).
13. **Imperative CLI, not Terraform.** The brief asked for provisioning through the CLI. ADR-012 prefers Terraform, so ADR-016 records this as a single-environment bootstrap exception, and converting it to Terraform is in Phase 2.
14. **Sizing and the free grant.**
    - **Shape:** a consumption-only environment (no workload profiles). One app at **0.25 vCPU / 0.5 GiB, min replicas 0, max replicas 1**, scaling on HTTP concurrency 50, with gunicorn at `WEB_CONCURRENCY=2` to fit 0.5 GiB.
    - **Free grant:** 180,000 vCPU-s, 360,000 GiB-s and 2 million requests per subscription per month. That covers about 200 hours of a running replica, because 180,000 / 0.25 = 360,000 / 0.5 = 720,000 s.
    - **Release job:** its runs last seconds and draw on the same grant.
    - **Assumptions:** the grant is shared by everything in the subscription. Nothing else in that subscription uses Container Apps; if something does, the £1 budget alert in DEPLOY.md is the tripwire.
    - **Trade-off: cold starts.** After about 5 idle minutes, the first request waits for a replica to start, which can include pulling the image (about 95 MB compressed), and Neon wakes too. Expect a few seconds, occasionally more. That is acceptable for an internal tool, and later requests are fast.
    - **Single replica:** a deploy briefly swaps revisions. There is no high availability; Phase 2 covers paid tiers.
15. **Database: Neon free tier** (AWS eu-west-2, London; UK data residency).
    - **Connection:** `DATABASE_URL` is the **pooled** connection string with `sslmode=require`, held as a GitHub `production` environment secret, re-applied on every deploy (so rotating it means updating that secret and redeploying), and passed to the containers as a secret.
    - **Settings for autosuspend and pooling:** Neon autosuspends after 5 idle minutes, and pooling runs through PgBouncer in transaction mode. Prod settings therefore use `CONN_MAX_AGE=0` and `CONN_HEALTH_CHECKS=True`, and set `DISABLE_SERVER_SIDE_CURSORS=True`, because transaction pooling cannot hold cursors.
    - **Release job:** `bin/release.sh` runs `migrate`, `seed_architecture` and `create_superadmin` as a one-off Container Apps job *before* the app gets the new image. Each step is retried 3 times with 5 s and 15 s backoff, to cover Neon cold starts.
    - **Bootstrap account:** `create_superadmin` only creates a missing account. It never re-activates, re-promotes or changes an existing one; `--password` resets only the password.
    - **Access and limits:** the app uses the Neon project's owner role, over TLS with a generated password. A least-privilege role is a Phase 2 item, and Neon IP allow-listing is not on the free plan (assumption). Free-plan limits at the time of writing are 0.5 GB of storage and a monthly compute allowance; autosuspend keeps an internal tool well within it.
16. **Secrets: Container Apps secrets** (no Key Vault).
    - **Where they live:** `django-secret-key`, `database-url`, `bootstrap-admin-password` (plus `sentry-dsn` if set) are secrets on both the app and the release job, referenced with `secretref:`. The ghcr pull token is held as the registry password secret that `az` manages for the app and job.
    - **Generation:** the workflow generates the secret key and bootstrap password with `openssl rand`, masks them, and writes them only into Container Apps secrets. A redeploy reads back and keeps the existing values (tested with a stubbed `az`), so sessions and the bootstrap password survive.
    - **Bootstrap password:** the app container does not receive it as an environment variable. It is stored on the app only so Temitope can retrieve it once (DEPLOY.md §3), and should be changed in the app after first sign-in.
    - **Who can read them:** anyone with Contributor on the resource group can read these secrets. Keep that role to the founder and the deploy identity.
17. **Registry: GitHub Container Registry, private, with a pull PAT** (default as instructed).
    - **Push and pull:** the workflow pushes with `GITHUB_TOKEN` (`docker/build-push-action`). Container Apps pulls with a classic PAT that has only `read:packages`, stored as the `GHCR_PULL_TOKEN` environment secret.
    - **Storage:** only the 3 newest image versions are kept (`actions/delete-package-versions`), and provenance attestations are off, to stay within the free 500 MB of package storage.
    - **Transfer:** private-package pulls by Azure count against GitHub's free data transfer, 1 GB/month on GitHub Free. At about 95 MB per cold pull, that is roughly 10 cold pulls a month. Beyond that, with GitHub's default $0 spending limit, pulls fail rather than cost money, which would be an outage, not a bill. The image contains no secrets, only the application code. **Confirm:** making the package public removes the transfer limit; otherwise keep the PAT and watch the GitHub billing page.
    - **PAT expiry:** the PAT expires on the date chosen when it was created. Rotate it by updating `GHCR_PULL_TOKEN` and redeploying.
18. **DNS and TLS: Cloudflare free** (ADR-007) **and an Azure managed certificate** (free).
    - **Records:** the workflow writes a **DNS-only (grey cloud)** CNAME `admin` to the app FQDN, plus the `asuid.admin` TXT verification record, then runs `hostname add` and `hostname bind --validation-method CNAME`.
    - **Safety:** it never silently replaces a record that points elsewhere (`DNS_OVERWRITE=1` to force). Without `CLOUDFLARE_API_TOKEN` it prints the two records, writes `bound=false` and stops before binding, so the run succeeds and can be resumed.
    - **Orange cloud:** turning on the Cloudflare proxy is optional hardening (DEPLOY.md §4). It needs SSL mode **Full (strict)** and `TRUSTED_PROXY_COUNT=2`. Azure renews managed certificates only while the CNAME is visible, so set the record back to grey around renewal, or use a Cloudflare Origin CA certificate instead.
    - **Nameservers:** `stage-status.md` notes that Cloudflare nameserver activation was pending, so DEPLOY.md starts by checking which DNS host is authoritative.
19. **Backups: Neon history plus a daily GitHub Actions dump.**
    - **Neon:** point-in-time restore over its free-plan history window (6 hours at the time of writing).
    - **Daily dump:** `.github/workflows/backup.yml` runs at 02:00 UTC. It runs `pg_dump` with a PostgreSQL 17 client against Neon's direct (non-pooler) host, because `pg_dump` needs a session. It gzips the output and uploads it as a workflow artifact kept **14 days** (free).
    - **`backup` environment:** the workflow uses an environment named `backup` with **no required reviewers**. Placing it in `production` would hold every scheduled run for approval. It needs its own `DATABASE_URL` (ideally a read-only Neon role) and, recommended, `BACKUP_PASSPHRASE` for AES-256 encryption. Artifacts are otherwise readable by anyone with read access to the repository.
    - **Schedule:** scheduled runs start only once the workflow is on `main`. Each run takes about 1–2 Actions minutes.
    - **`bin/backup.sh`** stays as a portable manual tool, and CI still exercises it.
20. **HSTS.** One year, with `includeSubDomains` (which only affects `*.admin.vitalos.co.uk`). Preload is **not** set, because preload-list submission is a decision for the whole `vitalos.co.uk` domain. Django's `security.W021` warning is therefore silenced in prod settings, and CI runs `check --deploy --fail-level WARNING`.
21. **Health probe.** `/healthz/` answers before host validation, because platform probes use the container IP as the Host header, and it is exempt from the HTTPS redirect. It touches the database, so an external uptime monitor would keep Neon and the app awake and use up the free grants. Don't add one; the platform's default TCP probes do not wake Neon.

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
48. CodeQL (`analyze`) is red on `main` and on this PR because code scanning is not enabled in the repository settings. This is unrelated to the change and needs a repository-owner setting.

## Zero-cost amendment (11 Oct 2026)

49. **Workflow shape.** `Super Admin deploy` keeps the `DEPLOY` confirmation, the smoke-test toggle and the `production` environment gate, and runs as plan → build → deploy:
    - **plan:** `deploy.sh --dry-run`, which lists every resource with the expected cost **£0.00** and the free-grant assumptions. It needs no secrets.
    - **build:** pushes `ghcr.io/<owner>/vitalos-superadmin:<sha>`. This runs before the approval gate; pushing an image changes nothing in production.
    - **deploy:** behind the `production` gate.
50. **File names.** The backup workflow is `.github/workflows/backup.yml`, as requested, with the display name "Super Admin backup", because the monorepo has other apps.
51. **GitHub Actions minutes are a shared, finite quota (found 11 Oct 2026).** On this PR's final push, GitHub refused to start a CI job: "recent account payments have failed or your spending limit needs to be increased". The account's included private-repository Actions minutes (2,000/month on GitHub Free) or its spending limit were exhausted. The deploy and backup workflows draw on the same quota, so while it is exhausted:
    - deploys cannot run;
    - **daily backups silently stop**, leaving only Neon's 6-hour history.

    To keep £0 hosting dependable, either cut CI usage or accept a small Actions spending limit. CI usage could be cut by enabling code scanning or removing the always-failing CodeQL job (about 3 minutes per push), and by running the container smoke job only when `superadmin/` changes (it already does). **Confirm** which. Check usage under **GitHub → Settings → Billing → Actions**.
52. **Verification limits.** No Azure, Neon or Cloudflare credentials were available in the build session either time, so the real deploy has still not run. The script was exercised with a stubbed `az` (first deploy, redeploy, Actions masking and the no-Cloudflare resumable stop), and `shellcheck` and `actionlint` are clean. Every Azure CLI flag was checked against `az` 2.91. Locally, the production image passed the 25-check browser smoke test inside the free-grant shape (container limited to 0.25 vCPU / 512 MB, using about 150 MiB with 2 gunicorn workers), with the Neon-oriented DB settings. The backup workflow's script produced a gzipped and encrypted dump, which decrypted and restored into PostgreSQL 17 (6 service lines and their history).
