# Milestones, dependencies and ownership

The lead (main session) owns the architecture, the shared contracts, integration, final verification and these documents. There are at most three implementation agents at a time, each working in an isolated git worktree. Agents commit locally; the lead reviews, merges into `claude/amazing-cray-miqs1x` and runs every gate on the combined tree.

## Lanes

| Lane                    | Workstream        | Scope                                                                                                                                                                                                                                                                                                                    | Owns (files)                                                                                                                                                                                           |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Marketing and design  | W5                | Base UI wrappers and new primitives, the `/ai-data` homepage (split hero with a step-through workflow, explorer, use cases, reconciliation preview, Discover/Prove/Build/Operate, offers, CTA), the demonstrator, demo analytics                                                                                         | `packages/ui/**`, `packages/design-tokens/src/ai-data*` (website tokens), `apps/web/app/(ai-data)/ai-data/{page,demonstrator,solutions,approach}`, `apps/web/src/components/ai-data/*` except `brief/` |
| 1 Marketing and design  | W6 (after W5)     | Guided brief on `/ai-data/contact`, the brief-assist client, idempotent submit, funnel events                                                                                                                                                                                                                            | `apps/web/app/(ai-data)/ai-data/contact/**`, `apps/web/src/components/ai-data/brief/**`, `apps/web/src/features/ai-data/brief/**`, the enquiry action                                                  |
| 2 Admin and AI workflow | W7                | AI workspace components, overview work queue, opportunity workspace, the journey from paste enquiry through brief, discovery and proposal, durable AI tasks, reliability evaluations, the brief-assist endpoint, admin tokens CSS                                                                                        | `superadmin/apps/aidata/**`, `superadmin/templates/aidata/**`, `superadmin/templates/components/**`, `superadmin/apps/aicore/core/prompt_configs/**` (new prompts), the admin token generator          |
| 3 Customer portal       | W8                | `apps.portal`: organisations, memberships, invitations, challenges, brief versions, projects, milestones, deliverables and versions, approvals, change requests, information requests, discussions, updates, files, notifications, managed services, AI activities, admin publishing, preview as customer, `PORTAL_HOST` | `superadmin/apps/portal/**`, `superadmin/templates/portal/**`, the portal admin templates                                                                                                              |
| Review                  | after integration | An independent review of the integrated diff, focused on permission boundaries, isolation, the visibility of internal content and AI context                                                                                                                                                                             | Read-only                                                                                                                                                                                              |

## Shared files and resolution rules

These are edited by several lanes; the lead resolves conflicts at integration:

- `superadmin/apps/core/navigation.py`, `superadmin/config/settings/*.py`, `superadmin/config/urls.py`, `superadmin/assets/tailwind.css`, `superadmin/static/js/app.js` (W7 and W8).
- `templates/aidata/_opportunity_extensions.html`: W7 creates it empty, W8 fills in the portal panel.
- `apps/web/src/features/analytics/events.ts`: W5 owns the demo and workflow-started block, W6 the brief and submit block.
- `docs/ai-data/{PLAN,TASKS}.md`: each lane appends its own section.
- Migrations: W7 adds `aidata` 0003 onward; W8 adds `portal` 0001 onward, depending on `aidata` 0002 only. All migrations are additive (deploy guard).
- `superadmin/deploy/azure/deploy.sh` and `.github/workflows/superadmin-deploy.yml`: W8 adds the `PORTAL_*` env; the lead adds the second custom domain (`portal.vitalos.co.uk`) to the DNS and binding step.

## Contracts

These are fixed in the agents' shared brief:

- Topic slugs: `finance-reconciliation`, `document-intake`, `customer-requests`, `operational-reporting`.
- Brief-assist endpoint: `POST /api/ai-data/brief-assist/`, HMAC-signed with the website's content key material, returning `questions` or `brief` responses, with 400, 401, 429 and 503 errors. The website times out after 20 s and falls back to rules.
- Ownership boundary: W7 owns opportunity, discovery and proposal; W8 owns everything a customer can see (challenge, project, milestone, deliverable, approval, update, file, notification). The portal's Challenge links to `aidata.Opportunity`, which keeps the original enquiry.
- ADRs: 054 (website foundation and guided brief), 055 (admin AI workspace), 056 (client portal).

## Milestones

| ID  | Milestone                                                                                                                           | Depends on | Owner           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------- |
| M0  | Facts established, contracts written, lanes started                                                                                 | none       | Lead            |
| M1  | Website foundation and redesigned marketing pages pass the gates                                                                    | M0         | W5              |
| M2  | Admin AI workspace and journey through to the proposal draft pass the gates                                                         | M0         | W7              |
| M3  | Portal first journey passes the gates                                                                                               | M0         | W8              |
| M4  | Guided brief passes the gates                                                                                                       | M1         | W6              |
| M5  | Integration: one branch, the admin opportunity ↔ portal challenge link, shared tokens unified, all gates green on the combined tree | M1–M4      | Lead            |
| M6  | Demonstration of AC-1 to AC-12 run locally with synthetic data, with screenshots at desktop and mobile                              | M5         | Lead            |
| M7  | Independent review; findings fixed                                                                                                  | M5         | Reviewer + lead |
| M8  | PR with Vercel preview, CI green, handoff written; merge and deploy (with portal domain binding) per AGENTS.md                      | M6, M7     | Lead            |
