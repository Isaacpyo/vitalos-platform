#!/usr/bin/env bash
# Deploy the Vitalos Super Admin to Azure Container Apps (consumption plan, UK South) at zero monthly
# cost: scale-to-zero inside the Container Apps free grant, free-tier PostgreSQL (Supabase by default, or
# Neon), the image on ghcr.io, Cloudflare free DNS and an Azure managed (free) TLS certificate for admin.vitalos.co.uk.
#
#   superadmin/deploy/azure/deploy.sh --dry-run   # print the plan and expected cost; calls nothing
#   superadmin/deploy/azure/deploy.sh             # deploy (normally run by the "Super Admin deploy" workflow)
#
# Idempotent and resumable: existing resources are updated, never deleted, and the Django secret key
# and bootstrap password are generated once and then kept. Secret values are never printed (and are
# registered with the GitHub Actions log masker when running in Actions).
#
# Prerequisites (DEPLOY.md §2.1, done once by the subscription Owner): resource group, consumption-only
# Container Apps environment and Log Analytics workspace already exist; the deploying identity has
# Contributor on the resource group.
#
# Environment for a real run:
#   AZ_SUBSCRIPTION            Azure subscription ID
#   IMAGE                      image to deploy, e.g. ghcr.io/isaacpyo/vitalos-platform/superadmin:<git sha>
#                              (a public ghcr.io package: pulled anonymously, no registry credentials)
#   DATABASE_URL               Supabase session pooler (port 5432) or Neon pooled connection string,
#                              with sslmode=require
#   NEW_DJANGO_SECRET_KEY, NEW_BOOTSTRAP_ADMIN_PASSWORD   used only when the app has none yet
# Optional: CLOUDFLARE_API_TOKEN (zone-scoped DNS:Edit; without it the DNS records are printed and the
# run stops before binding the domain), DNS_OVERWRITE=1, SENTRY_DSN.
# Required: BOOTSTRAP_ADMIN_EMAIL (bootstrap admin sign-in; a secret so it stays out of public logs).
# Optional mail and enquiry settings (superadmin/docs/email-setup.md), each passed through only when set:
#   plain variables  PRIMARY_OWNER_EMAIL (also reaches the release job), EMAIL_TRANSPORT, INBOUND_PROVIDER,
#                    NOTIFY_OWNER_EMAIL, OBJECT_STORAGE_ENDPOINT, OBJECT_STORAGE_BUCKET,
#                    OBJECT_STORAGE_REGION, RETENTION_ENFORCE, RELAY_API_BASE_URL, RELAY_REALTIME_ENABLED,
#                    RELAY_EMAIL_FROM, OUTREACH_MAILBOX, OUTREACH_GRAPH_TENANT_ID, OUTREACH_GRAPH_CLIENT_ID,
#                    OUTREACH_SMTP_HOST, OUTREACH_SMTP_PORT, OUTREACH_SMTP_USER
#   secrets          RESEND_API_KEY, RESEND_WEBHOOK_SECRET, INBOUND_WEBHOOK_SECRET, TURNSTILE_SECRET_KEY,
#                    OBJECT_STORAGE_ACCESS_KEY_ID, OBJECT_STORAGE_SECRET_ACCESS_KEY, SLACK_WEBHOOK_URL,
#                    RELAY_ADMIN_API_SECRET, RELAY_WEBHOOK_SECRET, OUTREACH_GRAPH_CLIENT_SECRET,
#                    OUTREACH_SMTP_PASSWORD
#                    (Container Apps secrets, referenced with secretref:; an empty value never overwrites
#                    a secret that is already stored). APP_BASE_URL is always https://<domain>.
# Optional Insights and Careers settings (docs/DEPLOY.md, "Content (Insights and Careers)"), same rules:
#   plain variables  CONTENT_WEB_TARGETS, CONTENT_MEDIA_BUCKET, CONTENT_MEDIA_PUBLIC_BASE_URL, CAREERS_CV_BUCKET,
#                    CAREERS_CV_MAX_MB, CAREERS_EMAIL_FROM, CAREERS_CANDIDATE_EMAILS_ENABLED,
#                    CONTENT_RELAY_SYNC_ENABLED, CONTENT_READ_RATE_LIMIT, CONTENT_OPPORTUNISTIC_TICK
#   secrets          CONTENT_READ_CLIENT_KEYS, CAREERS_SUBMIT_CLIENT_KEYS, CONTENT_REVALIDATE_SECRET,
#                    CONTENT_RENDER_SECRET, CONTENT_PREVIEW_SECRET, CONTENT_IP_SALT
# Optional Product Pipeline settings (docs/DEPLOY.md section 10, ADR-044), same rules:
#   plain variables  ASKBRIDGE_STATUS_URL, ASKBRIDGE_SUPERADMIN_URL
#   secrets          ASKBRIDGE_STATUS_TOKEN
# Optional Vitalos AI & Data model settings (ADR-052, docs/ai-data/operations/runbook.md), same rules:
#   plain variables  AI_DATA_LLM_BASE_URL, AI_DATA_LLM_MODEL, AI_DATA_DISABLED
#   secrets          AI_DATA_LLM_API_KEY
# Optional Billing settings (superadmin/apps/billing/README.md), same rules:
#   plain variables  BILLING_PUBLIC_SITE_URL
#   secrets          BILLING_STRIPE_SECRET_KEY, BILLING_STRIPE_WEBHOOK_SECRET
set -euo pipefail

DRY_RUN=0
case "${1:-}" in
  --dry-run) DRY_RUN=1 ;;
  "") ;;
  *) echo "usage: $0 [--dry-run]" >&2; exit 2 ;;
esac

LOCATION="${AZ_LOCATION:-uksouth}"
RG="${AZ_RESOURCE_GROUP:-rg-vitalos-superadmin}"
CAE="${AZ_CONTAINERAPPS_ENV:-cae-vitalos-superadmin}"
LOG_WS="${AZ_LOG_WORKSPACE:-log-vitalos-superadmin}"
APP="${AZ_APP:-superadmin}"
RELEASE_JOB="${APP}-release"
DOMAIN="${CUSTOM_DOMAIN:-admin.vitalos.co.uk}"
ZONE="${DNS_ZONE:-vitalos.co.uk}"
ADMIN_EMAIL="${BOOTSTRAP_ADMIN_EMAIL:?BOOTSTRAP_ADMIN_EMAIL is required (the bootstrap admin sign-in email)}"
CPU="0.25"
MEMORY="0.5Gi"
HTTP_CONCURRENCY="50"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
quiet() { "$@" --output none --only-show-errors; }
exists() { "$@" --output none --only-show-errors >/dev/null 2>&1; }
# In GitHub Actions, register values with the log masker so they can never appear in job output.
mask() { if [ "${GITHUB_ACTIONS:-}" = "true" ] && [ -n "$1" ]; then printf '::add-mask::%s\n' "$1"; fi; }
output() { if [ -n "${GITHUB_OUTPUT:-}" ]; then printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"; fi; }

plan() {
  cat <<EOF
Vitalos Super Admin: deployment plan (dry run, nothing is created or changed)

Subscription        ${AZ_SUBSCRIPTION:-<AZURE_SUBSCRIPTION_ID from the production environment>}
Region              $LOCATION
Resource group      $RG   (exists: created once in DEPLOY.md §2.1)
Log Analytics       $LOG_WS   (exists: §2.1, daily cap 0.1 GB, 31-day retention)
Container Apps env  $CAE   (exists: §2.1, consumption only, no workload profiles)

Will create or update:
  1. Container Apps job  $RELEASE_JOB
       manual trigger; runs /app/bin/release.sh (migrate, seed_architecture, create_superadmin,
       each retried 3x with backoff for database cold starts); $CPU vCPU / $MEMORY; runs for seconds per deploy
  2. Container app       $APP
       image ${IMAGE:-ghcr.io/<owner>/vitalos-platform/superadmin:<git sha>} pulled anonymously (public package)
       external ingress :8000; min replicas 0, max replicas 1 (scale to zero); $CPU vCPU / $MEMORY
       scale rule: HTTP concurrency $HTTP_CONCURRENCY
  3. Container Apps secrets on both (values never printed):
       django-secret-key, bootstrap-admin-password (generated once, then kept),
       database-url (Supabase session pooler or Neon pooled, from the GitHub production environment);
       no registry credentials
       Optional, added only when the workflow provides a non-empty value (an existing secret is never
       overwritten with an empty one): sentry-dsn, resend-api-key, resend-webhook-secret,
       inbound-webhook-secret, turnstile-secret-key, object-storage-access-key-id,
       object-storage-secret-access-key, slack-webhook-url
       Environment variables: APP_BASE_URL=https://${DOMAIN} always; PRIMARY_OWNER_EMAIL (release job too),
       EMAIL_TRANSPORT, INBOUND_PROVIDER, NOTIFY_OWNER_EMAIL, OBJECT_STORAGE_ENDPOINT/BUCKET/REGION and
       RETENTION_ENFORCE only when provided (mail stays EMAIL_TRANSPORT=log until a human sets resend)
  4. Cloudflare DNS (zone $ZONE, DNS only / grey cloud, TTL 300):
       CNAME ${DOMAIN%%."$ZONE"} -> <app FQDN>.$LOCATION.azurecontainerapps.io
       TXT   asuid.${DOMAIN%%."$ZONE"} -> <custom domain verification ID>
       (no CLOUDFLARE_API_TOKEN: the two records are printed and the run stops here, resumable)
  5. Custom domain $DOMAIN + Azure managed certificate (free), CNAME validation

Not created (zero-cost design): no container registry (public ghcr.io package), no managed PostgreSQL
(Supabase or Neon free), no Key Vault (Container Apps secrets), no storage account (backups run in GitHub Actions).

Expected monthly cost: £0.00
Free-grant assumptions (per subscription per month; check Azure Cost Management, budget alert £1):
  - Container Apps consumption: 180,000 vCPU-s, 360,000 GiB-s and 2 million requests free.
    One $CPU vCPU / $MEMORY replica uses both grants at the same rate: 180,000 / $CPU = 720,000 s ~= 200 h/month.
    Scaled to zero when idle, an internal tool stays far below that; release-job runs are seconds.
  - Log Analytics: first 5 GB/month ingestion and 31 days retention free; daily cap 0.1 GB (~3 GB/month).
  - Optional notification job (not created by this script; email-setup.md section 8): about 8,600 short runs a
    month, estimated at roughly 32,000 vCPU-s and 65,000 GiB-s, which should stay inside the same grants.
  - Managed certificate and the consumption-only environment: no charge.
  - Supabase free plan (500 MB database; paused after 7 days without activity, which the nightly backup
    prevents) or Neon free plan (0.5 GB, autosuspend after 5 min); Cloudflare free DNS; GitHub Packages
    and Actions within the plan's included quotas: no charge (public packages have no transfer quota).
EOF
}

if [ "$DRY_RUN" = 1 ]; then
  plan
  exit 0
fi

: "${AZ_SUBSCRIPTION:?Set AZ_SUBSCRIPTION}"
: "${IMAGE:?Set IMAGE to the ghcr.io image to deploy}"
: "${DATABASE_URL:?Set DATABASE_URL to the Supabase session pooler (or Neon pooled) connection string}"
mask "$DATABASE_URL"
case "$DATABASE_URL" in *sslmode=require*) ;; *) die "DATABASE_URL must include sslmode=require" ;; esac
# Supabase's direct host (db.<ref>.supabase.co) is IPv6-only, and Container Apps has no IPv6 egress.
case "$DATABASE_URL" in
  *@db.*.supabase.co*) die "DATABASE_URL uses the Supabase direct host, which is IPv6-only and unreachable from Container Apps. Use Connect -> Session pooler (port 5432) instead (DEPLOY.md)." ;;
esac
# An unescaped /, ?, # or @ in the password moves part of it into the path or host, so Django sees a wrong
# database name and the release job fails inside Azure (and logs that fragment). Never print the URL here.
_db_rest=${DATABASE_URL#*://}
_db_authority=${_db_rest%%[/?#]*}
case "${_db_rest#"$_db_authority"}" in
  *@*) die "DATABASE_URL password contains an unescaped /, ? or #: URL-encode it, or use an openssl rand -hex 24 password (DEPLOY.md §2.3)." ;;
esac
case "$_db_authority" in
  *@*@*) die "DATABASE_URL has more than one @ before the host: URL-encode the password, or use an openssl rand -hex 24 password (DEPLOY.md §2.3)." ;;
  *@?*) ;;
  *) die "DATABASE_URL has no user@host part: use the full connection string from the provider (DEPLOY.md §2.3)." ;;
esac
unset _db_rest _db_authority

# The app pulls the image anonymously, so the ghcr.io package must be public. Check before touching
# Azure, so a private package fails here with instructions instead of as a stuck revision.
check_public_image() {
  local ref="${IMAGE#ghcr.io/}" repo tag token code
  [ "$ref" != "$IMAGE" ] || die "IMAGE must be a ghcr.io image (got $IMAGE)"
  repo="${ref%:*}"; tag="${ref##*:}"
  [ "$repo" != "$ref" ] || die "IMAGE must include a tag (got $IMAGE)"
  token="$(curl -fsS "https://ghcr.io/token?scope=repository:$repo:pull" 2>/dev/null \
    | sed -n 's/.*"token":"\([^"]*\)".*/\1/p' || true)"
  code="$(curl -sS -o /dev/null -w '%{http_code}' -I -H "Authorization: Bearer $token" \
    -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json' \
    "https://ghcr.io/v2/$repo/manifests/$tag" || true)"
  [ "$code" = 200 ] || die "ghcr.io/$repo:$tag cannot be pulled anonymously (HTTP ${code:-none}). Make the package public once:
  https://github.com/users/${repo%%/*}/packages/container/$(printf '%s' "${repo#*/}" | sed 's|/|%2F|g')/settings
  -> Danger Zone -> Change visibility -> Public (DEPLOY.md, 'What Temitope does once'), then re-run the deploy."
}
log "Checking $IMAGE is publicly pullable"
check_public_image

wait_for_job() {  # job name, execution name
  local status attempt
  for attempt in $(seq 1 90); do
    status="$(az containerapp job execution show -n "$1" -g "$RG" --job-execution-name "$2" \
      --query properties.status -o tsv --only-show-errors 2>/dev/null || true)"
    case "$status" in
      Succeeded) log "$1 execution $2 succeeded"; return 0 ;;
      Failed | Stopped | Degraded) die "$1 execution $2 ended with status $status (see Log Analytics)" ;;
    esac
    sleep 10
  done
  die "$1 execution $2 did not finish within 15 minutes (attempt $attempt)"
}

read_secret() {  # target variable, "app"|"job", resource name, secret name. Empty if absent.
  local -n _target="$1"
  if [ "$2" = job ]; then
    _target="$(az containerapp job secret show -n "$3" -g "$RG" --secret-name "$4" --query value -o tsv --only-show-errors 2>/dev/null || true)"
  else
    _target="$(az containerapp secret show -n "$3" -g "$RG" --secret-name "$4" --query value -o tsv --only-show-errors 2>/dev/null || true)"
  fi
  mask "$_target"
}

# ------------------------------------------------------------------------------------------------
log "Checking prerequisites in $RG ($LOCATION)"
quiet az account set --subscription "$AZ_SUBSCRIPTION"
exists az group show -n "$RG" || die "resource group $RG not found: run DEPLOY.md §2.1 first"
exists az containerapp env show -n "$CAE" -g "$RG" || die "Container Apps environment $CAE not found: run DEPLOY.md §2.1 first"
if [ -n "$(az containerapp env show -n "$CAE" -g "$RG" --query "properties.workloadProfiles[?name!='Consumption'].name" -o tsv 2>/dev/null)" ]; then
  die "$CAE has dedicated workload profiles; the zero-cost design needs a consumption-only environment"
fi
APP_EXISTS=0; exists az containerapp show -n "$APP" -g "$RG" && APP_EXISTS=1
JOB_EXISTS=0; exists az containerapp job show -n "$RELEASE_JOB" -g "$RG" && JOB_EXISTS=1

log "Resolving secrets (generated once, then kept)"
resolve() {  # target variable, secret name, newly generated fallback (assigned, never echoed)
  local -n _value="$1"
  _value=""
  if [ "$APP_EXISTS" = 1 ]; then read_secret _value app "$APP" "$2"; fi
  if [ -z "$_value" ] && [ "$JOB_EXISTS" = 1 ]; then read_secret _value job "$RELEASE_JOB" "$2"; fi
  if [ -z "$_value" ]; then _value="$3"; fi
  [ -n "$_value" ] || die "no value for $2: the workflow must provide it on the first deploy"
  mask "$_value"
}
SECRET_KEY=""
ADMIN_PASSWORD=""
resolve SECRET_KEY django-secret-key "${NEW_DJANGO_SECRET_KEY:-}"
resolve ADMIN_PASSWORD bootstrap-admin-password "${NEW_BOOTSTRAP_ADMIN_PASSWORD:-}"
[ "${#SECRET_KEY}" -ge 50 ] || die "django-secret-key must be at least 50 characters"

SECRETS=(
  "django-secret-key=$SECRET_KEY"
  "database-url=$DATABASE_URL"
  "bootstrap-admin-password=$ADMIN_PASSWORD"
)
ENV_VARS=(
  DJANGO_SETTINGS_MODULE=config.settings.prod
  DJANGO_SECRET_KEY=secretref:django-secret-key
  DATABASE_URL=secretref:database-url
  "ALLOWED_HOSTS=$DOMAIN"
  "CSRF_TRUSTED_ORIGINS=https://$DOMAIN"
  SECURE_SSL_REDIRECT=True
  TRUSTED_PROXY_COUNT=1
  APP_ENVIRONMENT=production
  LOG_FORMAT=json
  WEB_CONCURRENCY=2
)
if [ -n "${SENTRY_DSN:-}" ]; then
  mask "$SENTRY_DSN"
  SECRETS+=("sentry-dsn=$SENTRY_DSN")
  ENV_VARS+=(SENTRY_DSN=secretref:sentry-dsn)
fi
ENV_VARS+=("APP_BASE_URL=https://$DOMAIN")

# Optional mail and enquiry settings. Added only when the workflow provides a non-empty value, so a deploy
# without them leaves whatever the app already holds untouched (az keeps existing secrets and variables).
for _name in PRIMARY_OWNER_EMAIL EMAIL_TRANSPORT INBOUND_PROVIDER NOTIFY_OWNER_EMAIL \
  OBJECT_STORAGE_ENDPOINT OBJECT_STORAGE_BUCKET OBJECT_STORAGE_REGION RETENTION_ENFORCE \
  CONTENT_WEB_TARGETS CONTENT_MEDIA_BUCKET CONTENT_MEDIA_PUBLIC_BASE_URL CAREERS_CV_BUCKET CAREERS_CV_MAX_MB \
  CAREERS_EMAIL_FROM CAREERS_CANDIDATE_EMAILS_ENABLED CONTENT_RELAY_SYNC_ENABLED CONTENT_READ_RATE_LIMIT \
  CONTENT_OPPORTUNISTIC_TICK \
  RELAY_API_BASE_URL RELAY_REALTIME_ENABLED RELAY_EMAIL_FROM \
  OUTREACH_MAILBOX OUTREACH_GRAPH_TENANT_ID OUTREACH_GRAPH_CLIENT_ID \
  OUTREACH_SMTP_HOST OUTREACH_SMTP_PORT OUTREACH_SMTP_USER \
  ASKBRIDGE_STATUS_URL ASKBRIDGE_SUPERADMIN_URL \
  AI_DATA_LLM_BASE_URL AI_DATA_LLM_MODEL AI_DATA_DISABLED \
  BILLING_PUBLIC_SITE_URL; do
  if [ -n "${!_name:-}" ]; then ENV_VARS+=("$_name=${!_name}"); fi
done
add_optional_secret() {  # env var name, Container Apps secret name
  local value="${!1:-}"
  if [ -n "$value" ]; then
    mask "$value"
    SECRETS+=("$2=$value")
    ENV_VARS+=("$1=secretref:$2")
  fi
}
add_optional_secret RESEND_API_KEY resend-api-key
add_optional_secret RESEND_WEBHOOK_SECRET resend-webhook-secret
add_optional_secret INBOUND_WEBHOOK_SECRET inbound-webhook-secret
add_optional_secret TURNSTILE_SECRET_KEY turnstile-secret-key
add_optional_secret OBJECT_STORAGE_ACCESS_KEY_ID object-storage-access-key-id
add_optional_secret OBJECT_STORAGE_SECRET_ACCESS_KEY object-storage-secret-access-key
add_optional_secret SLACK_WEBHOOK_URL slack-webhook-url
add_optional_secret OUTREACH_GRAPH_CLIENT_SECRET outreach-graph-client-secret
add_optional_secret OUTREACH_SMTP_PASSWORD outreach-smtp-password
add_optional_secret CONTENT_READ_CLIENT_KEYS content-read-client-keys
add_optional_secret CAREERS_SUBMIT_CLIENT_KEYS careers-submit-client-keys
add_optional_secret CONTENT_REVALIDATE_SECRET content-revalidate-secret
add_optional_secret CONTENT_RENDER_SECRET content-render-secret
add_optional_secret CONTENT_PREVIEW_SECRET content-preview-secret
add_optional_secret CONTENT_IP_SALT content-ip-salt
add_optional_secret RELAY_ADMIN_API_SECRET relay-admin-api-secret
add_optional_secret RELAY_WEBHOOK_SECRET relay-webhook-secret
add_optional_secret ASKBRIDGE_STATUS_TOKEN askbridge-status-token
add_optional_secret AI_DATA_LLM_API_KEY ai-data-llm-api-key
add_optional_secret BILLING_STRIPE_SECRET_KEY billing-stripe-secret-key
add_optional_secret BILLING_STRIPE_WEBHOOK_SECRET billing-stripe-webhook-secret
unset _name
# JOB_ENV is built from ENV_VARS, so PRIMARY_OWNER_EMAIL reaches the release job (create_owner).
JOB_ENV=("${ENV_VARS[@]}" "BOOTSTRAP_ADMIN_EMAIL=$ADMIN_EMAIL" BOOTSTRAP_ADMIN_PASSWORD=secretref:bootstrap-admin-password)

log "Release job $RELEASE_JOB (migrations run before the app takes the new image)"
if [ "$JOB_EXISTS" = 0 ]; then
  quiet az containerapp job create -n "$RELEASE_JOB" -g "$RG" --environment "$CAE" \
    --trigger-type Manual --replica-timeout 900 --replica-retry-limit 0 --parallelism 1 --replica-completion-count 1 \
    --image "$IMAGE" --cpu "$CPU" --memory "$MEMORY" --command /app/bin/release.sh \
    --secrets "${SECRETS[@]}" --env-vars "${JOB_ENV[@]}"
else
  quiet az containerapp job secret set -n "$RELEASE_JOB" -g "$RG" --secrets "${SECRETS[@]}"
  # Public image: drop any ghcr.io credential left from the earlier private-package setup.
  if exists az containerapp job registry show -n "$RELEASE_JOB" -g "$RG" --server ghcr.io; then
    quiet az containerapp job registry remove -n "$RELEASE_JOB" -g "$RG" --server ghcr.io
  fi
  quiet az containerapp job update -n "$RELEASE_JOB" -g "$RG" --image "$IMAGE" --set-env-vars "${JOB_ENV[@]}"
fi
EXECUTION="$(az containerapp job start -n "$RELEASE_JOB" -g "$RG" --query name -o tsv --only-show-errors)"
wait_for_job "$RELEASE_JOB" "$EXECUTION"

log "Container app $APP (scale to zero, $CPU vCPU / $MEMORY, max 1 replica)"
SCALE_ARGS=(--min-replicas 0 --max-replicas 1 --cpu "$CPU" --memory "$MEMORY"
  --scale-rule-name http-concurrency --scale-rule-type http --scale-rule-http-concurrency "$HTTP_CONCURRENCY")
if [ "$APP_EXISTS" = 0 ]; then
  quiet az containerapp create -n "$APP" -g "$RG" --environment "$CAE" --image "$IMAGE" \
    --target-port 8000 --ingress external --revisions-mode single "${SCALE_ARGS[@]}" \
    --secrets "${SECRETS[@]}" --env-vars "${ENV_VARS[@]}"
else
  quiet az containerapp secret set -n "$APP" -g "$RG" --secrets "${SECRETS[@]}"
  if exists az containerapp registry show -n "$APP" -g "$RG" --server ghcr.io; then
    quiet az containerapp registry remove -n "$APP" -g "$RG" --server ghcr.io
  fi
  quiet az containerapp update -n "$APP" -g "$RG" --image "$IMAGE" "${SCALE_ARGS[@]}" --set-env-vars "${ENV_VARS[@]}"
fi
FQDN="$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
VERIFICATION_ID="$(az containerapp show -n "$APP" -g "$RG" --query properties.customDomainVerificationId -o tsv)"
output fqdn "$FQDN"

bound() {
  [ "$(az containerapp hostname list -n "$APP" -g "$RG" --query "[?name=='$DOMAIN'].bindingType" -o tsv 2>/dev/null)" = "SniEnabled" ]
}

if bound; then
  log "$DOMAIN is already bound with a managed certificate; DNS left as it is"
else
  log "DNS: $DOMAIN -> $FQDN"
  if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
    cat <<EOF

CLOUDFLARE_API_TOKEN is not set. Create these records in the $ZONE zone (DNS only / grey cloud, TTL 300),
then run the workflow again; it resumes from here:
  CNAME  ${DOMAIN%%."$ZONE"}         $FQDN
  TXT    asuid.${DOMAIN%%."$ZONE"}   $VERIFICATION_ID
EOF
    output bound false
    exit 0
  fi
  mask "$CLOUDFLARE_API_TOKEN"
  cloudflare() {  # method, path, [json body]
    curl -fsS -X "$1" "https://api.cloudflare.com/client/v4$2" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" ${3:+--data "$3"}
  }
  upsert_record() {  # zone id, type, name, content. Never silently replaces a record pointing elsewhere.
    local zone_id="$1" type="$2" name="$3" content="$4" existing existing_id existing_content body
    existing="$(cloudflare GET "/zones/$zone_id/dns_records?type=$type&name=$name" |
      python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; print(r[0]["id"] + " " + r[0]["content"].strip(chr(34)) if r else "")')"
    existing_id="${existing%% *}"
    existing_content="${existing#* }"
    body="$(python3 -c 'import json,sys; print(json.dumps({"type": sys.argv[1], "name": sys.argv[2], "content": sys.argv[3], "ttl": 300, "proxied": False}))' "$type" "$name" "$content")"
    if [ -z "$existing" ]; then
      cloudflare POST "/zones/$zone_id/dns_records" "$body" > /dev/null
    elif [ "$existing_content" != "$content" ]; then
      [ "${DNS_OVERWRITE:-}" = "1" ] ||
        die "$type $name already points to '$existing_content'. Check what uses it, then re-run with DNS_OVERWRITE=1."
      cloudflare PUT "/zones/$zone_id/dns_records/$existing_id" "$body" > /dev/null
    fi
  }
  ZONE_ID="$(cloudflare GET "/zones?name=$ZONE" | python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; print(r[0]["id"] if r else "")')"
  [ -n "$ZONE_ID" ] || die "zone $ZONE not found for this Cloudflare token"
  upsert_record "$ZONE_ID" CNAME "$DOMAIN" "$FQDN"
  upsert_record "$ZONE_ID" TXT "asuid.$DOMAIN" "$VERIFICATION_ID"
  log "Cloudflare records written (DNS only, grey cloud)"

  resolves() {  # name, type, expected value (DNS-over-HTTPS, no dig needed)
    curl -fsS -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=$1&type=$2" |
      python3 -c 'import json,sys; want=sys.argv[1].rstrip(".").lower(); answers=[a["data"].strip("\"").rstrip(".").lower() for a in json.load(sys.stdin).get("Answer", [])]; sys.exit(0 if want in answers else 1)' "$3"
  }
  for attempt in $(seq 1 60); do
    if resolves "$DOMAIN" CNAME "$FQDN" && resolves "asuid.$DOMAIN" TXT "$VERIFICATION_ID"; then break; fi
    [ "$attempt" = 60 ] && die "DNS for $DOMAIN has not propagated after 30 minutes; re-run later"
    sleep 30
  done

  log "Custom domain and managed certificate (free)"
  if [ -z "$(az containerapp hostname list -n "$APP" -g "$RG" --query "[?name=='$DOMAIN'].name" -o tsv)" ]; then
    quiet az containerapp hostname add -n "$APP" -g "$RG" --hostname "$DOMAIN"
  fi
  quiet az containerapp hostname bind -n "$APP" -g "$RG" --hostname "$DOMAIN" --environment "$CAE" --validation-method CNAME
fi
output bound true

log "Waiting for https://$DOMAIN (the first request also wakes the app and the database)"
for attempt in $(seq 1 60); do
  if curl -fsS --max-time 30 "https://$DOMAIN/healthz/" > /dev/null 2>&1; then
    curl -fsS -o /dev/null -w "login page: HTTP %{http_code}\n" "https://$DOMAIN/login/"
    log "Live: https://$DOMAIN ($IMAGE)"
    exit 0
  fi
  sleep 20
done
die "https://$DOMAIN did not become healthy within 20 minutes (attempt $attempt)"
