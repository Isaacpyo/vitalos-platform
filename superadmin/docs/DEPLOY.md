# Deploying the Vitalos Super Admin (zero monthly cost)

Target: **https://admin.vitalos.co.uk**. Expected cost: **£0.00 per month.**

| Piece            | Service                                                                    | Why it is free                                                   |
| ---------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| App              | Azure Container Apps, consumption plan, UK South, scale to zero            | Inside the monthly Container Apps free grant                     |
| Database         | Neon PostgreSQL 17, free plan, AWS eu-west-2 (London)                      | Neon free plan                                                   |
| Image            | GitHub Container Registry (ghcr.io), private package                       | GitHub Packages included quota (3 versions kept)                 |
| DNS              | Cloudflare free plan, `admin` CNAME (DNS only)                             | Cloudflare free                                                  |
| TLS              | Azure Container Apps managed certificate                                   | No charge                                                        |
| Secrets          | Container Apps secrets                                                     | No charge (no Key Vault)                                         |
| Logs             | Log Analytics, daily cap 0.1 GB, 31-day retention                          | First 5 GB/month and 31 days are free                            |
| Backups          | Neon history + daily `pg_dump` artifact in GitHub Actions (14 days)        | Actions minutes and artifact storage included                    |
| Deploy           | GitHub Actions `Super Admin deploy`, Azure OIDC                            | Actions minutes included                                         |

## Status

**Not live yet.** The build session had no Azure, Neon or Cloudflare credentials, and it did not use the sandbox's own cloud credentials, which are not Vitalos's. Everything else is built and verified:

- the app and its CI (tests, deploy checks, image build, browser smoke test against the production container);
- a dump-and-restore round trip;
- `shellcheck` and `actionlint`;
- every Azure CLI flag, checked against `az` 2.91;
- the deploy script's control flow, exercised end to end with a stubbed `az`.

The real deploy is the "What Temitope does once" checklist below.

## What Temitope does once

1. **Neon.** At https://neon.tech, create a free project named `vitalos-superadmin`, with region **AWS Europe West 2 (London)** and **PostgreSQL 17**. On the dashboard, open **Connect**, tick **Connection pooling**, and copy the connection string. Its host contains `-pooler` and it ends in `?sslmode=require`. That is `DATABASE_URL`.
   - Recommended, for backups: **Roles → New role** `backup_reader`. In the SQL editor, run `GRANT pg_read_all_data TO backup_reader;`. Then copy that role's connection string as the backup `DATABASE_URL` in step 4.
2. **Cloudflare.** Confirm vitalos.co.uk is active on Cloudflare's free plan: `dig +short NS vitalos.co.uk` shows `*.ns.cloudflare.com`. If it doesn't, add the site in Cloudflare and change the nameservers at the registrar first. Then create a token under **My Profile → API Tokens → Create Token → "Edit zone DNS"**, with **Zone Resources: Include → Specific zone → vitalos.co.uk**. That is `CLOUDFLARE_API_TOKEN`.
3. **Azure.** Run the §2.1 one-time setup as subscription Owner. A card on file is required, but nothing is charged within the free grant.
4. **GitHub.** Go to **Settings → Environments**.
   - `production`: add yourself as a **required reviewer**. Add the secrets `DATABASE_URL` (step 1), `CLOUDFLARE_API_TOKEN` (step 2), `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` (printed by §2.1), and `GHCR_PULL_TOKEN`. Optionally add `SENTRY_DSN`.
     - `GHCR_PULL_TOKEN` is a classic PAT with only the **read:packages** scope (**Settings → Developer settings → Personal access tokens (classic)**), with a 1-year expiry and a calendar reminder.
     - If the PAT owner isn't the repository owner, also add the variable `GHCR_USERNAME`.
   - `backup` (no reviewers): add `DATABASE_URL` (the `backup_reader` string, or the same one as production). Optionally add `BACKUP_PASSPHRASE` to encrypt dumps; recommended.
5. **Deploy.** Merge PR #50. Open **Actions → Super Admin deploy → Run workflow** on `main`, type `DEPLOY`, tick **smoke test** (first run only), and approve the `production` gate.

The **plan** job prints everything it will create and the expected cost (£0.00) before anything changes. The run ends when https://admin.vitalos.co.uk answers with a valid certificate, then the live smoke test runs. Without `CLOUDFLARE_API_TOKEN`, the run prints two DNS records and stops successfully. Create the records, then run the workflow again; it carries on from the DNS step.

## 1. What gets created

All of it is in **`rg-vitalos-superadmin`**, region **`uksouth`**:

| Resource                      | Name                      | Created by     | Settings                                                                      |
| ----------------------------- | ------------------------- | -------------- | ----------------------------------------------------------------------------- |
| Resource group                | `rg-vitalos-superadmin`   | §2.1 (once)    |                                                                               |
| Log Analytics workspace       | `log-vitalos-superadmin`  | §2.1 (once)    | PerGB2018, daily cap **0.1 GB**, 30-day retention                             |
| Container Apps environment    | `cae-vitalos-superadmin`  | §2.1 (once)    | **Consumption only** (no workload profiles)                                   |
| OIDC app registration         | `github-vitalos-superadmin-deploy` | §2.1 (once) | Federated with the GitHub `production` environment; **Contributor on the RG** |
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
| `database-url`             | `DATABASE_URL`             | GitHub `production` secret (Neon pooled); re-applied every deploy          |
| registry password          | (none; image pull)         | GitHub `production` secret `GHCR_PULL_TOKEN`; re-applied every deploy      |
| `sentry-dsn` (optional)    | `SENTRY_DSN`               | GitHub `production` secret                                                 |

Plain environment variables: `DJANGO_SETTINGS_MODULE=config.settings.prod`, `ALLOWED_HOSTS=admin.vitalos.co.uk`, `CSRF_TRUSTED_ORIGINS=https://admin.vitalos.co.uk`, `SECURE_SSL_REDIRECT=True`, `TRUSTED_PROXY_COUNT=1`, `APP_ENVIRONMENT=production`, `LOG_FORMAT=json` and `WEB_CONCURRENCY=2`. The release job also gets `BOOTSTRAP_ADMIN_EMAIL=superadmin-owner@example.invalid`. The prod settings use `CONN_MAX_AGE=0`, connection health checks, and no server-side cursors, which suits Neon autosuspend and PgBouncer.

## 2. Azure setup (subscription Owner, once)

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
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-production-environment",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:Isaacpyo/vitalos-platform:environment:production",
  "audiences": ["api://AzureADTokenExchange"]}'
az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
  --role Contributor --scope "$(az group show -n "$RG" --query id -o tsv)"

echo "AZURE_CLIENT_ID=$APP_ID AZURE_TENANT_ID=$(az account show --query tenantId -o tsv) AZURE_SUBSCRIPTION_ID=$SUB"
```

None of the three printed values is secret. Store them as environment secrets anyway, as the workflow expects.

### 2.2 £1 budget alert (free tripwire)

In the Azure portal, go to **Cost Management + Billing → Budgets → Add**:

- Scope: the subscription. Amount: **£1**, monthly.
- Alert conditions: **Actual 100%** and **Forecasted 100%**, emailed to superadmin-owner@example.invalid.

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

The trade-off is **cold starts**. After about 5 idle minutes, the first request waits a few seconds while a replica starts. That can include pulling the image (about 95 MB) and waking Neon. Later requests are fast.

## 3. Verify and first sign-in

```sh
curl -sS https://admin.vitalos.co.uk/healthz/                  # {"status": "ok"} (may take a few seconds when cold)
curl -sSI https://admin.vitalos.co.uk/login/ | grep -iE 'HTTP/|strict-transport|content-security'
```

The bootstrap password lives only in the Container Apps secret `bootstrap-admin-password`. **Retrieve it once** (as Contributor or Owner on the resource group):

```sh
az containerapp secret show -n superadmin -g rg-vitalos-superadmin --secret-name bootstrap-admin-password --query value -o tsv
```

1. Open https://admin.vitalos.co.uk and sign in as `superadmin-owner@example.invalid`.
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

## 5. Redeploy and roll back

**Redeploy:** run **Super Admin deploy** again from the commit you want. It builds `ghcr.io/<owner>/vitalos-superadmin:<sha>` and runs the release job (migrations first). Then it updates the app. Secrets and the domain binding are kept, and the 3 newest images are retained.

**Roll back the code** to one of the 3 retained images:

```sh
az containerapp update -n superadmin -g rg-vitalos-superadmin --image ghcr.io/isaacpyo/vitalos-superadmin:<previous sha>
```

Migrations only move forward. They are additive in this project. If a migration must be undone, restore the database (§6). Never drop tables by hand.

**Take it offline quickly, without deleting anything:**

```sh
az containerapp ingress disable -n superadmin -g rg-vitalos-superadmin
```

To remove the DNS record, delete the `admin` CNAME in Cloudflare.

## 6. Backups and restore

There are two layers:

1. **Neon history (point in time).** The free plan keeps 6 hours of history at the time of writing. In the Neon console, go to **Branches → Restore**. Restore `main` to a timestamp, or better, create a branch at that timestamp, inspect it, then promote it. Use this for "undo the last few hours".
2. **Daily dump.** `.github/workflows/backup.yml` runs at 02:00 UTC (once on `main`), or on demand with **Actions → Super Admin backup → Run workflow**. Each run uploads `superadmin-db-<UTC timestamp>` with a gzipped plain SQL dump, encrypted as `.gpg` if `BACKUP_PASSPHRASE` is set. Artifacts are kept **14 days**.

Restore a daily dump into an **empty** Neon database or branch, using its **direct** (non-pooler) connection string:

```sh
gh run download <run-id> -n superadmin-db-<timestamp>              # or download the artifact in the browser
# if encrypted: gpg --decrypt superadmin-<timestamp>.sql.gz.gpg > superadmin-<timestamp>.sql.gz
gunzip -c superadmin-<timestamp>.sql.gz | docker run --rm -i postgres:17 psql "<direct connection string>" -v ON_ERROR_STOP=1
```

Then point the app at the restored database. Update the GitHub `production` secret `DATABASE_URL` to the new pooled string and redeploy. Or apply it immediately with:

```sh
az containerapp secret set -n superadmin -g rg-vitalos-superadmin --secrets database-url=<pooled string>
```

followed by a revision restart.

## 7. Operations

```sh
az containerapp logs show -n superadmin -g rg-vitalos-superadmin --follow     # JSON lines with request_id
az containerapp job execution list -n superadmin-release -g rg-vitalos-superadmin -o table
```

- **Errors:** every response carries `X-Request-ID`; search for it in Log Analytics. Set `SENTRY_DSN` in the `production` environment and redeploy to report errors; no personal data is sent.
- **Rotating secrets:**
  - Database: change the role password in Neon, update `DATABASE_URL`, and redeploy.
  - Pull token: create a new PAT, update `GHCR_PULL_TOKEN`, and redeploy.
  - Django key: `az containerapp secret set ... --secrets django-secret-key=<new>` on both the app and the job. This signs everyone out.
- **Staying at £0:**
  - Do not add an external uptime monitor. `/healthz/` touches the database and would keep Neon and the app awake.
  - If a cold start ever fails to pull the image, check GitHub **Settings → Billing → Packages**. Private-package transfer on GitHub Free is 1 GB/month (about 10 cold pulls). Make the package public, or move to a paid tier (PHASE2.md).
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
