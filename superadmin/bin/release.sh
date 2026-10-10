#!/usr/bin/env sh
# Release step, run as a one-off job before new revisions take traffic. Safe to re-run.
set -eu
cd "$(dirname "$0")/.."
python manage.py migrate --noinput
python manage.py seed_architecture
# Creates the bootstrap SuperAdmin on first release (password from $BOOTSTRAP_ADMIN_PASSWORD);
# afterwards it only confirms the account and never changes the password.
python manage.py create_superadmin
