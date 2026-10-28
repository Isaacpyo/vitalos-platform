# Progress, decisions, evidence and blockers

Newest entries first. Each entry gives the time (UTC), what changed, and the evidence or the next step.

## Current state

- **M0 done.** W5 (marketing), W7 (admin) and W8 (portal) are running in isolated worktrees. W6 (guided brief) is paused at a committed checkpoint, under the three-agent cap, and resumes after W5.
- **Next for the lead:** add the portal custom domain to the deploy script, then integrate each lane as it reports.

## Facts established (28 Oct 2026, before implementation)

Verified working; no rebuild needed:

- **Enquiry durability (ADR-019):**
  - `submit_enquiry` writes the enquiry and its outbox row in one transaction.
  - The idempotency key is unique; a replay returns the original reference.
  - The AI & Data form already sends `idempotencyKey`, and has a test.
- **Notification delivery:**
  - The outbox has a lease (`FOR UPDATE SKIP LOCKED`), counts attempts, and dead-letters to `failed`.
  - Retryable and permanent errors are told apart.
  - Delivery happens best-effort straight after submit (`after()`), with a daily Vercel cron (`/api/internal/outbox/dispatch`, 06:00) as the fallback.
- **AI:**
  - `apps.aicore` gateway: providers are Anthropic (official SDK), OpenAI-compatible, Simulated, Replay and Recording.
  - It has a kill switch, per-run, daily and monthly caps, schema validation and metering (`ModelExecution`).
  - The demonstrator's offline evaluation AC-1 to AC-13 passes.
- **Super Admin roles:** SuperAdmin, ServiceLead and Viewer. A user without a role has no access.
- **Payments:** `/pay` and the Super Admin billing are live (#104).

Existing functionality that needs improvement (in scope):

- The `/ai-data` hero is oversized and text-only.
- The demonstrator is explanatory rather than usable.
- The contact page is a plain form.
- The admin AI & Data overview is navigation cards rather than a work queue.
- The opportunity page has no brief, discovery or proposal workspace.

Missing functionality (in scope):

- A guided brief.
- AI-prepared briefs with sources.
- Discovery packs and proposal drafts.
- Durable AI task states in the admin.
- The whole client portal: no customer auth, organisations, projects, deliverables or approvals exist.

Blocked by configuration (not in code):

- **Live AI.** The live provider is off and there is no `AI_DATA_LLM_API_KEY` (the organisation's `ANTHROPIC_API_KEY` is not shared with this repo), so live AI results and the demonstrator's AC-14 cannot be produced. Every AI surface ships with an honest unavailable state and a non-AI path.
- **Stripe.** No Vitalos Stripe key or webhook secret is configured.
- **Turnstile on the Super Admin.** `TURNSTILE_SECRET_KEY` is not set for the Super Admin, so `/pay/checkout/` relies on the honeypot and rate limits only.
- **Outbox fallback cadence.** On the Vercel Hobby plan, cron fallback dispatch is daily; a notification retry may take up to a day if `after()` fails. This is an existing limitation, recorded in ADR-019.

Outside this implementation's scope:

- Live monitoring integrations.
- Contractual e-signature.
- Product-incubation scoring.
- Autonomous outreach.

## Decisions

| Date        | Decision                                                                                                                                                                                                       | Why                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 28 Oct 2026 | Base UI 1.9.0 (MIT) under `@vitalos/ui`, as owned shadcn-style components; no Radix; no lucide (the in-house monoline icon set is extended); no React Flow or Recharts unless real interactive data needs them | One coherent foundation; the existing design system and ADR-023/024 stay valid; small dependencies                                       |
| 28 Oct 2026 | The Super Admin and the portal stay Django, HTMX and template components, with native `<dialog>`, the Popover API and live regions                                                                             | They are not React; no framework rewrite (owner brief)                                                                                   |
| 28 Oct 2026 | The client portal lives inside the Super Admin deployment, host-routed to `portal.vitalos.co.uk` (owner approved the host), with host-only cookies                                                             | It shares records with the admin, so nothing is entered twice; auth, mailer, audit and the AI gateway are reused; no new service or cost |
| 28 Oct 2026 | Website AI assistance goes through the Super Admin `aicore` gateway via an HMAC-signed endpoint; the website falls back to rules                                                                               | AGENTS.md: model calls go only through `apps.aicore`; credentials stay on the server                                                     |
| 28 Oct 2026 | At most three implementation agents at a time; W6 paused until W5 finishes                                                                                                                                     | Owner instruction                                                                                                                        |

## Log

- **28 Oct 19:00: W7 (admin workspace) reported and was merged** into `claude/amazing-cray-miqs1x` (merge `cd98ceb`, 87 files).
  - **Lead review:** the brief-assist endpoint checks the signature before reading any field or switch, fails closed with no keys, rate-limits per visitor and globally, and stores hashes only. Every workspace view is gated to SuperAdmin or ServiceLead. The `mark_safe` call only wraps static icon markup. The migrations (`aidata` 0003, `aicore` 0002) are additive.
  - **Decision kept:** Viewers stay refused on all AI & Data pages (ADR-026: opportunities hold personal data). A redacted read-only view would be an owner decision.
  - **Pre-existing defect found** (not in CI): `pnpm check:raw-colours` fails on `main` because of two raw `rgb()` shadows in `packages/relay-widget/src/panel.css`. It is outside this scope and logged for a follow-up.
  - **W6 resumed** (the cap allows three: W5, W6, W8) with the amended signing contract: the existing v1 scheme with the new scope `assist`.

- **28 Oct 18:10:**
  - The owner approved `portal.vitalos.co.uk` and the overnight execution brief.
  - W6 paused at a checkpoint.
  - The additional requirements (durable tasks, visibility surfaces, notification retries, evaluation cases, funnel) were sent to W5, W7 and W8.
  - `portal.vitalos.co.uk` currently has no DNS records (checked over DoH), so it is free to create.
- **28 Oct 17:56:** #105 (docs checkpoint) merged.
- **28 Oct 17:50:** W5 to W8 started, each with the shared brief (lead scratchpad `briefs/shared.md`, summarised in MILESTONES.md).

- **28 Oct 19:30: W9 (integration seams and demonstration).** Full Super Admin gate green on the combined tree before changes (1486 passed). Added: the approved brief and the original enquiry carry into a linked challenge as a draft with provenance tags; "Create portal project from proposal" (idempotent, unpublished, no prices); portal items and stuck AI tasks in the work queue; the opportunity-stage to customer-stage map with an audited "Update customer-visible stage"; a status strip for staff; `experience_seed_demo`; `tests/test_experience_journey.py` (AC-1 to AC-12 plus failure recovery); [DEMO.md](DEMO.md). Migration `portal` 0002 is additive. Screenshots: lead scratchpad `shots/w9-journey/`.
