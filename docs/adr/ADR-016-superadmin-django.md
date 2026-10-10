# ADR 016 Super Admin as an isolated Django application

Status: Accepted (Phase 1, 10 Oct 2026).

Context: Vitalos needs an internal system of record for its company architecture: service lines, practices, solutions, offers, team, projects, KPIs and decisions. The founder specified the stack: Python 3.12+, Django 5, HTMX, Tailwind CLI, PostgreSQL. The service is hosted at `admin.vitalos.co.uk`. This repository is TypeScript-first (ADR-002/003), and ADR-012 prefers reviewed Terraform for infrastructure.

Decision: Add `superadmin/` as an independently deployable Django 5.2 LTS application with its own PostgreSQL database, container image, CI workflow (`.github/workflows/superadmin.yml`) and dependency set. It imports no other application's source, and no other application imports it. It uses its own toolchain (pip, ruff, pytest, the standalone Tailwind binary) and is excluded from the Node Prettier gate. Phase 1 provisions Azure Container Apps (UK South), Azure Database for PostgreSQL 17 and Key Vault with an idempotent, reviewed Azure CLI script (`superadmin/deploy/azure/deploy.sh`). The script runs only through a manual, environment-protected workflow. Cloudflare keeps DNS authority (ADR-007), with a DNS-only CNAME.

Options: a TypeScript app inside `apps/` (rejected: not the specified stack); extend the web app's Supabase (rejected: it mixes public website and internal governance data and access models); a SaaS tool such as Notion (rejected: no enforced roles, classification or audit history); Terraform from day one (deferred, see trade-offs).

Reasons: the specified stack, a hard isolation boundary for confidential operational data, server-rendered pages that need no client build, and Django's mature admin, auth, audit (simple-history) and security middleware.

Trade-offs: the monorepo now has two language toolchains. Infrastructure is defined imperatively by a script rather than Terraform state, which departs from ADR-012 for this single bootstrap environment. Python and JavaScript dependencies are patched on separate cadences.

Consequences: Super Admin data is owned by its own PostgreSQL database. Sanity and the web app's operational tables are unchanged. Integration with other apps happens only through the read-only `/api/v1/` API, with per-user tokens. Security headers, CSP, logging and request IDs are implemented in Django rather than `@vitalos/security` or `@vitalos/observability`.

Revisit triggers: a second environment (staging), any IaC change beyond the bootstrap script (move it to Terraform under `infra/` per ADR-012), Entra ID SSO (Phase 2), or a need to share UI or domain code with the TypeScript apps.
