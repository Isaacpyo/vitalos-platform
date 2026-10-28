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
- [ ] PR opened, CI green, squash-merged
- [ ] Production verified: vitalos.co.uk/ai-data pages and enquiry path; Super Admin deploy healthy
- [ ] Completion report with external prerequisites

## Checkpoint

_Last updated: 28 Oct 2026, W1–W4 integrated on `claude/amazing-cray-miqs1x`._

- Local gates on the integrated branch: web format, lint, typecheck, unit tests (976), build, boundaries; Super Admin ruff, migrations check, pytest on PostgreSQL (1,123), bandit, email guard, `check --deploy`, evaluation gate (AC-1–AC-13 pass; AC-14 not run).
- Known pre-existing issue outside scope: `check:raw-colours` flags two `rgb()` shadows in `packages/relay-widget/src/panel.css` (also on `main`; not run in CI).
- Next action: open the PR, get CI green, squash-merge, verify production (`/ai-data` pages; Super Admin deploy health), then complete the report.
