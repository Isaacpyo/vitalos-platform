# Vitalos Super Admin

The internal system of record for the Vitalos company architecture, at **https://admin.vitalos.co.uk** (deployment: [docs/DEPLOY.md](docs/DEPLOY.md)).

It holds the company north star (vision, mission and the ADVISE · BUILD · OPERATE · CREATE business modes) and the six service lines. Each line has its own Practices → Solutions → Offers, team, projects, KPIs and decisions. Records are classified Public, Internal, Confidential or Restricted, archived rather than deleted, and every change is in the history.

Stack: Python 3.12, Django 5.2 LTS, HTMX 2 (django-htmx), Tailwind CSS v4 (standalone CLI, no Node), PostgreSQL 17, django-simple-history, django-axes, django-otp, django-csp, Django REST Framework with drf-spectacular, WhiteNoise and gunicorn. See [ADR-026](../docs/adr/ADR-026-superadmin-django.md).

## Pages

| URL                                                         | What                                                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/login/`, `/logout/`                                       | Email and password with django-axes lockout. TOTP is required for SuperAdmin                                               |
| `/`                                                         | Overview: north-star header, KPIs, items needing attention and system status                                               |
| `/service-lines/`                                           | Service line cards: modes, active projects, headline KPI, owner (moved from `/`)                                           |
| `/enquiries/`                                               | Enquiries from support@ mail and the website form: inbox, reply, assign, SLA. SuperAdmin and ServiceLead only              |
| `/audit/`                                                   | Append-only audit trail with filters and CSV export                                                                        |
| `/help/`                                                    | In-app help                                                                                                                |
| `/settings/email/`, `/settings/notifications/`              | Mail transport status and notification preferences                                                                         |
| `/api/inbound/email`                                        | Signed webhook from the Cloudflare Email Worker (raw MIME, HMAC-SHA256, 5-minute clock window, 25 MiB limit)               |
| `/api/inbound/web-form`                                     | Signed JSON from the website contact form (honeypot, optional Turnstile); answers 201 `{ref}`                              |
| `/api/webhooks/resend`                                      | Resend delivery events (Svix-signed); `email.received` only when `INBOUND_PROVIDER=resend`                                 |
| `/s/<slug>/`                                                | Service dashboard with HTMX tabs: Overview, Structure, Team, Projects, KPIs. Modals, inline edits, archive and restore      |
| `/architecture/`                                            | Whole-company tree. Reorder, add, retire, archive and restore service lines; company-wide decisions                       |
| `/team/`, `/activity/`, `/search/?q=`                       | Team directory, filterable activity feed (from history), full-text search (live in the top bar)                            |
| `/settings/`                                                | Company profile, users and roles, API tokens, CSV import and export with dry run                                           |
| `/notifications/`                                           | In-app notifications. The bell polls every 60 seconds                                                                      |
| `/api/v1/`, `/api/schema/`, `/api/docs/`                    | Read-only REST API (per-user Bearer tokens), OpenAPI schema, Swagger UI                                                    |
| `/django-admin/`                                            | Verified Django superusers only. The only place a hard delete is possible                                                  |
| `/healthz/`                                                 | Liveness and database probe                                                                                                |

## Layout

```
config/            settings (base, dev, test, prod), urls, wsgi
apps/core/         governance model mixin, middleware (request ID, health, headers), template tags, admin site
apps/accounts/     email User, roles (has_service_access, role_required), TOTP, API tokens, users settings
apps/notifications in-app notifications
apps/audit/        append-only audit trail
apps/mailer/       MailProvider interface, log and Resend email backends, Resend webhook
apps/enquiries/    enquiry model, MIME ingest, inbound endpoints, selectors, SLA, notifications
apps/architecture/ models, services (write rules), selectors (visibility), search, activity, CSV, views
apps/api/          DRF read-only API
templates/, static/, assets/tailwind.css
bin/               tailwind.sh, release.sh (migrate + seed + bootstrap admin), backup.sh (pg_dump)
deploy/azure/      deploy.sh (idempotent zero-cost Container Apps deploy; --dry-run prints the plan)
tests/             pytest-django suite
e2e/smoke.py       Playwright browser smoke test (local or live)
docs/              DEPLOY.md, email-setup.md, DECISIONS.md, PHASE2.md, screenshots/
../infra/cloudflare-email-worker/   inbound mail Worker (prepared, not deployed)
```

Business rules live in `services.py` (writes) and `selectors.py` (reads and visibility), never in views or templates. Server-only settings and secrets come from environment variables ([.env.example](.env.example)).

## Develop

```sh
cd superadmin
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install -r requirements.txt -r requirements-dev.txt
bin/tailwind.sh --watch &                        # builds static/css/app.css
python manage.py migrate && python manage.py seed_architecture
BOOTSTRAP_ADMIN_PASSWORD='<12+ characters>' python manage.py create_superadmin --email you@vitalos.co.uk
python manage.py runserver
```

Windows: `bin/tailwind.sh` has no Windows binary. Download the `tailwindcss-windows-x64.exe` release of the pinned version (see `VERSION` in `bin/tailwind.sh`) from the Tailwind CSS GitHub releases and run it manually with the same arguments as the script (`-i assets/tailwind.css -o static/css/app.css`, plus `--watch` or `--minify`).

Refreshing the pinned dependencies (the lockfiles must match the Linux image, so always pass `--python-platform linux`):

```sh
uv pip compile requirements.in -o requirements.txt --python-version 3.12 --python-platform linux
uv pip compile requirements-dev.in -o requirements-dev.txt --python-version 3.12 --python-platform linux
```

Or run `docker compose up --build`, which gives PostgreSQL 17 plus the app on http://localhost:8000.

## Quality gates (CI: `.github/workflows/superadmin.yml`)

```sh
ruff check . && ruff format --check .
pytest                                          # 110 tests; DATABASE_URL=postgres://… to match CI
DJANGO_SETTINGS_MODULE=config.settings.prod … python manage.py check --deploy --fail-level WARNING
pip-audit --strict -r requirements.txt
bandit -r apps config -c pyproject.toml
```

CI also builds the image, runs the release job twice, checks a backup, and drives `e2e/smoke.py` against the production container.

## Management commands

- `seed_architecture` loads the company profile, roles and six service lines. It is idempotent and never overwrites edits.
- `create_superadmin [--email EMAIL] [--password]` creates the bootstrap SuperAdmin if it is missing, and otherwise leaves the account unchanged. The password is read **only** from `$BOOTSTRAP_ADMIN_PASSWORD`. `--password` is a flag that resets only an existing account's password from that variable.
- `create_owner` creates or confirms the primary owner (`$PRIMARY_OWNER_EMAIL`, `admin@vitalos.co.uk`) with no password. The release job runs it when the variable is set. Idempotent; other SuperAdmins are untouched.
- `issue_setup_link --email admin@vitalos.co.uk` prints a single-use set-password link, valid for 30 minutes, to the terminal only.
- `send_enquiry_notifications` flushes pending enquiry notifications and sends the 08:00 digest. Schedule it every 5 minutes (a Container Apps job, [docs/email-setup.md](docs/email-setup.md) section 8).
- `enforce_enquiry_retention` applies the 24-month retention. It is a dry run unless `RETENTION_ENFORCE=true`.

Mail (inbound Worker, Resend, DNS, secrets) is set up by the owner with [docs/email-setup.md](docs/email-setup.md); design in [ADR-028](../docs/adr/ADR-028-superadmin-enquiries-mail-console.md).

Decisions and assumptions: [docs/DECISIONS.md](docs/DECISIONS.md). Next phase: [docs/PHASE2.md](docs/PHASE2.md).
