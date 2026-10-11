#!/usr/bin/env sh
# Release step, run as a one-off job before new revisions take traffic. Safe to re-run.
# Each command is retried 3 times with backoff: Neon's free tier autosuspends after 5 idle minutes
# and the first connection after a suspend can be slow or refused while compute starts.
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
# Creates the bootstrap SuperAdmin only if missing (password from $BOOTSTRAP_ADMIN_PASSWORD);
# an existing account is never re-activated, re-promoted or otherwise changed.
retry python manage.py create_superadmin
