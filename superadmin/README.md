# Vitalos Super Admin

The internal system of record for the Vitalos company architecture, at **https://admin.vitalos.co.uk** (deployment: [docs/DEPLOY.md](docs/DEPLOY.md)).

It holds the company north star (vision, mission and the ADVISE · BUILD · OPERATE · CREATE business modes) and the six service lines. Each line has its own Practices → Solutions → Offers, team, projects, KPIs and decisions. Records are classified Public, Internal, Confidential or Restricted, archived rather than deleted, and every change is in the history.

Stack: Python 3.12, Django 5.2 LTS, HTMX 2 (django-htmx), Tailwind CSS v4 (standalone CLI, no Node), PostgreSQL 17, django-simple-history, django-axes, django-otp, django-csp, Django REST Framework with drf-spectacular, WhiteNoise and gunicorn. See [ADR-016](../docs/adr/ADR-016-superadmin-django.md).

## Pages

| URL                                                         | What                                                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/login/`, `/logout/`                                       | Email and password with django-axes lockout. TOTP is required for SuperAdmin                                               |
| `/`                                                         | North-star header and service line cards: modes, active projects, headline KPI, owner                                      |
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
apps/architecture/ models, services (write rules), selectors (visibility), search, activity, CSV, views
apps/api/          DRF read-only API
templates/, static/, assets/tailwind.css
bin/               tailwind.sh, release.sh (migrate + seed + bootstrap admin), backup.sh (pg_dump)
deploy/azure/      deploy.sh (idempotent Azure provisioning and deploy), backup-job.yaml
tests/             pytest-django suite
e2e/smoke.py       Playwright browser smoke test (local or live)
docs/              DEPLOY.md, DECISIONS.md, PHASE2.md, screenshots/
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

Or run `docker compose up --build`, which gives PostgreSQL 17 plus the app on http://localhost:8000.

## Quality gates (CI: `.github/workflows/superadmin.yml`)

```sh
ruff check . && ruff format --check .
pytest                                          # 101 tests; DATABASE_URL=postgres://… to match CI
DJANGO_SETTINGS_MODULE=config.settings.prod … python manage.py check --deploy --fail-level WARNING
pip-audit --strict -r requirements.txt
bandit -r apps config -c pyproject.toml
```

CI also builds the image, runs the release job twice, checks a backup, and drives `e2e/smoke.py` against the production container.

## Management commands

- `seed_architecture` loads the company profile, roles and six service lines. It is idempotent and never overwrites edits.
- `create_superadmin [--email EMAIL] [--password]` creates or confirms the bootstrap SuperAdmin. The password is read **only** from `$BOOTSTRAP_ADMIN_PASSWORD`. `--password` is a flag that resets an existing account's password from that variable.

Decisions and assumptions: [docs/DECISIONS.md](docs/DECISIONS.md). Next phase: [docs/PHASE2.md](docs/PHASE2.md).
