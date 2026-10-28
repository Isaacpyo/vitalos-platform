# ADR 056 Client portal: customers track, collaborate on and approve their work, in the Super Admin's database

- **Status:** Accepted (engineering), 28 Oct 2026. Nothing is customer-facing until the owner binds `portal.vitalos.co.uk` (DNS and custom domain) and the portal host resolves to the app. File storage for production is a separate owner step.
- **Owner request:** one place where a customer sees the challenges they have discussed with Vitalos, collaborates on delivery, approves work and monitors managed systems, connected to the AI & Data site and the Super Admin.
- **Journey it serves:** Submitted challenge, Discovery, Assessment, Proposal, Active project, Handover, Managed operations. The original challenge (`aidata.Opportunity`, which keeps the submitted text and its history) and the discussion stay attached throughout. A customer may have several challenges and projects.

## Context

AI & Data (ADR-052) records enquiries, opportunities, qualification and proposals for staff only. Delivery has no customer view: updates, questions, deliverables and approvals happen in email, which loses version-specific decisions and leaves no record both sides can see. The Super Admin already owns authentication (accounts, django-axes, django-otp), mail (`apps.mailer`), audit (`apps.audit`), the AI gateway (`apps.aicore`) and PostgreSQL. A second application would duplicate all of that and need its own sync.

## Decision

### 1. Placement: a Django app inside the Super Admin, not a separate application

`apps.portal` shares the database, `apps.mailer` (shared layout, ADR-030; automated headers, ADR-046), `apps.audit`, `apps.aicore` and the `accounts.User` model. Staff-only models and customer-visible models are the same rows with explicit publication fields, so staff enter data once and "publish" is a state change, not a copy. Cost: a customer-facing surface lives in an internal system's process, so the boundary has to be enforced in code (below) and the portal must be switchable off independently.

### 2. Routing and hosts

- `PORTAL_HOST` set: the portal URLs are served only on that host, by a separate URL configuration (`config/portal_urls.py`) holding the portal routes and nothing else. Super Admin pages, APIs and the Django admin do not exist on that host (404). Health and static are answered by middleware before routing.
- **Owner decision (28 Oct 2026): the production host is `portal.vitalos.co.uk`.** Production settings default `PORTAL_HOST` to it (env-overridable), add it to `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`, and `deploy.sh` and `superadmin-deploy.yml` pass it with the existing variable pattern. `PORTAL_ENABLED` defaults to on in production only when `PORTAL_HOST` is set, and production refuses to start with `PORTAL_ENABLED` and no host. Until the custom domain resolves to the app the portal host receives no traffic, so nothing is exposed; the DNS record and the Azure custom-domain binding are owner/main-session steps.
- `PORTAL_HOST` empty (local default): the portal is mounted at `/portal/` for local preview only. With a host set, `/portal/` on any other host is a 404, and `PORTAL_ENABLED=false` makes both the host and `/portal/` answer 404.
- Staff tools live at `/client-portal/` on the admin host regardless of `PORTAL_ENABLED`, so content can be prepared before launch.
- **Cookies, session and CSP.** The session and CSRF cookies are host-only: `SESSION_COOKIE_DOMAIN` and `CSRF_COOKIE_DOMAIN` are `None` and a test fails otherwise, so an admin session is never sent to the portal host and the reverse. Sessions keep the 8-hour lifetime, HTTP-only, `Secure` in production, `SameSite=Lax`. The strict nonce-based CSP applies unchanged (the portal has its own stylesheet and one small script, no inline styles or handlers). The customer UI sets `Cache-Control: private, no-store` for signed-in pages and `no-store` for access pages. In local `/portal/` mode the portal and admin share one cookie jar on one host, so one account is signed in at a time; that mode is for preview only.

### 3. Who is a customer

A customer is an `accounts.User` with no staff role plus an active, accepted `Membership`. Access follows the membership on every request: revoking it, deactivating the user or deactivating the organisation closes every surface immediately (pages, downloads, search, AI, notifications, email on retry).

`CustomerBoundaryMiddleware` is deny-by-default and independent of what each admin view checks: a signed-in user with no staff role may reach portal URLs and static files only; every other path answers 403 (`/` and `/login/` send them to the portal). A test iterates the URL resolver for a customer and fails on any Super Admin URL that answers 200, including APIs, with an API token, and downloads. Staff never use the customer UI directly: they reach it through "Preview as customer" (`/client-portal/preview/<member>/as/`), which is read-only (every write is refused), bannered and audited, and bound to one member so staff see exactly what that member sees. Staff cannot be invited as members and cannot sign in to the portal.

### 4. Access

- Staff invite a member explicitly. The invitation is a single-use, expiring (72 h) token, **only its SHA-256 hash is stored**, sent through `apps.mailer` with `Auto-Submitted`, `X-Auto-Response-Suppress` and `X-Vitalos-Notification`. Re-sending replaces older links.
- The member sets a password on the portal host (12+ characters, Django validators). A person who already has a portal password confirms it to join a second organisation.
- django-axes locks sign-in (email + IP) after repeated failures, with a portal lockout page. Password reset is portal-specific (30-minute single-use link to the portal host), answers identically for unknown addresses, is rate-limited per address and only reaches live members.
- Second factor: optional TOTP through the existing django-otp devices, enrolled and verified inside the portal. Email OTP is a later phase.
- **New enquiries stay private.** Nothing is created in the portal by an enquiry. A challenge exists only when staff explicitly link an opportunity to an organisation, and it is invisible until staff share it. Access is never granted because someone knows an email address or a reference.
- Roles: viewer (read-only), contributor (comment, answer, upload, request a change), approver (also approve or request changes to a specific deliverable version, accept a brief), authorised signatory (also contractual acceptance).

### 5. Visibility model

Every customer-facing model has an explicit publication state; every internal-only field is named `internal_*` (or lives on an internal thread/file) so tests can plant markers in each and assert they never appear.

| Record                            | Customer sees it when                                                    |
| --------------------------------- | ------------------------------------------------------------------------ |
| Challenge                         | `shared_at` is set by staff (the text is a snapshot taken when linked)   |
| Brief version                     | proposed, agreed, superseded or changes-requested; never a draft         |
| Project, milestone, project item  | `published_at` set                                                       |
| Deliverable                       | published, and only its **shared**, not withdrawn versions               |
| Update                            | status published (a draft is invisible; a published update is frozen)    |
| Question (information request)    | sent (`published_at`)                                                    |
| Discussion thread                 | not internal; internal threads exist for staff only                      |
| File                              | `visibility = customer`; internal files are never listed or downloadable |
| Managed service and status report | published                                                                |
| Change request                    | always, to the organisation that raised it                               |
| Activity event, notification      | written by services from published fields only                           |

All reads go through `apps/portal/selectors.py`, which scopes by organisation **and** publication; a record in another organisation or not yet published behaves exactly like one that does not exist (`Http404`). Views, search, exports, downloads, notifications and AI context builders use only those selectors. Hiding a control in a template is never the mechanism. One test module (`tests/test_portal_isolation.py`) iterates every surface for a second synthetic organisation and asserts 404 with no leakage.

Operators can preview content before publishing ("Preview: not published" banner) for a draft update, a brief version and a deliverable version, and "Preview as customer" for everything published.

### 6. Briefs, approvals, changes

- **Brief versions** carry segments tagged `customer_statement`, `ai_suggestion` or `agreed_fact`. An AI-suggested segment reaches the customer only inside a version a person proposed, and is labelled. Accepting a brief records a shared understanding, not a contract.
- **Customer statements are only words the customer sent** (lead fix, 28 Oct 2026, `apps/portal/continuity.py` `customer_words`). From an inbound enquiry: the typed sections of the classic form, or, for a guided brief, the "You said" line, the visitor's answers and blocks marked "edited by you". Never the `[vitalos-brief]` marker, checklist or AI suggestion blocks, contact rows, sector or budget, and never a staff paste (staff may paste their own call notes). An opportunity without a source enquiry carries its problem and outcome as `agreed_fact`, Vitalos's own wording, for staff to review before proposing.
- **Approvals are version-specific.** An `Approval` records who (id, email, name, role), when and which `DeliverableVersion`. A new version starts unshared and unapproved and never inherits anything; approving v1 does not approve v2 (tested). A version that has been superseded by a newer shared version refuses decisions. A database constraint allows one approval and one contractual acceptance per version. Review approval and contractual acceptance are different kinds of record; contractual acceptance needs an authorised signatory, a version flagged contractual, an explicit confirmation and stores the exact statement shown. It is not an e-signature (later phase) and is evidence of the customer's action, not a substitute for the signed scope.
- **Change requests.** The portal can only request. Staff move a request through submitted, under review, accepted or declined with a customer-visible response and a trail (who, when, from and to). Accepting records the decision; scope, price and dates change only through the staff process, and the portal has no code path that edits them.

### 7. Notifications and delivery

In-app notifications are per user, unique per event (`dedupe_key`), and scoped to organisations the user is still a live member of. Email goes through `apps.mailer.system.send` only (the email-sender guard needs no exception), to live members only, respecting per-kind preferences. Each email has a durable `EmailDelivery` (queued, sent, failed; attempts; last error category, never message text). A failed send never blocks or loses the action: it is recorded, retried at most three times by `portal_send_pending`, never duplicated (a sent record is terminal and rows are locked), and visible to operators under Client portal > Email delivery with a manual retry. A retry re-checks that the recipient is still a member.

### 8. Files

Private storage alias `portal_files` (a private S3-compatible bucket when `PORTAL_FILES_BUCKET` is set, local disk in development, none in production, in which case the customer is told contents were not kept). Validation: allow-list of types, magic-byte sniffing, Office archives inspected for structure and macros, filename/extension match, UTF-8 for text, 10 MB cap, sanitised names, random keys, SHA-256 recorded. Downloads go through a view that re-checks visibility on every request and always sends an attachment with `nosniff` and a sandbox CSP.

### 9. AI boundaries

Six assistant activities (summarise my project, what changed since my last visit, what do you need from me, explain this deliverable, which questions are unanswered, help me clarify this challenge), each with a versioned prompt (`portal_<activity>@1`) and output schema through the `apps.aicore` gateway only. Context is built only from selector-visible records; every answer cites records with links and lists what is missing or possibly out of date; model dates not present in the records are dropped, so the assistant cannot promise a date; citations that do not map to a provided record are dropped, and an answer left with no valid citations falls back to the compiled one. The assistant never changes a milestone, approval, scope or date; it may draft text into the composer, which the customer edits and sends. When the model is unavailable (today's production state: no key, off, kill switch, budget) the answer is **compiled deterministically from the records** and labelled "Compiled from your project records: no AI used"; "What do you need from me?" and "Which questions are unanswered?" are fully answerable without a model. A hand-written replay fixture path labelled "Simulated answer for demonstration" exists only where `PORTAL_AI_REPLAY` is on (development and tests; forced off in production). Executions store metadata and hashes only.

### 10. Retention (proposal, not enforced)

Organisation, membership, approval and audit records are decision evidence and are kept for the life of the engagement. Approvals are protected from cascade deletion. Customer files carry a `retention_note`. No automatic deletion job exists yet; one needs a documented policy (ADR) and a dry run first, per AGENTS.md. Offboarding an organisation today means revoking its members and deactivating the organisation, which closes every surface and keeps the records.

### 11. Later phases (not built)

Live monitoring integrations (service status is manual only, labelled with source and last-updated, stale after `PORTAL_STATUS_STALE_HOURS`); contractual e-signature; email OTP and SSO for customers; customer self-service organisation administration; per-organisation retention jobs; billing visibility; inbound email into discussions; real-time updates; a customer-facing data export beyond the project CSV.

## Consequences

- Customer-facing code ships in the Super Admin deploy. A mistake in the boundary is a customer-data incident, so the boundary, isolation and internal-exclusion tests are release gates (they run in the existing Super Admin CI).
- New owner steps: the DNS record and Azure custom-domain binding for `portal.vitalos.co.uk`; a private bucket and `PORTAL_FILES_BUCKET` before customers upload production files; the `PORTAL_HOST`/`PORTAL_ENABLED`/`PORTAL_FILES_BUCKET` repository variables only if the defaults need changing.
- Customer email links, invitations and password resets are absolute `https://portal.vitalos.co.uk/...` links in production.
- `apps.portal` adds the admin area "Client portal" and a panel in the opportunity workspace (`templates/aidata/_opportunity_extensions.html`).
