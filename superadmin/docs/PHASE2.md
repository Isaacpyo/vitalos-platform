# Phase 2 backlog: Vitalos Super Admin

The items below are ordered roughly by dependency, not committed dates. Each item needs its own design note or ADR before build.

## 1. Microsoft Entra ID single sign-on (identity source of truth)

- Use OpenID Connect against the Vitalos Entra tenant, with authorisation code flow and PKCE, for example with `mozilla-django-oidc` or MSAL. Register the app redirect URI `https://admin.vitalos.co.uk/oidc/callback/`.
- **Map Entra groups to roles:** `sg-superadmin-superadmins` → SuperAdmin, `sg-superadmin-service-leads` → ServiceLead, `sg-superadmin-viewers` → Viewer. Re-evaluate the mapping at every sign-in. Users in no mapped group are refused.
- Map service-line scope for ServiceLeads from Entra groups or attributes, such as `sg-sl-consulting-leads`, replacing manual ownership.
- Let Conditional Access and Entra MFA replace local TOTP. Keep **one local break-glass SuperAdmin** with TOTP and password, monitored, with its secret in Key Vault.
- Disable local password sign-in for everyone else. Create accounts just in time on first sign-in. Deactivate on Entra disable (see JML).

## 2. Industries

- An `Industry` taxonomy (e.g. Financial Services, Public Sector, Healthcare) linked many-to-many to Offers, Solutions and Projects. Add industry filters on dashboards and search.

## 3. Clients and accounts

- `Client` (organisation, sector, region, classification Confidential by default, account owner) and `Account` (relationship, status, tier). Projects get a foreign key to Client, replacing the free-text `client` field, with a data migration.
- Contact records stay in HubSpot (see 8). Super Admin stores only references and IDs.

## 4. Org structure and joiners, movers and leavers

- Units, reporting lines, roles and positions. Link team members to positions.
- JML workflows driven by Entra and HR events:
  - Joiner: create the person and role assignments.
  - Mover: change service lines or role.
  - Leaver: deactivate, reassign ownership and revoke tokens.
- Every step is audited, and the founder approves privileged grants.

## 5. Policies and controls register

- A `Policy` (owner, version, review date, status) and `Control` register mapped to frameworks such as ISO 27001 Annex A and Cyber Essentials. Record evidence *references* only; controlled evidence stays outside this app and outside the public CMS.
- Add review reminders and an overdue-control KPI per service line.

## 6. Labs venture pipeline

- A Labs-only pipeline: Idea → Discovery → Prototype → Pilot → Spin-out / Product / Stop. Track hypotheses, experiments, owner, budget class and decision gates, with decisions linked to the existing Decision log.

## 7. Pricing models

- Pricing models per Offer (fixed price, time and materials, retainer, managed service tiers, outcome-based), with classification Restricted. Add rate cards by role and day-rate bands. Approval workflow: SuperAdmin only.

## 8. Read-only integration tiles

Each integration is a provider adapter behind an interface. It uses server-side credentials from Key Vault, caches with a TTL, and degrades gracefully. Nothing is written back.

- **Notion:** recent decision pages and linked meeting notes, embedded as Decision tiles, using the Notion API with an internal integration token.
- **HubSpot:** pipeline value and deal counts per service line, read-only, via a private-app token.
- **Xero:** revenue and receivables per tracking category (service line), with read-only OAuth 2.0 scopes.

## 9. Email notifications

- An outbox table plus a delivery worker (Container Apps job) and an email provider adapter (Microsoft Graph `sendMail` or an approved transactional provider). Per-user preferences cover role changes, status changes, KPI breaches and a daily digest. Email failure never blocks the in-app notification.

## Platform hardening carried over from Phase 1

- Convert `deploy/azure/deploy.sh` to Terraform under `infra/`, as ADR-012 requires, before adding a staging environment. Add a staging environment with copied seed data only.
- Private networking: Container Apps VNet integration and a PostgreSQL private endpoint, then remove the Azure-services firewall rule.
- GIN indexes on the search vectors when data volume warrants it. Track M2M history for team membership.
- Optional WAF and rate limiting at the edge, after testing with Cloudflare (ADR-007).
- Enable repository code scanning (CodeQL) so that the existing `analyze` job turns green.
