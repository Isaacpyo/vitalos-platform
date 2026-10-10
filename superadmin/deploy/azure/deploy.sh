#!/usr/bin/env bash
# Provision (idempotently) and deploy the Vitalos Super Admin to Azure Container Apps, UK South,
# then point admin.vitalos.co.uk at it with a managed TLS certificate.
#
# Safe to re-run: existing resources are reused, secrets are generated only when missing, data is
# never deleted. Secret values are generated into files with mode 0600 and never printed.
#
# Requirements: bash, az CLI >= 2.70 logged in to the Vitalos subscription with Owner (or
# Contributor + User Access Administrator) on the target resource group, docker (BuildKit),
# python3, curl. Optional: CLOUDFLARE_API_TOKEN (Zone:DNS:Edit on vitalos.co.uk) to create the
# DNS records automatically; without it the script prints the two records and stops.
#
# Usage:  AZ_SUBSCRIPTION=<subscription id> superadmin/deploy/azure/deploy.sh
#         (see superadmin/docs/DEPLOY.md for every variable and the manual equivalent)
set -euo pipefail

: "${AZ_SUBSCRIPTION:?Set AZ_SUBSCRIPTION to the Vitalos Azure subscription ID}"
LOCATION="${AZ_LOCATION:-uksouth}"
PREFIX="${AZ_NAME_PREFIX:-vitalossa}"             # lower-case letters/digits; drives global names
RG="${AZ_RESOURCE_GROUP:-rg-vitalos-superadmin-prod}"
ACR="${AZ_ACR:-${PREFIX}acr}"                      # globally unique, 5-50 alphanumerics
KV="${AZ_KEY_VAULT:-kv-${PREFIX}}"                 # globally unique, 3-24 characters
PG="${AZ_POSTGRES:-psql-${PREFIX}}"                # globally unique server name
PG_DB="superadmin"
PG_ADMIN="vitalosadmin"
STORAGE="${AZ_STORAGE:-st${PREFIX}backup}"         # globally unique, 3-24 lower-case alphanumerics
LOG_WS="log-${PREFIX}"
CAE="cae-${PREFIX}"
IDENTITY="id-${PREFIX}"
APP="${AZ_APP:-superadmin}"
RELEASE_JOB="${APP}-release"
BACKUP_JOB="${APP}-backup"
DOMAIN="${CUSTOM_DOMAIN:-admin.vitalos.co.uk}"
ZONE="${DNS_ZONE:-vitalos.co.uk}"
ADMIN_EMAIL="${BOOTSTRAP_ADMIN_EMAIL:-superadmin-owner@example.invalid}"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TAG="${IMAGE_TAG:-$(git -C "$SRC_DIR" rev-parse --short=12 HEAD)}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
umask 077

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
quiet() { "$@" --output none --only-show-errors; }
exists() { "$@" --output none --only-show-errors >/dev/null 2>&1; }

# Write a random secret (no trailing newline) to a 0600 file and print the file path.
secret_file() {
  local path="$WORK/$1"
  python3 - "$2" > "$path" <<'PY'
import secrets, sys
length = int(sys.argv[1])
while True:
    value = secrets.token_urlsafe(length)
    # Azure PostgreSQL passwords need three character classes; retry until upper, lower and digit.
    if any(c.isupper() for c in value) and any(c.islower() for c in value) and any(c.isdigit() for c in value):
        sys.stdout.write(value)
        break
PY
  printf '%s' "$path"
}

kv_has() {  # true if present, false only if definitely absent; any other error stops the script
  local output
  if output="$(az keyvault secret show --vault-name "$KV" --name "$1" --output none --only-show-errors 2>&1)"; then
    return 0
  fi
  case "$output" in
    *SecretNotFound* | *"was not found"*) return 1 ;;
    *) die "cannot read Key Vault secret $1 (never treated as missing, to avoid overwriting it): $output" ;;
  esac
}

kv_set_from_file() {
  local attempt
  for attempt in $(seq 1 12); do  # RBAC role assignments can take a minute to propagate
    if quiet az keyvault secret set --vault-name "$KV" --name "$1" --file "$2" --encoding utf-8; then
      return 0
    fi
    sleep 10
  done
  die "could not write secret $1 to Key Vault $KV"
}

ensure_kv_secret() {  # name, length
  kv_has "$1" || kv_set_from_file "$1" "$(secret_file "$1" "$2")"
}

kv_value() { az keyvault secret show --vault-name "$KV" --name "$1" --query value -o tsv --only-show-errors; }

assign_role() {  # principal object id, principal type, role, scope (idempotent)
  local output
  if ! output="$(az role assignment create --assignee-object-id "$1" --assignee-principal-type "$2" \
    --role "$3" --scope "$4" --output none --only-show-errors 2>&1)"; then
    case "$output" in
      *"already exists"* | *RoleAssignmentExists*) ;;
      *) die "role assignment '$3' failed: $output" ;;
    esac
  fi
}

retry() {  # retry a command while new role assignments propagate (up to ~5 minutes)
  local attempt
  for attempt in $(seq 1 10); do
    "$@" && return 0
    printf 'Retrying in 30s (attempt %s/10)…\n' "$attempt" >&2
    sleep 30
  done
  die "command failed after 10 attempts: $*"
}

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
  die "$1 execution $2 did not finish within 15 minutes"
}

# ------------------------------------------------------------------------------------------------
log "Subscription and resource group ($LOCATION)"
quiet az account set --subscription "$AZ_SUBSCRIPTION"
for provider in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry \
  Microsoft.DBforPostgreSQL Microsoft.KeyVault Microsoft.Storage Microsoft.ManagedIdentity; do
  # Registration needs subscription-level rights; DEPLOY.md has the founder do it once up front.
  if [ "$(az provider show --namespace "$provider" --query registrationState -o tsv 2>/dev/null)" != "Registered" ]; then
    quiet az provider register --namespace "$provider" --wait
  fi
done
quiet az group create --name "$RG" --location "$LOCATION" --tags app=vitalos-superadmin env=production

log "Deployer identity"
# A service principal usually cannot read Microsoft Graph, so CI passes its object ID explicitly.
if [ "$(az account show --query user.type -o tsv)" = "servicePrincipal" ]; then
  DEPLOYER_TYPE="ServicePrincipal"
  DEPLOYER_ID="${AZURE_DEPLOYER_OBJECT_ID:-$(az ad sp show --id "$(az account show --query user.name -o tsv)" --query id -o tsv)}"
else
  DEPLOYER_TYPE="User"
  DEPLOYER_ID="${AZURE_DEPLOYER_OBJECT_ID:-$(az ad signed-in-user show --query id -o tsv)}"
fi
[ -n "$DEPLOYER_ID" ] || die "set AZURE_DEPLOYER_OBJECT_ID to the deploying identity's object ID"

log "Key Vault $KV (secrets manager)"
exists az keyvault show -n "$KV" -g "$RG" || quiet az keyvault create -n "$KV" -g "$RG" -l "$LOCATION" \
  --enable-rbac-authorization true --retention-days 90 --enable-purge-protection true
KV_ID="$(az keyvault show -n "$KV" -g "$RG" --query id -o tsv)"
KV_URI="$(az keyvault show -n "$KV" -g "$RG" --query properties.vaultUri -o tsv)"
KV_URI="${KV_URI%/}"
assign_role "$DEPLOYER_ID" "$DEPLOYER_TYPE" "Key Vault Secrets Officer" "$KV_ID"
retry quiet az keyvault secret list --vault-name "$KV" --maxresults 1  # wait for data-plane access
ensure_kv_secret django-secret-key 64
ensure_kv_secret bootstrap-admin-password 24
ensure_kv_secret postgres-admin-password 32
if [ -n "${SENTRY_DSN:-}" ]; then
  printf '%s' "$SENTRY_DSN" > "$WORK/sentry"
  kv_set_from_file sentry-dsn "$WORK/sentry"
fi

log "Managed identity $IDENTITY"
exists az identity show -n "$IDENTITY" -g "$RG" || quiet az identity create -n "$IDENTITY" -g "$RG" -l "$LOCATION"
IDENTITY_ID="$(az identity show -n "$IDENTITY" -g "$RG" --query id -o tsv)"
IDENTITY_PRINCIPAL="$(az identity show -n "$IDENTITY" -g "$RG" --query principalId -o tsv)"
assign_role "$IDENTITY_PRINCIPAL" ServicePrincipal "Key Vault Secrets User" "$KV_ID"

log "PostgreSQL 17 Flexible Server $PG (14-day managed backups)"
if ! exists az postgres flexible-server show -n "$PG" -g "$RG"; then
  # The admin password is passed on this machine's command line once, at creation only.
  quiet az postgres flexible-server create -n "$PG" -g "$RG" -l "$LOCATION" \
    --version 17 --tier Burstable --sku-name Standard_B1ms --storage-size 32 \
    --admin-user "$PG_ADMIN" --admin-password "$(kv_value postgres-admin-password)" \
    --backup-retention 14 --zonal-resiliency Disabled --public-access 0.0.0.0 --yes
fi
exists az postgres flexible-server db show -g "$RG" -s "$PG" -n "$PG_DB" ||
  quiet az postgres flexible-server db create -g "$RG" -s "$PG" -n "$PG_DB"
PG_HOST="$(az postgres flexible-server show -n "$PG" -g "$RG" --query fullyQualifiedDomainName -o tsv)"
if ! kv_has database-url; then
  printf 'postgres://%s:%s@%s:5432/%s?sslmode=require' \
    "$PG_ADMIN" "$(kv_value postgres-admin-password)" "$PG_HOST" "$PG_DB" > "$WORK/database-url"
  kv_set_from_file database-url "$WORK/database-url"
fi

log "Container registry $ACR and image superadmin:$TAG"
exists az acr show -n "$ACR" -g "$RG" || quiet az acr create -n "$ACR" -g "$RG" -l "$LOCATION" --sku Basic --admin-enabled false
ACR_ID="$(az acr show -n "$ACR" -g "$RG" --query id -o tsv)"
ACR_SERVER="$(az acr show -n "$ACR" -g "$RG" --query loginServer -o tsv)"
assign_role "$IDENTITY_PRINCIPAL" ServicePrincipal AcrPull "$ACR_ID"
assign_role "$DEPLOYER_ID" "$DEPLOYER_TYPE" AcrPush "$ACR_ID"
IMAGE="$ACR_SERVER/superadmin:$TAG"
retry quiet az acr login --name "$ACR"
docker buildx build --platform linux/amd64 --tag "$IMAGE" --push "$SRC_DIR"

log "Log Analytics and Container Apps environment $CAE"
exists az monitor log-analytics workspace show -g "$RG" -n "$LOG_WS" ||
  quiet az monitor log-analytics workspace create -g "$RG" -n "$LOG_WS" -l "$LOCATION" --retention-time 30
if ! exists az containerapp env show -n "$CAE" -g "$RG"; then
  LOG_CUSTOMER_ID="$(az monitor log-analytics workspace show -g "$RG" -n "$LOG_WS" --query customerId -o tsv)"
  LOG_KEY="$(az monitor log-analytics workspace get-shared-keys -g "$RG" -n "$LOG_WS" --query primarySharedKey -o tsv)"
  quiet az containerapp env create -n "$CAE" -g "$RG" -l "$LOCATION" \
    --logs-workspace-id "$LOG_CUSTOMER_ID" --logs-workspace-key "$LOG_KEY"
fi
CAE_ID="$(az containerapp env show -n "$CAE" -g "$RG" --query id -o tsv)"

ref() { printf '%s=keyvaultref:%s/secrets/%s,identityref:%s' "$1" "$KV_URI" "$1" "$IDENTITY_ID"; }
COMMON_ENV=(
  DJANGO_SETTINGS_MODULE=config.settings.prod
  DJANGO_SECRET_KEY=secretref:django-secret-key
  DATABASE_URL=secretref:database-url
  "ALLOWED_HOSTS=$DOMAIN"
  "CSRF_TRUSTED_ORIGINS=https://$DOMAIN"
  SECURE_SSL_REDIRECT=True
  TRUSTED_PROXY_COUNT=1
  APP_ENVIRONMENT=production
  LOG_FORMAT=json
)
APP_SECRETS=("$(ref django-secret-key)" "$(ref database-url)")
if kv_has sentry-dsn; then
  APP_SECRETS+=("$(ref sentry-dsn)")
  COMMON_ENV+=(SENTRY_DSN=secretref:sentry-dsn)
fi

log "Release job $RELEASE_JOB (migrate, seed_architecture, create_superadmin)"
if ! exists az containerapp job show -n "$RELEASE_JOB" -g "$RG"; then
  retry quiet az containerapp job create -n "$RELEASE_JOB" -g "$RG" --environment "$CAE" \
    --trigger-type Manual --replica-timeout 900 --replica-retry-limit 0 --parallelism 1 --replica-completion-count 1 \
    --image "$IMAGE" --registry-server "$ACR_SERVER" --registry-identity "$IDENTITY_ID" --mi-user-assigned "$IDENTITY_ID" \
    --cpu 0.5 --memory 1Gi --command /app/bin/release.sh \
    --secrets "${APP_SECRETS[@]}" "$(ref bootstrap-admin-password)" \
    --env-vars "${COMMON_ENV[@]}" "BOOTSTRAP_ADMIN_EMAIL=$ADMIN_EMAIL" BOOTSTRAP_ADMIN_PASSWORD=secretref:bootstrap-admin-password
else
  quiet az containerapp job update -n "$RELEASE_JOB" -g "$RG" --image "$IMAGE"
fi
EXECUTION="$(az containerapp job start -n "$RELEASE_JOB" -g "$RG" --query name -o tsv --only-show-errors)"
wait_for_job "$RELEASE_JOB" "$EXECUTION"

log "Container app $APP"
if ! exists az containerapp show -n "$APP" -g "$RG"; then
  retry quiet az containerapp create -n "$APP" -g "$RG" --environment "$CAE" \
    --image "$IMAGE" --registry-server "$ACR_SERVER" --registry-identity "$IDENTITY_ID" --user-assigned "$IDENTITY_ID" \
    --target-port 8000 --ingress external --revisions-mode single --min-replicas 1 --max-replicas 3 \
    --cpu 0.5 --memory 1Gi --secrets "${APP_SECRETS[@]}" --env-vars "${COMMON_ENV[@]}"
else
  quiet az containerapp update -n "$APP" -g "$RG" --image "$IMAGE"
fi
FQDN="$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
VERIFICATION_ID="$(az containerapp show -n "$APP" -g "$RG" --query properties.customDomainVerificationId -o tsv)"

log "Nightly pg_dump job $BACKUP_JOB (02:15 UTC, 14-day retention on Azure Files)"
exists az storage account show -n "$STORAGE" -g "$RG" || quiet az storage account create -n "$STORAGE" -g "$RG" \
  -l "$LOCATION" --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false
exists az storage share-rm show --storage-account "$STORAGE" -g "$RG" -n backups ||
  quiet az storage share-rm create --storage-account "$STORAGE" -g "$RG" -n backups --quota 50
STORAGE_KEY="$(az storage account keys list -n "$STORAGE" -g "$RG" --query '[0].value' -o tsv)"
quiet az containerapp env storage set -n "$CAE" -g "$RG" --storage-name backups --access-mode ReadWrite \
  --azure-file-account-name "$STORAGE" --azure-file-account-key "$STORAGE_KEY" --azure-file-share-name backups
sed -e "s#__LOCATION__#$LOCATION#g" -e "s#__IDENTITY_ID__#$IDENTITY_ID#g" -e "s#__CAE_ID__#$CAE_ID#g" \
  -e "s#__ACR_SERVER__#$ACR_SERVER#g" -e "s#__KV_URI__#$KV_URI#g" -e "s#__IMAGE__#$IMAGE#g" \
  "$SRC_DIR/deploy/azure/backup-job.yaml" > "$WORK/backup-job.yaml"
if exists az containerapp job show -n "$BACKUP_JOB" -g "$RG"; then
  quiet az containerapp job update -n "$BACKUP_JOB" -g "$RG" --image "$IMAGE"
else
  retry quiet az containerapp job create -n "$BACKUP_JOB" -g "$RG" --yaml "$WORK/backup-job.yaml"
fi

log "DNS: $DOMAIN → $FQDN"
cloudflare() {  # method, path, [json body]
  curl -fsS -X "$1" "https://api.cloudflare.com/client/v4$2" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" ${3:+--data "$3"}
}
upsert_record() {  # type, name, content
  local zone_id="$1" type="$2" name="$3" content="$4" existing body
  existing="$(cloudflare GET "/zones/$zone_id/dns_records?type=$type&name=$name" |
    python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; print(r[0]["id"] if r else "")')"
  body="$(python3 -c 'import json,sys; print(json.dumps({"type": sys.argv[1], "name": sys.argv[2], "content": sys.argv[3], "ttl": 300, "proxied": False}))' "$type" "$name" "$content")"
  if [ -n "$existing" ]; then
    cloudflare PUT "/zones/$zone_id/dns_records/$existing" "$body" > /dev/null
  else
    cloudflare POST "/zones/$zone_id/dns_records" "$body" > /dev/null
  fi
}
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  ZONE_ID="$(cloudflare GET "/zones?name=$ZONE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"][0]["id"])')"
  upsert_record "$ZONE_ID" CNAME "$DOMAIN" "$FQDN"
  upsert_record "$ZONE_ID" TXT "asuid.$DOMAIN" "$VERIFICATION_ID"
  log "Cloudflare records written (DNS only, not proxied)"
else
  cat <<EOF

Create these DNS records in the vitalos.co.uk zone (DNS only / not proxied, TTL 300), then re-run:
  CNAME  ${DOMAIN%%."$ZONE"}         $FQDN
  TXT    asuid.${DOMAIN%%."$ZONE"}   $VERIFICATION_ID
EOF
  exit 0
fi

resolves() {  # name, type, expected value (via DNS-over-HTTPS, no dig needed)
  curl -fsS -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=$1&type=$2" |
    python3 -c 'import json,sys; want=sys.argv[1].rstrip(".").lower(); answers=[a["data"].strip("\"").rstrip(".").lower() for a in json.load(sys.stdin).get("Answer", [])]; sys.exit(0 if want in answers else 1)' "$3"
}
for attempt in $(seq 1 60); do
  if resolves "$DOMAIN" CNAME "$FQDN" && resolves "asuid.$DOMAIN" TXT "$VERIFICATION_ID"; then break; fi
  [ "$attempt" = 60 ] && die "DNS for $DOMAIN has not propagated after 30 minutes"
  sleep 30
done

log "Custom domain and managed certificate"
if [ -z "$(az containerapp hostname list -n "$APP" -g "$RG" --query "[?name=='$DOMAIN'].name" -o tsv)" ]; then
  quiet az containerapp hostname add -n "$APP" -g "$RG" --hostname "$DOMAIN"
fi
if [ "$(az containerapp hostname list -n "$APP" -g "$RG" --query "[?name=='$DOMAIN'].bindingType" -o tsv)" != "SniEnabled" ]; then
  quiet az containerapp hostname bind -n "$APP" -g "$RG" --hostname "$DOMAIN" --environment "$CAE" --validation-method CNAME
fi

log "Waiting for https://$DOMAIN to serve with a valid certificate"
for attempt in $(seq 1 60); do
  if curl -fsS --max-time 10 "https://$DOMAIN/healthz/" > /dev/null 2>&1; then
    curl -fsS -o /dev/null -w "login page: HTTP %{http_code}\n" "https://$DOMAIN/login/"
    log "Live: https://$DOMAIN (image superadmin:$TAG)"
    exit 0
  fi
  sleep 20
done
die "https://$DOMAIN did not become healthy within 20 minutes"
