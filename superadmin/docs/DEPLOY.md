# Deploying the Vitalos Super Admin (zero monthly cost)

Target: **https://admin.vitalos.co.uk**. Expected cost: **£0.00 per month.**

| Piece            | Service                                                                    | Why it is free                                                   |
| ---------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| App              | Azure Container Apps, consumption plan, UK South, scale to zero            | Inside the monthly Container Apps free grant                     |
| Database         | **Supabase** free plan (default) or Neon free plan, London (AWS eu-west-2) | Free plans                                                       |
| Image            | GitHub Container Registry, public package `vitalos-platform/superadmin`     | Public packages: free storage and transfer, no pull token        |
| DNS              | Cloudflare free plan, `admin` CNAME (DNS only)                             | Cloudflare free                                                  |
| TLS              | Azure Container Apps managed certificate                                   | No charge                                                        |
| Secrets          | Container Apps secrets                                                     | No charge (no Key Vault)                                         |
| Logs             | Log Analytics, daily cap 0.1 GB, 31-day retention                          | First 5 GB/month and 31 days are free                            |
| Backups          | Daily encrypted `pg_dump` in private Azure Blob Storage (15 days, locked 14); plus history on Neon | Pennies a month (a few MB, LRS Hot)                              |
| Deploy           | GitHub Actions `Super Admin deploy`, Azure OIDC                            | Actions minutes included                                         |

## Status

**Not live yet.** The build session had no Azure, Supabase, Neon or Cloudflare credentials, and it did not use the sandbox's own cloud credentials, which are not Vitalos's. Everything else is built and verified:

- the app and its CI (tests, deploy checks, image build, browser smoke test against the production container);
- a dump-and-restore round trip;
- `shellcheck` and `actionlint`;
- every Azure CLI flag, checked against `az` 2.91;
- the deploy script's control flow, exercised end to end with a stubbed `az`.

The real deploy is the "What Temitope does once" checklist below.

**Set up on 11 Oct 2026** (DECISIONS.md 54-57):

- **Azure:** the personal **"Azure subscription 1"**, a free trial. Its credit expires on **10 Nov 2026**: **upgrade it to Pay-As-You-Go before then**, or the subscription is disabled and the app stops. Moving it to the Vitalos Entra tenant is a Phase 2 item.
- **GitHub environment:** the existing Vercel-created **`Production`**. GitHub matches environment names case-insensitively, so the workflow's `production` resolves to it. The Azure app `github-vitalos-superadmin-deploy` (client ID `a6bc0a8d-c742-4f14-9e31-7112b1963fef`) trusts the subject `repo:Isaacpyo@54102915/vitalos-platform@1417273525:environment:production` (§2.1).
- **No approval pause:** required reviewers aren't available on this private repository's plan, so step 6 below relies on the public-image check instead.
- **Database:** Supabase project `vitalos-superadmin` (ref `uhvcjsnuxdthjfainvmm`), London, PostgreSQL 17.11. The Data API was disabled at creation, the lock-down SQL (§2.3) was applied, and `backup_reader` (§6.1) was created and verified.

## Email and enquiries (owner steps)

The deploy works without any mail settings: `EMAIL_TRANSPORT` defaults to `log`, so nothing is sent. To receive support@ mail in the Enquiries tab and send sign-in, set-password and notification mail, follow [email-setup.md](email-setup.md). In short, and each step needs your approval:

1. Deploy the Cloudflare Email Worker (`infra/cloudflare-email-worker`) and bind it to the support@ route, and add routes for admin@ and notifications@.
2. Verify a Resend sending domain, add the DKIM, SPF and return-path records, and create a restricted API key and a webhook to `https://admin.vitalos.co.uk/api/webhooks/resend`.
3. Add the secrets (`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `INBOUND_WEBHOOK_SECRET`, and optionally `TURNSTILE_SECRET_KEY`, the `OBJECT_STORAGE_*` keys and `SLACK_WEBHOOK_URL`) and variables (`PRIMARY_OWNER_EMAIL`, `EMAIL_TRANSPORT`, `INBOUND_PROVIDER`, `NOTIFY_OWNER_EMAIL`, `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_REGION`, `RETENTION_ENFORCE`) to the `Production` environment, then run the deploy. The workflow passes through only those that are set and never overwrites a stored secret with an empty value.
4. Schedule `send_enquiry_notifications` every 5 minutes as a Container Apps job, then run `issue_setup_link --email admin@vitalos.co.uk` to give the primary owner a first password (a one-time link, 30 minutes, printed to the terminal only).

## What Temitope does once

1. **Database (§2.3).** **Supabase** is the default; Neon works the same way.
   - Create a **separate** free Supabase project in **London**, not the website's.
   - Copy **Connect → Session pooler** (port 5432) and add `?sslmode=require`. That is `DATABASE_URL`.
   - In the SQL editor, run the **Data API lock-down** SQL in §2.3 before the first deploy.
   - Create the read-only `backup_reader` role with the SQL in §6.1. Its connection string is the backup `DATABASE_URL` in step 4.
2. **Cloudflare.** Confirm vitalos.co.uk is active on Cloudflare's free plan: `dig +short NS vitalos.co.uk` shows `*.ns.cloudflare.com`. If it doesn't, add the site in Cloudflare and change the nameservers at the registrar first. Then create a token under **My Profile → API Tokens → Create Token → "Edit zone DNS"**, with **Zone Resources: Include → Specific zone → vitalos.co.uk**. That is `CLOUDFLARE_API_TOKEN`.
3. **Azure.** Run the §2.1 one-time setup as subscription Owner. A card on file is required, but nothing is charged within the free grant. A free-trial subscription must be upgraded to Pay-As-You-Go before its credit expires (for "Azure subscription 1", 10 Nov 2026).
4. **GitHub.** Go to **Settings → Environments**.
   - `production`: this repository uses the existing Vercel-created `Production` environment; names match case-insensitively. Required reviewers aren't available on this private repository's plan, so there is no approval gate. The environment is shared with the website, so the Super Admin's database string has its own name: add `SUPERADMIN_DATABASE_URL` (step 1; never the website's database), `CLOUDFLARE_API_TOKEN` (step 2), `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` (printed by §2.1). Optionally add `SENTRY_DSN`. No registry token is needed: the image is public.
   - `backup` (no reviewers): add `DATABASE_URL` (the `backup_reader` string from §6.1, or the same one as production), and `BACKUP_PASSPHRASE` to encrypt dumps (required: the workflow refuses to store an unencrypted dump). Then set up blob storage for the dumps (§6.2) and add its secrets and variables to the same environment. Keep a copy of the passphrase outside GitHub, in the owner's password manager; without it no backup can be restored. On Supabase's free plan this nightly dump is the **only** backup, and it also keeps the project from being paused (§2.3).
5. **Deploy.** Merge PR #50. Open **Actions → Super Admin deploy → Run workflow** on `main`, type `DEPLOY`, and tick **smoke test** (first run only).
6. **Make the image public (first run only).** The build job creates the package `vitalos-platform/superadmin` on ghcr.io as private, which GitHub always does for a new package, and the API can't change it. There is no approval pause, so:
   1. Run the deploy (step 5) and let it stop at the **public-image check**. It fails before touching Azure and prints the package settings link.
   2. Open https://github.com/users/Isaacpyo/packages/container/vitalos-platform%2Fsuperadmin/settings and go to **Danger Zone → Change visibility → Public**.
   3. Back on the run, use **Re-run failed jobs**.

   The package stays public for every later deploy.

The **plan** job prints everything it will create and the expected cost (£0.00) before anything changes. The run ends when https://admin.vitalos.co.uk answers with a valid certificate, then the live smoke test runs. Without `CLOUDFLARE_API_TOKEN`, the run prints two DNS records and stops successfully. Create the records, then run the workflow again; it carries on from the DNS step.

## 1. What gets created

All of it is in **`rg-vitalos-superadmin`**, region **`uksouth`**:

| Resource                      | Name                      | Created by     | Settings                                                                      |
| ----------------------------- | ------------------------- | -------------- | ----------------------------------------------------------------------------- |
| Resource group                | `rg-vitalos-superadmin`   | §2.1 (once)    |                                                                               |
| Log Analytics workspace       | `log-vitalos-superadmin`  | §2.1 (once)    | PerGB2018, daily cap **0.1 GB**, 30-day retention                             |
| Container Apps environment    | `cae-vitalos-superadmin`  | §2.1 (once)    | **Consumption only** (no workload profiles)                                   |
| OIDC app registration         | `github-vitalos-superadmin-deploy` | §2.1 (once) | Federated with the GitHub `production` environment (immutable subject, §2.1); **Contributor on the RG** |
| Container Apps job            | `superadmin-release`      | deploy         | Manual; `bin/release.sh`; 0.25 vCPU / 0.5 GiB                                 |
| Container app                 | `superadmin`              | deploy         | External ingress :8000, **min 0 / max 1 replicas**, 0.25 vCPU / 0.5 GiB, HTTP concurrency 50 |
| Custom domain + managed cert  | `admin.vitalos.co.uk`     | deploy         | CNAME validation                                                              |
| Cloudflare records            | `admin` CNAME, `asuid.admin` TXT | deploy  | DNS only (grey cloud), TTL 300                                                |

Run `superadmin/deploy/azure/deploy.sh --dry-run` to print the same plan locally. It needs no credentials.

### Secrets and environment variables

All secrets are **Container Apps secrets**, referenced by environment variables with `secretref:`. Their values are never printed, logged or committed.

| Container Apps secret      | Env var                    | Source                                                                     |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| `django-secret-key`        | `DJANGO_SECRET_KEY`        | `openssl rand` in the workflow on first deploy; kept afterwards             |
| `bootstrap-admin-password` | `BOOTSTRAP_ADMIN_PASSWORD` | `openssl rand` on first deploy; kept. Env var only on the release job      |
| `database-url`             | `DATABASE_URL`             | GitHub `production` secret `SUPERADMIN_DATABASE_URL` (Supabase session pooler, or Neon pooled); re-applied every deploy |
| `sentry-dsn` (optional)    | `SENTRY_DSN`               | GitHub `production` secret                                                 |

Plain environment variables: `DJANGO_SETTINGS_MODULE=config.settings.prod`, `ALLOWED_HOSTS=admin.vitalos.co.uk`, `CSRF_TRUSTED_ORIGINS=https://admin.vitalos.co.uk`, `SECURE_SSL_REDIRECT=True`, `TRUSTED_PROXY_COUNT=1`, `APP_ENVIRONMENT=production`, `LOG_FORMAT=json` and `WEB_CONCURRENCY=2`. The release job also gets `BOOTSTRAP_ADMIN_EMAIL` from the `production` environment secret of that name. The prod settings use `CONN_MAX_AGE=0`, connection health checks, and no server-side cursors. That suits a pooled free-tier database: Supabase's session pooler, or Neon's PgBouncer with its autosuspend.

## 2. One-time setup: Azure (subscription Owner) and the database

### 2.1 Resource group, Log Analytics, Container Apps environment, OIDC identity

Run this in Azure Cloud Shell (bash):

```sh
SUB=<vitalos-subscription-id>
RG=rg-vitalos-superadmin
LOC=uksouth
az account set --subscription "$SUB"
for p in Microsoft.App Microsoft.OperationalInsights; do az provider register -n "$p" --wait; done

az group create -n "$RG" -l "$LOC" --tags app=vitalos-superadmin env=production

# Log Analytics: free ingestion is 5 GB/month and retention up to 31 days is free; cap at 0.1 GB/day.
az monitor log-analytics workspace create -g "$RG" -n log-vitalos-superadmin -l "$LOC" \
  --sku PerGB2018 --retention-time 30 --quota 0.1
LAW_ID=$(az monitor log-analytics workspace show -g "$RG" -n log-vitalos-superadmin --query customerId -o tsv)
LAW_KEY=$(az monitor log-analytics workspace get-shared-keys -g "$RG" -n log-vitalos-superadmin --query primarySharedKey -o tsv)

# Consumption-only environment: no workload profiles, so there is no fixed charge.
az containerapp env create -n cae-vitalos-superadmin -g "$RG" -l "$LOC" --enable-workload-profiles false \
  --logs-workspace-id "$LAW_ID" --logs-workspace-key "$LAW_KEY"

# GitHub Actions to Azure with OIDC: no stored Azure keys. Contributor on this resource group only.
APP_ID=$(az ad app create --display-name github-vitalos-superadmin-deploy --query appId -o tsv)
SP_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
# This repository uses GitHub's immutable OIDC subjects (owner and repository IDs after the names), and the
# token carries the environment name as the workflow spells it (lowercase). Check the prefix with:
#   gh api repos/Isaacpyo/vitalos-platform/actions/oidc/customization/sub --jq .sub_claim_prefix
# Type the subject exactly: a trailing newline or space makes Azure reject every login (AADSTS700213).
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-production-immutable",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:Isaacpyo@54102915/vitalos-platform@1417273525:environment:production",
  "audiences": ["api://AzureADTokenExchange"]}'
az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
  --role Contributor --scope "$(az group show -n "$RG" --query id -o tsv)"

echo "AZURE_CLIENT_ID=$APP_ID AZURE_TENANT_ID=$(az account show --query tenantId -o tsv) AZURE_SUBSCRIPTION_ID=$SUB"
```

None of the three printed values is secret. Store them as environment secrets anyway, as the workflow expects.

### 2.2 £1 budget alert (free tripwire)

In the Azure portal, go to **Cost Management + Billing → Budgets → Add**:

- Scope: the subscription. Amount: **£1**, monthly.
- Alert conditions: **Actual 100%** and **Forecasted 100%**, emailed to the owner.

Or use the CLI (start date = first day of the current month):

```sh
az consumption budget create --budget-name superadmin-tripwire --amount 1 --category cost \
  --time-grain monthly --start-date 2026-10-01 --end-date 2028-10-01
```

Add the email alert to it in the portal. Check usage at any time under **Cost Management → Cost analysis**, scoped to `rg-vitalos-superadmin` and grouped by **Meter**. Free-grant usage appears as metered quantity at £0.00. If the Container Apps meters ever show a cost, look at §7.

### The free-grant arithmetic

The Container Apps consumption plan includes, per subscription per month, **180,000 vCPU-seconds, 360,000 GiB-seconds and 2 million requests** free.

- One replica at **0.25 vCPU** uses 180,000 / 0.25 = 720,000 s, about **200 hours**, of the vCPU grant.
- At **0.5 GiB** it uses 360,000 / 0.5 = 720,000 s, the same **200 hours**, of the memory grant.
- With **min replicas 0**, the app is billed only while a replica is running: from the first request until about 5 minutes after the last one. An internal tool used during working hours runs well under 200 hours a month. Release-job executions take seconds each.
- **Max replicas 1** caps the worst case at one replica, so even heavy use cannot exceed about 200 hours of runtime without the budget alert firing first.

The trade-off is **cold starts**. After about 5 idle minutes, the first request waits a few seconds while a replica starts. That can include pulling the image (about 95 MB) and, on Neon, waking the database. Supabase's free plan doesn't suspend compute. Later requests are fast.

### 2.3 Database: Supabase (default) or Neon

Either free plan works with the same app, settings and retries. Supabase is the documented default.

**Supabase (default)**

1. **Create the project.** At https://supabase.com/dashboard, create a **new, separate** project named `vitalos-superadmin` on the **Free** plan, in region **London** (AWS `eu-west-2`).
   - Never reuse the website's Supabase project. ADR-026 keeps internal governance data and access separate from the public site.
   - The free plan allows **2 active projects per organisation**. If the organisation already has two, free one up or put this project in another organisation.
   - Generate the database password locally with `openssl rand -hex 24`. Hex needs no URL escaping. Keep it only in the GitHub secrets. A password with `/`, `?`, `#`, `@` or `:` must be percent-encoded in `DATABASE_URL`; `deploy.sh` refuses an unescaped one before touching Azure (DECISIONS #61).
   - If the form offers **Enable Data API**, untick it. The app talks to PostgreSQL directly and never uses Supabase's APIs.
2. **Copy the connection string.** Click **Connect** and choose **Session pooler**. Copy the URI, fill in the password, and append `?sslmode=require`. That is `DATABASE_URL`:

   `postgresql://postgres.<project-ref>:<password>@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=require`

   Copy the host exactly as the dashboard shows it; the `aws-0` prefix can differ.
   - **Don't use the Direct connection** (`db.<project-ref>.supabase.co`). It is IPv6-only, and neither Container Apps nor GitHub-hosted runners have IPv6 egress. `deploy.sh` refuses that host with a pointer back here.
   - **Don't use the Transaction pooler** (port 6543). The session pooler is the configuration this was set up and documented for.
3. **Lock down the Data API before the first deploy.** Supabase's default privileges give its API roles (`anon`, `authenticated`, `service_role`) full read and write on every new table in `public`, with row-level security off. Those tables are the app's tables, including password hashes and TOTP secrets, and the Data API exposes them with a key that is public by design. In **SQL Editor**, which runs as `postgres`, run:

```sql
-- Supabase only: keep the Super Admin's tables out of Supabase's Data API (PostgREST/GraphQL).
-- Run once in the SQL editor as postgres, before the first deploy (and again after restoring into a new project).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
REVOKE USAGE ON SCHEMA public FROM anon, authenticated, service_role;
```

   If the Data API wasn't disabled when the project was created, also turn it off in the project's **Data API** settings. The SQL is the control that matters: it holds even if the API is switched back on.
4. **Create the backup role:** run the `backup_reader` SQL in §6.1.

Things to know about the Supabase free plan:

- **Inactivity pause.** A free project is paused after **7 days without activity**. The nightly backup (`backup.yml`, 02:00 UTC) connects every day, which keeps the project active, so keep it running. It starts once the workflow is on `main` and the `backup` environment has `DATABASE_URL`. If backups stop, for example because Actions minutes run out (§7), the project can pause. The app then fails until you **Restore** the project from the Supabase dashboard; the data is kept while it is paused.
- **No automatic backups.** The free plan has no scheduled backups or point-in-time recovery, so **the nightly `pg_dump` is the only backup**. It is stored encrypted in a private Azure Blob container for 15 days (§6.2). Set `BACKUP_PASSPHRASE`, watch the backup run history, and download a dump now and then to keep an offline copy. Paid plans add daily backups (PHASE2.md).
- **Limits:** 500 MB of database. The app stores structured text, far below that. The app uses at most about 4 connections at once: 2 gunicorn workers on one replica, the release job and the backup.
- **PostgreSQL version:** Supabase projects run PostgreSQL 15, or 17 on newer projects. Both work. The `vitalos-superadmin` project runs 17.11. The test suite passes on Supabase's own PostgreSQL 15 image, and the backup uses a client matching the server's version (§6).

**Neon (alternative)**

1. At https://neon.tech, create a free project named `vitalos-superadmin`, with region **AWS Europe West 2 (London)** and **PostgreSQL 17**.
2. Open **Connect**, tick **Connection pooling**, and copy the connection string. Its host contains `-pooler` and it ends in `?sslmode=require`. That is `DATABASE_URL`.
3. Skip the Data API lock-down; Neon does not expose tables through an API by default.
4. Create `backup_reader` with §6.1, using the Neon names given there.

Neon autosuspends after 5 idle minutes, which the release retries and connection health checks absorb. It keeps 6 hours of history for point-in-time restore on the free plan.

## 3. Verify and first sign-in

```sh
curl -sS https://admin.vitalos.co.uk/healthz/                  # {"status": "ok"} (may take a few seconds when cold)
curl -sSI https://admin.vitalos.co.uk/login/ | grep -iE 'HTTP/|strict-transport|content-security'
```

The bootstrap password lives only in the Container Apps secret `bootstrap-admin-password`. **Retrieve it once** (as Contributor or Owner on the resource group):

```sh
az containerapp secret show -n superadmin -g rg-vitalos-superadmin --secret-name bootstrap-admin-password --query value -o tsv
```

1. Open https://admin.vitalos.co.uk and sign in as the bootstrap admin (`BOOTSTRAP_ADMIN_EMAIL`).
2. Scan the QR code. TOTP is mandatory for SuperAdmin.
3. **Change the password immediately**: **Account & security → Change password**. The Container Apps secret is not updated (by design), and it is never used again for an existing account, because `create_superadmin` leaves existing accounts unchanged.

The live smoke test (`e2e/smoke.py`, ticked on the first run) signs in, enrols a temporary authenticator, and exercises every dashboard and create/edit flow. It archives its "Smoke test …" records and removes the authenticator. Run it **before** your own first sign-in. Once you have enrolled, it reports *skipped*. Its screenshots are uploaded as a 7-day artifact; copy them to `superadmin/docs/screenshots/live/`.

## 4. Optional hardening: Cloudflare proxy (orange cloud)

Turn the proxy on only **after** the first deploy has bound the domain and issued the certificate:

1. In Cloudflare, go to **SSL/TLS → Overview** and set the mode to **Full (strict)**. Never use Flexible.
2. Under **DNS**, switch the `admin` record to **Proxied**, and leave the `asuid.admin` TXT record as it is.
3. Set `TRUSTED_PROXY_COUNT=2` so lockouts see the real client IP, because Cloudflare adds a hop:

   ```sh
   az containerapp update -n superadmin -g rg-vitalos-superadmin --set-env-vars TRUSTED_PROXY_COUNT=2
   ```

   Also change it in `deploy.sh`, or each redeploy resets it to 1.
4. **Certificate renewal:** Azure renews managed certificates only while the CNAME is visible. Around renewal, which is roughly every 6 months, set the record back to **DNS only** for a day. Alternatively, upload a free Cloudflare Origin CA certificate to the environment and bind it instead.

## 5. Automatic deploy, redeploy and roll back

### 5.1 Automatic deploy (from 14 Oct 2026)

Merging a Super Admin change to `main` deploys it, under the standing approval for merge-triggered production deploys.

1. A push to `main` that touches `superadmin/` (not `superadmin/docs/` or markdown) or `.github/workflows/superadmin*.yml` starts the **Super Admin** CI workflow.
2. When that run **completes**, **Super Admin deploy** starts through `workflow_run` (branch `main`, push events only). The plan job proceeds only if the CI conclusion is `success` and every one of its jobs is `success` (a skipped or cancelled job stops it), and the range since the commit running in production changed Super Admin runtime files or the deploy workflow (`git diff --name-only <deployed> <sha>`, see the range below). Docs-only and non-Super Admin pushes never start CI, so they never deploy.
3. It builds, migrates and deploys exactly `workflow_run.head_sha`, the commit CI tested, never the moving branch tip. Super Admin CI no longer cancels in-progress runs on `main`, so each commit gets its own finished run.
4. **Migration guard and its range.** The range is every commit between the **deployed commit** and the commit being deployed. The deployed commit is the tag of the image the production Container App runs now (the tag is the commit SHA); a read-only `current` job in the `production` environment reads it through the Azure OIDC login (`id-token: write`, nothing else). The plan job fetches history, requires `git merge-base --is-ancestor <deployed> <sha>`, then scans migration files added or modified in that range (`git diff --diff-filter=AM <deployed> <sha>`, `superadmin/apps/*/migrations/*.py`) for `RemoveField`, `DeleteModel`, `RenameField`, `RenameModel`, `AlterField` (flagged for review) and `RunSQL`. The changed-files gate uses the same range. A hit fails the plan job: "deploy manually with confirm=DEPLOY after review". If the deployed SHA cannot be read (no app yet, tag not a SHA, Azure unreachable) or is not an ancestor of the new commit (a rollback or a deploy from a branch), the plan fails closed with the same message and never falls back to the previous commit. So two quick merges cannot hide a risky migration, and Super Admin PRs no longer need merging one at a time.
5. **Pre-migration backup.** The `backup` job dispatches **Super Admin backup** (`backup.yml`, which stores an encrypted dump in private blob storage, §6.2) and waits for it to succeed before the deploy job runs. A failed backup stops the deploy before any migration. The deploy workflow itself never creates or uploads a dump, because this repository is public and personal data stays out of its artifacts and logs.
6. **Post-deploy check.** After `deploy.sh`, the job polls `https://admin.vitalos.co.uk/healthz/` for up to 5 minutes and confirms the app runs the new image tag. On failure the run fails and prints the rollback command. **Nothing rolls back automatically.**
7. Deploys queue in the `superadmin-deploy` group and never cancel one another mid-migration.

**Manual override:** run **Super Admin deploy** (`workflow_dispatch`, `confirm=DEPLOY`) from any ref. It skips the changed-files and migration guards, not the backup. Use it for a reviewed destructive migration, a redeploy or a rollback.

### 5.2 Redeploy and roll back

**Redeploy:** run **Super Admin deploy** again from the commit you want. It builds `ghcr.io/<owner>/vitalos-platform/superadmin:<sha>` and runs the release job (migrations first). Then it updates the app. Secrets and the domain binding are kept, and the 3 newest images are retained.

**Roll back the code** to one of the 3 retained images:

```sh
az containerapp update -n superadmin -g rg-vitalos-superadmin --image ghcr.io/isaacpyo/vitalos-platform/superadmin:<previous sha>
```

Migrations only move forward. They are additive in this project. If a migration must be undone, restore the database (§6). Never drop tables by hand.

**Take it offline quickly, without deleting anything:**

```sh
az containerapp ingress disable -n superadmin -g rg-vitalos-superadmin
```

To remove the DNS record, delete the `admin` CNAME in Cloudflare.

## 6. Backups and restore

What you can restore from depends on the database:

- **Supabase free (default):** only the **daily dump** below. The free plan has no automatic backups or point-in-time recovery.
- **Neon free:** the daily dump, plus **Neon history**: 6 hours of point-in-time restore at the time of writing. In the Neon console, go to **Branches → Restore**. Restore `main` to a timestamp, or better, create a branch at that timestamp, inspect it, then promote it.

**Daily dump.** `.github/workflows/backup.yml` runs at 02:00 UTC (once on `main`), or on demand with **Actions → Super Admin backup → Run workflow**.

- Each run stores `superadmin/<yyyy>/<mm>/superadmin-<UTC timestamp>-pg<major>.sql.gz.gpg` in the private container (§6.2): a gzipped plain SQL dump of the app's `public` schema, always encrypted with `BACKUP_PASSPHRASE`. A blob can't be deleted or overwritten for **14 days** and is deleted after **15 days**. Nothing is uploaded as a workflow artifact: this repository is public.
- The workflow reads the server's version first and dumps with the matching client (for example `postgres:15` for Supabase on 15), so the dump restores on that version.
- Supabase's own schemas (`auth`, `storage` and others) are not included. The app doesn't use them, and `backup_reader` can't read them.

Restore into an **empty** database:

- **Supabase:** a new project. Run the §2.3 Data API lock-down SQL in it first, then restore over its **session pooler** string, as `postgres`.
- **Neon:** a new branch or database, using its **direct** (non-pooler) string.

Use the PostgreSQL image whose major version matches `pg<major>` in the file name:

```sh
az storage blob list --auth-mode login --account-name stvitalosbackups --container-name superadmin-db --prefix superadmin/ -o table
az storage blob download --auth-mode login --account-name stvitalosbackups --container-name superadmin-db \n  --name superadmin/<yyyy>/<mm>/superadmin-<timestamp>-pg<major>.sql.gz.gpg --file superadmin-<timestamp>-pg<major>.sql.gz.gpg
# (or download it in the portal: Storage account -> Containers -> superadmin-db)
gpg --decrypt superadmin-<timestamp>-pg<major>.sql.gz.gpg > superadmin-<timestamp>-pg<major>.sql.gz
gunzip -c superadmin-<timestamp>-pg<major>.sql.gz | sed '/^CREATE SCHEMA public;$/d' \
  | docker run --rm -i postgres:<major> psql "<connection string>" -v ON_ERROR_STOP=1
```

The `sed` removes the dump's `CREATE SCHEMA public;` line. The schema already exists in every new database, and with `ON_ERROR_STOP` that line would abort the restore.

Then point the app at the restored database. Update the GitHub `production` secret `SUPERADMIN_DATABASE_URL` to the new pooled string and redeploy. Or apply it immediately with:

```sh
az containerapp secret set -n superadmin -g rg-vitalos-superadmin --secrets database-url=<pooled string>
```

followed by a revision restart. Recreate `backup_reader` in the new database (§6.1), and update the `backup` secret.

### 6.1 Read-only backup role

The backup workflow only needs to read. Give it its own role so that a leaked backup secret can't change or delete data.

1. Generate the password locally: `openssl rand -hex 24`. Hex needs no URL escaping. Don't paste it anywhere except the SQL below and the `backup` secret.
2. Open the SQL editor as the role that owns the app's tables. Migrations run as that role.
   - **Supabase:** **SQL Editor**, which runs as `postgres` on database `postgres`.
   - **Neon:** **SQL Editor** with database **`neondb`** and role **`neondb_owner`**. In the SQL below, replace `DATABASE postgres` with `DATABASE neondb`, and `FOR ROLE postgres` with `FOR ROLE neondb_owner`.

   Then run:

```sql
-- Read-only role for the daily backup. Run once in the SQL editor as the role that owns the app's tables
-- (Supabase: postgres, database postgres. Neon: neondb_owner, database neondb).
CREATE ROLE backup_reader WITH LOGIN PASSWORD '<paste the openssl rand -hex 24 value>' CONNECTION LIMIT 2;
ALTER ROLE backup_reader SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE postgres TO backup_reader;
GRANT USAGE ON SCHEMA public TO backup_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_reader;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO backup_reader;
-- Tables and sequences that later migrations create (as postgres) are readable too.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO backup_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON SEQUENCES TO backup_reader;
```

3. Set the GitHub `backup` environment secret `DATABASE_URL`:
   - **Supabase:** use the same session pooler host and port as production. The pooler expects the user name as `<role>.<project-ref>`:

     `postgresql://backup_reader.<project-ref>:<password>@aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=require`

   - **Neon:** `postgresql://backup_reader:<password>@<endpoint host>/neondb?sslmode=require`. Copy `<endpoint host>` from the production string. Either the pooled (`-pooler`) host or the direct host works, because the workflow switches to the direct host for `pg_dump`.
4. Run **Actions → Super Admin backup → Run workflow** once and check that it ends with `Stored superadmin/...` (§6.2). This is also the check that the connection string is right.

If the app's tables are owned by another role, use that role's name in both `ALTER DEFAULT PRIVILEGES` lines and run the SQL as that role. Check the owner with `SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public';`.

Rotate the password with `ALTER ROLE backup_reader PASSWORD '<new>';`, then update the secret. Remove the role with `DROP OWNED BY backup_reader; DROP ROLE backup_reader;`. `DROP OWNED` here revokes only its grants, because it owns nothing.

### 6.2 Backup storage (Azure Blob, private)

The dumps live in their own storage account, separate from the app's resources, and are reached only through Microsoft Entra ID: account keys and anonymous access are off. The workflow signs in with OIDC as its own app registration, which can write to this one container and nothing else (the deploy identity has no access to it, and the backup identity can't deploy).

| Item | Value |
| --- | --- |
| Storage account | `stvitalosbackups` in `rg-vitalos-superadmin`, UK South, StorageV2, Standard LRS, Hot |
| Hardening | Shared key access off, blob anonymous access off, minimum TLS 1.2, HTTPS only |
| Container | `superadmin-db`, private |
| Immutability | Container time-based retention, **14 days** (unlocked): no blob can be deleted or overwritten for 14 days, so a leaked credential or a bad workflow can't wipe the backups |
| Lifecycle | Delete blobs **15 days** after creation |
| Identity | App registration `github-vitalos-superadmin-backup`, federated credential `repo:Isaacpyo@54102915/vitalos-platform@1417273525:environment:backup`, role **Storage Blob Data Contributor** on the container only |
| Restore access | The owner's account has **Storage Blob Data Reader** on the container |
| `backup` environment | Secrets `AZURE_BACKUP_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`; variables `BACKUP_STORAGE_ACCOUNT=stvitalosbackups`, `BACKUP_CONTAINER=superadmin-db` |

Cost: a few MB of dumps cost pennies a month (and fall inside the 12-month free 5 GB on a new subscription). To change the retention, update the container's immutability policy and the lifecycle rule together; the lifecycle delete must come after the lock ends.

**Verified on 11 Oct 2026:**

- **Supabase:** Supabase's own PostgreSQL 15 image (`supabase/postgres:15.19.0.004`, with Supabase's roles, schemas and default privileges), the app migrated as the non-superuser `postgres`:
  - The SQL above runs as `postgres`.
  - The backup workflow's own step, run as `backup_reader`, picked the PostgreSQL 15 client and dumped all 38 app tables.
  - A table created later by `postgres` is included in the next dump.
  - `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` and `CREATE` are refused, even after `SET default_transaction_read_only = off`. So is any read of `auth`.
  - A whole-database dump without `--schema=public` fails with "permission denied for schema auth", which is why the workflow dumps only `public`.
  - The dump restored into a fresh Supabase project, after the lock-down SQL, with no pending migrations.
  - The lock-down leaves `anon`, `authenticated` and `service_role` with no access to the app's tables, including tables created later. The app and the backup keep working.
- **Neon:** PostgreSQL 17 set up like Neon (`neondb` owned by `neondb_owner` with `CREATEROLE`), with the same results. A PostgreSQL 17 dump restored the same way.

Not tested, because there was no Supabase account: the pooler's `<role>.<project-ref>` user name for `backup_reader`. Step 4 checks it.

## 7. Operations

```sh
az containerapp logs show -n superadmin -g rg-vitalos-superadmin --follow     # JSON lines with request_id
az containerapp job execution list -n superadmin-release -g rg-vitalos-superadmin -o table
```

- **Errors:** every response carries `X-Request-ID`; search for it in Log Analytics. Set `SENTRY_DSN` in the `production` environment and redeploy to report errors; no personal data is sent.
- **Rotating secrets:**
  - Database: reset the password (Supabase: **Project Settings → Database**; Neon: the role's settings), update `SUPERADMIN_DATABASE_URL` (and the `backup` secret), and redeploy.
  - Django key: `az containerapp secret set ... --secrets django-secret-key=<new>` on both the app and the job. This signs everyone out.
- **Staying at £0:**
  - Do not add an external uptime monitor. `/healthz/` touches the database, so a monitor would keep the app (and Neon) awake and use up the free grant. On Supabase, the nightly backup already keeps the project active.
  - The image is public, so cold-start pulls have no transfer quota and need no token. Keep it public: if it is made private again, deploys stop at the pull check, and running replicas fail their next cold start.
- **GitHub Actions minutes:** deploys and the daily backup run on the account's Actions quota (2,000 minutes/month for private repositories on GitHub Free). When the quota or spending limit is exhausted, jobs fail with "spending limit needs to be increased", and **backups stop**. On Supabase that means no new backups, and after 7 days the project can be paused. Check **GitHub → Settings → Billing → Actions** monthly, and watch the backup workflow's run history.
- **Lost authenticator:** a superuser deletes the person's TOTP device in `/django-admin/`, and they enrol again at next sign-in.

## 8. Local development

```sh
cd superadmin
uv venv --python 3.12 .venv && uv pip install -r requirements.txt -r requirements-dev.txt
bin/tailwind.sh && python manage.py migrate && python manage.py seed_architecture
BOOTSTRAP_ADMIN_PASSWORD='<12+ chars>' python manage.py create_superadmin --email you@vitalos.co.uk
python manage.py runserver                 # or: docker compose up --build (PostgreSQL 17)
pytest                                     # SQLite; DATABASE_URL=postgres://… to match CI
```

## 9. Content (Insights and Careers)

Insights and Careers live in this app (ADR-039 to ADR-042). Both sections stay closed on the website until a super admin opens them in **Settings → Website content**; opening either in production is an owner decision. Every value below is optional: without them the admin works, the read API answers 503 (fail closed) and nothing is pushed to the website.

### Variables and secrets

`deploy/azure/deploy.sh` passes each one through when the deploy workflow provides a non-empty value (an empty value never overwrites what the app already holds). The deploy workflow must map them from the GitHub `production` environment (secrets for the secret rows).

| Name | Kind | Container Apps secret | What |
| ---- | ---- | --------------------- | ---- |
| `CONTENT_WEB_TARGETS` | variable | | Website base URLs, comma-separated; the first is used for Preview and View on site |
| `CONTENT_READ_CLIENT_KEYS` | secret | `content-read-client-keys` | `keyId:secret` list the website signs read-API and tick calls with |
| `CAREERS_SUBMIT_CLIENT_KEYS` | secret | `careers-submit-client-keys` | `keyId:secret` list for upload tickets and applications |
| `CONTENT_REVALIDATE_SECRET` | secret | `content-revalidate-secret` | `keyId:secret` the admin signs revalidation calls with |
| `CONTENT_RENDER_SECRET` | secret | `content-render-secret` | `keyId:secret` the admin signs render (preview) calls with |
| `CONTENT_PREVIEW_SECRET` | secret | `content-preview-secret` | `keyId:secret` for preview tokens |
| `CONTENT_IP_SALT` | secret | `content-ip-salt` | Salt for hashing applicant IP addresses |
| `CONTENT_MEDIA_BUCKET`, `CONTENT_MEDIA_PUBLIC_BASE_URL` | variables | | Public-read image bucket on the `OBJECT_STORAGE_*` endpoint, and its public host |
| `CAREERS_CV_BUCKET` | variable | | Private CV bucket on the same endpoint. Without it production refuses CV uploads |
| `CAREERS_CV_MAX_MB` | variable | | Default 10 |
| `CAREERS_EMAIL_FROM` | variable | | Sender for careers alerts; empty uses `NOTIFY_FROM` |
| `CAREERS_CANDIDATE_EMAILS_ENABLED` | variable | | `false`. Turning it on needs owner approval |
| `CONTENT_RELAY_SYNC_ENABLED` | variable | | `false` (Relay is not built) |
| `CONTENT_READ_RATE_LIMIT`, `CONTENT_OPPORTUNISTIC_TICK` | variables | | Defaults 600 a minute and `true` |

Production refuses to start when a set value is weak (`config/content_validation.py`): every secret in a key list must be at least 32 characters with a key id matching `[a-z0-9-]{1,32}`, every `CONTENT_WEB_TARGETS` entry must be https, and `CONTENT_IP_SALT` (32+ characters) is required once `CAREERS_SUBMIT_CLIENT_KEYS` is set. Each key list is `keyId:secret[,keyId:secret...]`. To rotate with no downtime: add the new entry **after** the old one on the receiving side, deploy both apps, move the new entry **first** on the signing side, deploy, then remove the old entry everywhere. Never print the values; set them with `az containerapp secret set` or through the deploy workflow only.

### Object storage (Cloudflare R2, free tier)

- `CONTENT_MEDIA_BUCKET`: public read through a custom domain or the bucket's public URL, which becomes `CONTENT_MEDIA_PUBLIC_BASE_URL`. Keys are `content/{uuid}.{ext}`.
- `CAREERS_CV_BUCKET`: **private**, no public access. The browser uploads straight to it with a pre-signed PUT, so it needs this CORS rule (website origins only, PUT only):

```json
[
  {
    "AllowedOrigins": ["https://www.vitalos.co.uk", "https://vitalos.co.uk"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 600
  }
]
```

Add preview origins only for the bucket a preview deployment uses. The access key in `OBJECT_STORAGE_*` needs object read and write on both buckets.

### Content tick job (prepared; do not create without owner approval)

The tick (`manage.py content_tick`) promotes scheduled posts, closes roles past their closing date, retries website sync and sends held-back application alerts; once a day it also runs application retention (a dry run until `RETENTION_ENFORCE=true`) and purges unused CV uploads older than 24 hours (always for real: they are not retention-policy data). Today it runs opportunistically inside the app and from the website's signed `POST /api/content/v1/tick` (ADR-042). A per-minute Container Apps job would be:

```sh
RG=rg-vitalos-superadmin
IMAGE="$(az containerapp show -n superadmin -g "$RG" --query 'properties.template.containers[0].image' -o tsv)"
secret() { az containerapp secret show -n superadmin -g "$RG" --secret-name "$1" --query value -o tsv; }

az containerapp job create -n superadmin-content-tick -g "$RG" --environment cae-vitalos-superadmin \
  --trigger-type Schedule --cron-expression "* * * * *" \
  --replica-timeout 120 --replica-retry-limit 0 --parallelism 1 --replica-completion-count 1 \
  --image "$IMAGE" --cpu 0.25 --memory 0.5Gi \
  --command python --args "manage.py" "content_tick" \
  --secrets "django-secret-key=$(secret django-secret-key)" "database-url=$(secret database-url)" \
            "content-revalidate-secret=$(secret content-revalidate-secret)" \
  --env-vars DJANGO_SETTINGS_MODULE=config.settings.prod DJANGO_SECRET_KEY=secretref:django-secret-key \
             DATABASE_URL=secretref:database-url CONTENT_REVALIDATE_SECRET=secretref:content-revalidate-secret \
             CONTENT_WEB_TARGETS="<same as the app>" APP_ENVIRONMENT=production \
             APP_BASE_URL=https://admin.vitalos.co.uk ALLOWED_HOSTS=admin.vitalos.co.uk \
             CSRF_TRUSTED_ORIGINS=https://admin.vitalos.co.uk
```

Add the mail variables (`EMAIL_TRANSPORT`, `RESEND_API_KEY` as a `secretref:`) and the object storage ones if the job should send alerts and run retention. After each image deploy, update the job image.

**Cost note.** Every minute is about 43,200 runs a month. At 0.25 vCPU and 0.5 GiB and roughly 15 seconds a run, that is about 160,000 vCPU-seconds and 320,000 GiB-seconds a month, nearly the whole free grant (180,000 vCPU-seconds and 360,000 GiB-seconds, shared with the app), and it keeps the free-tier database awake around the clock. It would exceed the grant together with the app, so it needs owner approval before it is created.

### Importing a batch of approved Insights

`manage.py import_insights_batch FOLDER` imports `NN-slug.md` files (YAML front matter, then Markdown) through the editorial workflow and publishes each post with its original date (`docs/content/DECISIONS.md` 126 to 134). It is a dry run unless `--apply` is given, and any problem stops the whole run before anything is written. The image holds only `superadmin/`, so a batch to run in production is committed under `apps/insights/imports/` (batch 2 is `apps/insights/imports/insights-batch-2`, kept identical to `docs/content/imports/insights-batch-2` by a test) and deployed first.

Production runs it as an execution of the release job, which has the app's database and content settings, with the command overridden:

```sh
RG=rg-vitalos-superadmin
BATCH=apps/insights/imports/insights-batch-2
# 1. Dry run: checks every file and the renderer, writes nothing.
az containerapp job start -n superadmin-release -g "$RG" --command python --args manage.py import_insights_batch "$BATCH"
# 2. Import and publish, acting as the owner's admin user (the default --as-user).
az containerapp job start -n superadmin-release -g "$RG" --command python --args manage.py import_insights_batch "$BATCH" --apply --status published
az containerapp job execution list -n superadmin-release -g "$RG" -o table
```

Read the report in the execution's console logs (Log Analytics, `ContainerAppConsoleLogs_CL` for job `superadmin-release`). Publishing emits one sync event per post; the website's tick delivers any that did not go through at once, and **Settings › Content sync** shows them. Running the same batch again changes nothing.

## 10. Product Pipeline (ADR-044)

The Product Pipeline shows each Vitalos product's live status and opens the product's own superadmin. Askbridge, Answerd, Vitalos Workforce and TipSignal are listed. Without a status token a card says "Status not configured" and no request is made; nothing else changes.

| Name | Kind | Container Apps secret | What |
| ---- | ---- | --------------------- | ---- |
| `ASKBRIDGE_STATUS_TOKEN` | secret | `askbridge-status-token` | Bearer token the Askbridge status endpoint accepts (32+ random characters; Askbridge holds the same value) |
| `ASKBRIDGE_STATUS_URL` | variable | | Default `https://askbridge.vitalos.co.uk/api/platform/v1/status`; must be https in production |
| `ASKBRIDGE_SUPERADMIN_URL` | variable | | Default `https://askbridge.vitalos.co.uk/superadmin`; must be https in production |
| `ANSWERD_STATUS_URL`, `ANSWERD_STATUS_TOKEN` | variable, secret | `answerd-status-token` | Empty by default (no status endpoint yet) |
| `ANSWERD_SUPERADMIN_URL` | variable | | Default `https://answerd-demo.vitalos.co.uk/admin` (the prototype's admin console); must be https in production |
| `WORKFORCE_STATUS_URL`, `WORKFORCE_STATUS_TOKEN`, `WORKFORCE_SUPERADMIN_URL` | variable, secret, variable | `workforce-status-token` | All empty by default: "Status not configured" and no Open button |
| `TIPSIGNAL_STATUS_URL`, `TIPSIGNAL_STATUS_TOKEN`, `TIPSIGNAL_SUPERADMIN_URL` | variable, secret, variable | `tipsignal-status-token` | All empty by default; the TipSignal admin is Tailscale-only, so set an https superadmin address only if one is published |

`deploy/azure/deploy.sh` passes each one through when the deploy workflow provides a non-empty value. The deploy workflow (`.github/workflows/superadmin-deploy.yml`) must also map them from the GitHub `production` environment before a deploy can set them; until then set the secret once with `az containerapp secret set` and `az containerapp update --set-env-vars ASKBRIDGE_STATUS_TOKEN=secretref:askbridge-status-token`. Never print the value.

Access: SuperAdmins see everything. For anyone else, `python manage.py product_access --email <email> --grant view_product_pipeline` (see the section) and `--grant open_askbridge_superadmin`, `open_answerd_superadmin`, `open_workforce_superadmin` or `open_tipsignal_superadmin` (that product's counts, alerts and Open button). Run it in the release job's container or through `az containerapp exec`; each grant and revoke is in the audit trail.
