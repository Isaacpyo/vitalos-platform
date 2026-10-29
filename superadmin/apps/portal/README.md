# apps.portal: the Vitalos client portal

Customers track the challenges they discussed with Vitalos, collaborate on delivery, approve work and see managed
systems. Architecture, visibility model, auth, AI boundaries and retention: [ADR-056](../../../docs/adr/ADR-056-client-portal.md).

## Layout

| File                                       | Role                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `models.py`                                | Organisation, Membership, Invitation, Challenge, BriefVersion, Project, Milestone, Deliverable(Version), Approval, ChangeRequest, InformationRequest, Thread/Message, Update, File(Version), ManagedService/ServiceStatusReport, Event, Notification, EmailDelivery |
| `selectors.py`                             | **Every customer read.** Scopes by organisation and publication; foreign or unpublished records are 404.   |
| `services.py`                              | Every write: customer actions (role-checked) and staff actions (explicit publication). Audited.            |
| `access.py`                                | `portal_view` (member resolution, roles, preview), `staff_required`, URL helpers, last-visit tracking.     |
| `middleware.py`                            | `PortalRoutingMiddleware` (PORTAL_HOST) and `CustomerBoundaryMiddleware` (deny-by-default for customers).  |
| `notifications.py`                         | In-app notifications, preferences, email with durable `EmailDelivery`, bounded retries.                    |
| `files.py`                                 | Allow-list, content sniffing, size cap, private storage.                                                   |
| `ai.py`                                    | Six assistant activities: scoped context, deterministic answers, gateway path, validation, replay.         |
| `pwa.py`, `views/pwa.py`                   | Installable app: manifest values, the service worker's precache list and cache version, the three public routes. |
| `views/`                                   | `auth.py` (sign-in, invitation, reset, TOTP), `customer.py` (workspace), `staff.py` (Super Admin tools).   |
| `urls.py`, `preview_urls.py`, `admin_urls.py` | Customer routes; the same routes for staff preview; staff routes at `/client-portal/`.                  |
| `management/commands/portal_seed_demo.py`  | Synthetic data for local screenshots. Refuses to run unless DEBUG is on outside production.                |
| `management/commands/portal_send_pending.py` | Bounded retry of queued and failed portal emails (run from a scheduler).                                 |
| `fixtures/ai_replay/`                      | Hand-written, labelled "simulated" assistant answers for local demonstrations.                             |
| `static/portal/`, `templates/portal/`      | Customer UI (own stylesheet using the `--aid-*` token names; no framework). `templates/portaladmin/` is the staff UI. |

Prompts live with the gateway: `apps/aicore/core/prompt_configs/portal_<activity>@1.json`.

## URLs

- Customer, production: `https://portal.vitalos.co.uk/` (only portal URLs are served on that host).
- Customer, local: `http://localhost:8000/portal/` (when `PORTAL_HOST` is empty).
- Staff: `/client-portal/` (organisations, members, challenges, projects, deliverables, updates, questions, files, change requests, services, email delivery). "Preview as customer" is on each member row.
- Opportunity workspace: a "Client portal" panel (`templates/aidata/_opportunity_extensions.html`) links an opportunity to an organisation.

## Run it locally

```sh
cd superadmin
DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py migrate
DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py portal_seed_demo --staff-email staff.demo@example.test
# prints the synthetic password; sign in at /portal/sign-in/ as approver@northwind.example.test
```

The seed creates Northwind Synthetic Ltd and Contoso Synthetic plc (flagged synthetic; a banner shows), sends no email, and
refuses to run in production or without `DEBUG`. `--reset` rebuilds only the synthetic data.

## Installable app (Phase 1)

The portal installs as an app from the browser (no app store). The decision and the privacy rule are in [ADR-056, Phase 1](../../../docs/adr/ADR-056-client-portal.md#phase-1-installable-app-29-oct-2026).

| Route                  | Portal host             | Local preview                  | What                                                                      |
| ---------------------- | ----------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| `manifest.webmanifest` | `/manifest.webmanifest` | `/portal/manifest.webmanifest` | Web app manifest (`application/manifest+json`).                           |
| `sw.js`                | `/sw.js`                | `/portal/sw.js`                | Service worker, `no-cache`, rendered from `templates/portal/pwa/sw.js`.   |
| `offline/`             | `/offline/`             | `/portal/offline/`             | Public offline page (`noindex`, no organisation or member data).          |

None of the three exists on the admin host or in staff preview. The worker caches public static files and the offline page only: never a page, a partial, a download or an export. Signing out therefore needs no cache purge.

- **Mobile shell:** `templates/portal/_tabbar.html` (bottom tab bar) and the "Mobile app shell" block in `static/portal/portal.css`. It shows at 52rem or narrower and always in the installed app.
- **Head tags:** `templates/portal/_pwa_head.html`, added by `base.html` and `auth/shell.html` through the `portal_pwa` tag. The tag returns nothing in staff preview, without a request, or when a view passes `pwa_skip`.
- **Install card:** on the Account page. `portal.js` swaps the manual steps for an Install button, the iOS instruction or "Installed on this device".

### Regenerate the icons

The icons live in `static/portal/icons/` and are made from `apps/web/public/brand/vitalos-symbol-512.png` (the mark is not redrawn). To regenerate them, run this from the repository root and commit the PNGs:

```sh
pnpm install --frozen-lockfile                 # Playwright's Chromium comes with @playwright/test
node tooling/scripts/generate-portal-icons.mjs
```

### Test offline

1. Run the portal locally (above) and sign in at `http://localhost:8000/portal/sign-in/`. Service workers need a secure context. `localhost` and `127.0.0.1` count as one; a LAN address over plain http does not.
2. In DevTools, open Application. Under Service workers, `/portal/sw.js` should be active with scope `/portal/`. The Manifest pane should show the icons and no installability errors. Cache storage should hold only `/static/...` files and `/portal/offline/`.
3. In the Network panel, choose Offline, then open any portal page, including one you visited before. You should get the offline page, never a cached copy of the workspace.
4. Automated checks are in `tests/test_portal_pwa.py`. If the caching rules change but no static file does, bump `SW_REVISION` in `pwa.py`.

## Operator workflow (no duplicate entry)

1. Create the organisation, invite members (roles: viewer, contributor, approver, authorised signatory).
2. From the opportunity, **Link to client portal**: the customer's own words are copied in as a snapshot and a first brief draft (all `customer_statement`). Review, then **Share**.
3. Edit and **Propose** brief versions; tag each segment `customer:`, `fact:` or `ai:`.
4. Create the project, milestones (status label and target date; no percentage), responsibilities, dependencies, blockers and deliverables; **Publish** each.
5. Create a deliverable **version**, preview it, **Share** it (this also makes its file visible and notifies approvers).
6. Prepare an **update** as a draft, preview it, **Publish**.
7. **Ask a question** (owner, due date); answers appear on the challenge page.
8. Review **change requests** (submitted, under review, accepted, declined, with a response the customer sees).
9. Report **managed service** status by hand; it is labelled manual with its time and goes stale after 72 hours.
10. **Outstanding customer decisions** and **Email delivery** are on the Client portal overview.

## Configuration still needed before customers use it

| Setting                                | Where                                    | What                                                                                                                 |
| -------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| DNS and custom domain                  | Cloudflare DNS, Azure Container App      | `portal.vitalos.co.uk` CNAME to the app and the managed-certificate binding (owner/main session). Until then the portal host receives no traffic. |
| `PORTAL_HOST`                          | repo variable (optional)                 | Defaults to `portal.vitalos.co.uk` in production.                                                                    |
| `PORTAL_ENABLED`                       | repo variable (optional)                 | Defaults on in production when a host is set. Set `false` to take the portal host back to 404.                       |
| File storage                           | `PORTAL_FILES_BUCKET` (+ `OBJECT_STORAGE_*`) | A private bucket. Without it production keeps no file bytes and tells the customer so.                           |
| Retry of failed emails                 | none needed                              | The content tick (ADR-042) retries due portal emails (at most three attempts each). `manage.py portal_send_pending` does the same by hand. |

## Implemented and later

Implemented: everything above, the first-release journey end to end (invitation, set password, sign in, challenge, brief, milestones,
answer a question, review a deliverable, request changes or approve a specific version, recorded decision visible on both sides),
six assistant activities with deterministic fallbacks, notification preferences, delivery records, files with validation, and
the installable app (Phase 1: manifest, privacy-first service worker, offline page, mobile tab bar, install guidance).

Later phases: Web Push (VAPID keys and a dependency decision), native apps (paid store accounts the owner buys), live monitoring
integrations, contractual e-signature, email OTP and customer SSO, retention jobs, customer-side organisation administration, inbound
email into discussions.
