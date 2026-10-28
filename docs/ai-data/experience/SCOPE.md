# AI & Data connected experience: scope and acceptance criteria

Owner briefs of 28 October 2026: the marketing redesign, the admin AI workspace, the client portal, and the overnight execution brief. This file is the contract; [MILESTONES.md](MILESTONES.md) says who builds what, and [PROGRESS.md](PROGRESS.md) records the evidence.

## Outcome

One reviewable experience connecting:

Marketing → Challenge submission → AI-prepared brief → Admin review → Discovery and proposal → Customer project workspace → Milestones, discussions and deliverable approval.

A working journey comes before breadth.

## Surfaces and placement

| Surface       | Where                                                                                   | Stack                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Marketing     | `vitalos.co.uk/ai-data` (`apps/web`, Vercel)                                            | Next.js 16, `@vitalos/ui` plus Base UI 1.9.0 wrappers (ADR-054)                                           |
| Admin         | `admin.vitalos.co.uk/ai-data/` (`superadmin/apps/aidata`, Azure Container Apps)         | Django 6.1, HTMX, Tailwind; template components (ADR-055)                                                 |
| Client portal | `portal.vitalos.co.uk`, approved by the owner on 28 Oct 2026 (`superadmin/apps/portal`) | The same Django deployment, host-routed; customer users are role-less accounts with memberships (ADR-056) |
| AI            | `apps.aicore` gateway only                                                              | Kill switch, per-run, daily and monthly caps, schema validation; the live provider is off and has no key  |

Design tokens have one source: `packages/design-tokens` generates the CSS for both the website and the Super Admin.

## Acceptance criteria

These are the owner's minimum complete demonstration. Each criterion needs evidence in PROGRESS.md: a test, a screenshot or a recorded run. Configuration-blocked steps are marked as such and are never simulated without a label.

| #     | Criterion                                                                                                       | Evidence expected                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| AC-1  | A visitor submits a synthetic business challenge through the guided brief (or the simple form)                  | Web e2e and unit tests; screenshots                                                                             |
| AC-2  | The enquiry is saved once (idempotent; double click and retry make no duplicates)                               | Server action tests (existing idempotency plus the brief path); Super Admin intake dedupe test                  |
| AC-3  | AI prepares a brief, or the system says clearly why AI is unavailable and offers the non-AI path                | Website and admin tests for the available (replay), unavailable, timeout and invalid cases; screenshots of both |
| AC-4  | An operator edits and approves the brief; the suggestions become agreed facts only on approval; history is kept | Admin journey test; brief version records                                                                       |
| AC-5  | The authorised customer sees the correct published information, and nothing internal                            | Portal test on internal-content exclusion; screenshots                                                          |
| AC-6  | A project shows milestones and a next action                                                                    | Portal and admin screenshots; test                                                                              |
| AC-7  | The operator asks a question and the customer responds                                                          | End-to-end test; both sides visible                                                                             |
| AC-8  | The operator publishes a specific deliverable version                                                           | Test; screenshots                                                                                               |
| AC-9  | The customer requests changes or approves that version; approval is version-specific                            | Test that approving v1 does not approve v2                                                                      |
| AC-10 | The decision appears correctly in the admin and the portal (who, when, which version)                           | Test; screenshots                                                                                               |
| AC-11 | Another synthetic customer cannot access those records, files, AI answers, search, notifications or exports     | Isolation test module over every surface                                                                        |
| AC-12 | A provider or notification failure is visible and recoverable without losing the original enquiry               | Tests for a failed or stale AI task and retry, and a failed notification and retry; screenshots                 |

Cross-cutting criteria:

- **XC-1 Visibility:** internal-only, draft and published boundaries are enforced on the server for pages, APIs, files, search, AI context, activity, notifications, previews and exports.
- **XC-2 Durable AI tasks:**
  - States: queued, running, completed, failed and cancelled.
  - Reloading a page keeps the task.
  - Stale leases recover.
  - Retries are bounded and idempotent.
  - Outputs are validated.
  - Missing facts stay unknown.
- **XC-3 Honest labels:** the interface tells apart live AI, rules (deterministic), replayed or simulated output, and scripted sample previews.
- **XC-4 Accessibility:**
  - Keyboard use, focus trap and return in dialogs, and visible focus.
  - Contrast.
  - Reduced motion.
  - No horizontal overflow at 320, 390 and 768 px.
- **XC-5 Performance:** route bundle measured before and after on the website; heavy demonstrations lazy-loaded; LCP content server-rendered.
- **XC-6 Funnel:** Workflow started → Brief completed → Enquiry submitted (website analytics, with no free text or personal data) → Opportunity qualified (audited admin event).
- **XC-7 Gates:** the repo's gates pass: web format, lint, typecheck, unit tests, boundaries, build, SEO and e2e; Super Admin ruff, pytest on PostgreSQL, the migrations check, the deploy guard, bandit, the email guard, the evaluation gate and `check --deploy`.
- **XC-8 Reliability evaluation:** cases for incomplete enquiries, contradictory notes, unsupported claims, malicious embedded instructions and provider failure, run on replay or simulated providers and reported separately from live model quality (AC-14 of the demonstrator is still not run).

## Out of scope (deferred)

- Extensive product-incubation scoring.
- New billing systems.
- Autonomous outreach.
- Live monitoring integrations: none exist, so managed-service status is reported by hand and labelled as such.
- Contractual e-signature.
- Live model-quality claims.
- Any production seeding of demonstration data.

## Production boundaries

- Merging to `main` deploys the website (Vercel) and the Super Admin (Azure). AGENTS.md pre-approves this for AI & Data work. The owner asked for a reviewable change set and preview, so the integrated PR is presented with its preview and evidence before merge.
- `portal.vitalos.co.uk`: the owner approved the host on 28 Oct 2026. The DNS records (Cloudflare, DNS only) and the Azure managed certificate are created by `superadmin/deploy/azure/deploy.sh` in the guarded deploy workflow, never by hand.
- No live model calls, no Stripe calls, no external email outside tests, and no production data changes.
