#!/usr/bin/env sh
# Release step, run as a one-off job before new revisions take traffic. Safe to re-run.
# Each command is retried 3 times with backoff: a free-tier database can be slow or refuse the first
# connection, for example while Neon resumes from its 5-minute autosuspend.
set -eu
cd "$(dirname "$0")/.."

retry() {
  attempt=1
  delay=5
  until "$@"; do
    if [ "$attempt" -ge 3 ]; then
      echo "release: '$*' failed after $attempt attempts" >&2
      return 1
    fi
    echo "release: '$*' failed (attempt $attempt/3); retrying in ${delay}s" >&2
    sleep "$delay"
    attempt=$((attempt + 1))
    delay=$((delay * 3))
  done
}

retry python manage.py migrate --noinput
retry python manage.py seed_architecture
# Adds seed email templates that do not exist yet (as Draft); never changes edited templates.
retry python manage.py seed_email_templates
# Creates the bootstrap SuperAdmin only if missing (password from $BOOTSTRAP_ADMIN_PASSWORD);
# an existing account is never re-activated, re-promoted or otherwise changed.
retry python manage.py create_superadmin
# Creates or confirms the primary owner (admin@vitalos.co.uk) with no usable password when
# PRIMARY_OWNER_EMAIL is set. Idempotent; other SuperAdmins are untouched. The owner then sets a
# password with a one-time link from `manage.py issue_setup_link` (docs/DEPLOY.md).
if [ -n "${PRIMARY_OWNER_EMAIL:-}" ]; then
  retry python manage.py create_owner
fi
