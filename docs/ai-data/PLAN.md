# Vitalos AI & Data — launch milestone plan

Milestone: blueprint VAD-001 to VAD-010, in proportion to the first sale (blueprint §21, §23.1), plus the processes VAD-011 onward need. Owner of plan and integration: the lead agent session. Decisions: [DECISIONS.md](DECISIONS.md). Tasks: [TASKS.md](TASKS.md).

## Outcome

1. A public AI & Data presence with a working enquiry flow.
2. Enquiries become opportunities in an authenticated internal pipeline.
3. Usable commercial and delivery templates.
4. One demonstrator (supplier statement reconciliation) with reproducible evaluation evidence.
5. A minimal reusable AI engineering core.
6. Tested deployment, monitoring, configuration and recovery documentation.

Out of scope: the twenty-product catalogue, a general agent platform, Kubernetes, GPUs, model training, new paid services, contacting prospects, sending proposals or making commercial commitments.

## Architecture (ADR-052)

```text
Visitor ──> vitalos.co.uk/ai-data  (Next.js, Vercel; apps/web route group "(ai-data)")
              │ AI & Data form → server action → existing enquiry service (ADR-019)
              ▼
         Supabase: enquiries + notification_outbox  (record first, then notify)
              │ outbox dispatch → email (Resend) with X-Vitalos-Pipeline: ai-data
              ▼
         support@ → Cloudflare Email Worker → Super Admin ingest (admin.vitalos.co.uk)
              │ Enquiry (form relay) → Opportunity (stage New), idempotent per enquiry
              ▼
         Super Admin /ai-data/: Pipeline · Offers (proposed prices) · Budget · Demonstrator
                                                          │
                                       apps/recon_demo ── apps/aicore (gateway, limits,
                                                          metering, evaluation, redaction)
                                                          │ provider: OpenAI-compatible
                                                          ▼ (off until AI_DATA_LLM_API_KEY)
```

### Shared contracts

| Contract                               | Producer → consumer                   | Definition                                                                                                                                                    |
| -------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enquiry body                           | AI & Data form → enquiry service      | Existing `EnquiryInputV2`: `intent: "ai"`, `sourcePath: "/ai-data/contact"`, optional `offerSlug` (offer keys below), composed `goal` (labelled sections)     |
| Notification headers                   | Website notifier → Super Admin ingest | `X-Vitalos-Pipeline: ai-data` when the source path starts with `/ai-data`; `X-Vitalos-Offer: <offer key>` when one was chosen; existing `X-Vitalos-Reference` |
| Offer keys                             | Site, form, Super Admin               | `ai-opportunity-assessment`, `ai-proof-of-value`, `production-ai-engineering`, `managed-ai-operations`                                                        |
| Sector keys                            | Form, Super Admin                     | `accounting-bookkeeping`, `property`, `automotive`, `professional-services`, `trades-field-services`, `retail-ecommerce`, `other`                             |
| Budget band keys (AI & Data form only) | Form → composed text                  | `under-1k` (Under £1,000), `1k-5k` (£1,000–£5,000), `5k-15k` (£5,000–£15,000), `over-15k` (Over £15,000), `not-sure` (Not sure yet)                           |
| Demonstrator report                    | `recon_eval` command → website page   | `apps/web/src/features/ai-data/demonstrator-report.json` (schema in `engineering/demonstrator.md`); `status: "pending"` until a real evaluation run writes it |

### Composed enquiry text (`goal`)

```text
Vitalos AI & Data enquiry
Sector: <label>
Business problem or workflow:
<text>
Current tools and process:
<text or "Not given">
Desired outcome:
<text>
Indicative budget: <label or "Not given"> (enquirer's estimate)
```

## Workstreams and ownership

| Workstream                                    | Owner              | Files                                                                                                                                                                                                                       |
| --------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1 Public site and AI & Data form             | Agent A (worktree) | `apps/web/app/(ai-data)/**`, `apps/web/src/features/ai-data/**`, `apps/web/src/components/ai-data/**`, notifier headers, `packages/validation` (AI & Data schema), design tokens (AI & Data tokens), sitemap entries, tests |
| W2 Pipeline, offers, budget                   | Agent B (worktree) | `superadmin/apps/aidata/**`, its templates, nav entry in `templates/base.html`, ingest hook, "Create opportunity" on enquiry detail, tests                                                                                  |
| W3 AI core, demonstrator, evaluation          | Agent C (worktree) | `superadmin/apps/aicore/**`, `superadmin/apps/recon_demo/**`, their templates, eval CI step, tests                                                                                                                          |
| W4 Commercial assets                          | Agent D (worktree) | `docs/ai-data/commercial/**`                                                                                                                                                                                                |
| Integration, docs, ADR, CLAUDE/AGENTS, deploy | Lead               | `docs/**` (except commercial), `AGENTS.md`, `superadmin/config/**` merges, CI, PR, deploy                                                                                                                                   |

## Completion checklist (persistent)

Update the boxes as work lands. A box is ticked only with evidence in TASKS.md.

- [x] Blueprint read; workspace, repos, hosting, enquiry pipeline, Super Admin and credentials inspected
- [x] Plan, decision log, task register, demonstrator acceptance criteria committed before evaluation
- [x] W1 public site pages built, responsive, accessible; AI & Data form submits through the existing pipeline
- [x] W2 pipeline (stages, owner, next action, notes, dates, scorecard), offers, budget in the Super Admin; intake from enquiries
- [x] W3 AI core (provider interface, validation, versioning, timeouts/retries, ids/audit, metering, limits, kill switch) and demonstrator; offline evaluation report
- [x] W4 commercial templates and checklists
- [x] ADR-052, architecture docs, operations runbook, AGENTS.md/CLAUDE.md autonomy section
- [x] Integrated branch: format, lint, typecheck, unit tests, boundaries, build, Super Admin ruff/pytest/migrations check, evaluation gate
- [x] Screenshots of site and Super Admin pages (desktop and mobile)
- [x] PR opened, CI green, squash-merged (vitalos-technologies/vitalos-platform#102 → `ed64d58`)
- [x] Production verified: vitalos.co.uk/ai-data pages (200, sitemap, headers) and Super Admin deploy healthy; a live enquiry through the human check is an owner step (below)
- [x] Completion report with external prerequisites

## Checkpoint

_Last updated: 28 Oct 2026, launch milestone delivered._

- `main` at `ed64d58` (PR #102, squash-merged). All CI green on `main`: CI, Super Admin (PostgreSQL tests, evaluation gate, container smoke), CodeQL, secret scan.
- Website: production deployment `vitalos-platform-cefs1uag8` (Vercel, READY). `/ai-data`, `/solutions`, `/approach`, `/demonstrator`, `/contact` answer 200, are in the sitemap, carry the security headers and no `noindex`; thank-you is `noindex`. **Merging to `main` did not create a Vercel deployment** (no Git-triggered deployments in the last day; see runbook §1), so production was deployed from a clean checkout of `main` with `vercel deploy --prod`.
- Super Admin: `Super Admin deploy` run for `ed64d58` succeeded; `/healthz/` 200; every `/ai-data/` page redirects anonymous users to sign-in.
- Not verified in production: a real enquiry end to end (Turnstile human check needs a person) and the support@ → Super Admin email route (no access to Cloudflare Email Routing settings).
- Next actions (owner): see "External prerequisites" in `commercial/20-first-sale-readiness.md` and the completion report; first, one test enquiry from a `@vitalos.co.uk` address at `/ai-data/contact`, then confirm it appears as an opportunity (stage New) and close it as Lost with reason "test".

## Client portal (ADR-056)

Workstream W8, 28 Oct 2026. A customer portal inside the Super Admin (`apps.portal`) that follows the journey Submitted challenge, Discovery, Assessment, Proposal, Active project, Handover, Managed operations, keeping the original opportunity and its discussion attached.

- **Where:** `https://portal.vitalos.co.uk` (owner decision; only portal URLs are served on that host). `/portal/` path mounting is local preview only. Staff tools are at `/client-portal/` and a "Client portal" panel sits in the opportunity workspace.
- **Access:** staff invite members (single-use, expiring, hashed token through `apps.mailer`); roles viewer, contributor, approver, authorised signatory; axes lockout; optional TOTP. An enquiry never creates access.
- **Visibility:** explicit publication per record, scoped selectors, internal fields never rendered, searched, emailed, exported or sent to the AI. Deliverable approvals are version-specific; change requests are request-only with a review trail.
- **AI:** six read-only activities through `apps.aicore` with a deterministic, labelled fallback (today's production state: no model).
- **Not built (later phases):** live monitoring integrations (status is manual, labelled, goes stale), contractual e-signature, email OTP and customer SSO, retention jobs, customer-side organisation administration.
- **Owner steps before customers use it:** DNS record and Azure custom-domain binding for `portal.vitalos.co.uk`; a private bucket and `PORTAL_FILES_BUCKET` for file uploads; optional `PORTAL_HOST` / `PORTAL_ENABLED` variables (see `superadmin/apps/portal/README.md`).
- **Checkpoint:** implemented and tested in the worktree branch (see the task register, PORTAL-01 to PORTAL-12). Not deployed; nothing is exposed until the custom domain resolves to the app.
