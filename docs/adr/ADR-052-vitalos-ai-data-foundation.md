# ADR 052 Vitalos AI & Data: launch foundation on the existing platform

- **Status:** Accepted (engineering), 28 Oct 2026. Live model calls stay off until the owner sets `AI_DATA_LLM_API_KEY` (AID-012).
- **Owner request:** "deliver the first working commercial and engineering foundation" for Vitalos AI & Data (launch brief, 28 Oct 2026; blueprint VAD-OPS-001 v1.0, VAD-001 to VAD-010).
- **Decision log:** `docs/ai-data/DECISIONS.md` (AID-001 to AID-016) holds the individual choices; this ADR records the architecture.

## Context

Vitalos AI & Data is the applied AI and data engineering business of Vitalos for UK SMEs. Its blueprint prefers Next.js, FastAPI/Python, PostgreSQL, private Google Cloud Storage, Cloud Run, Secret Manager and GitHub Actions, and a lean modular monolith (blueprint §10). It also says not to add technology for its own sake and to reuse what exists.

What already exists here: the public site on Vercel (vitalos.co.uk) with an enquiry pipeline that stores the record before notifying (ADR-019), the Super Admin (Django, sign-in with TOTP, roles, audit trail, PostgreSQL, deployed to Azure Container Apps from `main`; ADR-026), and an email path from website notifications into the Super Admin inbox (ADR-046). The session had no valid Google Cloud credential, and a new GCP project with billing would be a paid commitment.

## Decision

1. **Public site:** a division section at `/ai-data` in `apps/web` (route group `(ai-data)`, its own header and footer, AI & Data design tokens). No new domain (DNS needs the owner).
2. **Enquiries:** the AI & Data form validates its own fields and submits through the existing enquiry service and contract (`intent: "ai"`, composed text). No database migration. The notification email carries `X-Vitalos-Pipeline: ai-data` and `X-Vitalos-Offer`.
3. **Pipeline:** Super Admin app `apps.aidata` — opportunities (stages, owner, next action, notes, dates, weighted qualification score), proposed offer prices and a budget ledger. The enquiries ingest creates an opportunity from a notification with the pipeline header, idempotently.
4. **AI Engineering Core:** Super Admin app `apps.aicore`. Its `core/` package (providers, gateway, prompt configs, limits, pricing, redaction, evaluation) imports nothing from Django, so it can be mounted in a FastAPI service for a client engagement. Django adds execution metering (`ModelExecution`) and settings (kill switch, caps).
5. **Demonstrator:** Super Admin app `apps.recon_demo` — supplier statement reconciliation. Deterministic parsing and Decimal reconciliation; the model only reads layouts the parser cannot, behind grounding checks; exceptions and uncertainty go to human review.
6. **One provider adapter:** OpenAI-compatible chat completions, configured by `AI_DATA_LLM_BASE_URL`, `AI_DATA_LLM_MODEL` and the secret `AI_DATA_LLM_API_KEY`.
7. **Evaluation:** versioned synthetic datasets in the repository; `manage.py recon_eval` is a CI gate (offline, simulated model responses labelled as such) and a manual live workflow (`ai-data-live-eval.yml`, production environment, hard call cap).

### Mapping to the blueprint's proposed layout (§10.6)

| Blueprint                | Here                                                     |
| ------------------------ | -------------------------------------------------------- |
| `apps/web`               | `apps/web/app/(ai-data)/ai-data`                         |
| `services/api` (FastAPI) | Super Admin Django apps (`aidata`, `recon_demo`)         |
| `packages/ai-runtime`    | `superadmin/apps/aicore/core` (gateway, limits, pricing) |
| `packages/evaluation`    | `superadmin/apps/aicore/core/evaluation.py`              |
| `packages/security`      | Super Admin roles, audit, `aicore/core/redaction.py`     |
| `packages/contracts`     | `packages/validation` (AI & Data enquiry schema)         |
| `infra`                  | Existing Vercel and Azure deploy workflows               |
| `docs/…`, `project/`     | `docs/ai-data/`                                          |

## Options considered

- **New `vitalos-ai-data` repository with FastAPI on Cloud Run:** closest to the blueprint text; rejected for now because it duplicates auth, database, deploy and enquiry handling that exist, and needs a GCP billing commitment.
- **A paid CRM (HubSpot, Pipedrive):** subscription cost and a new processor for enquiry data; unnecessary at launch volume.
- **Demonstrator on the public website:** no authentication for review decisions and public model spend; rejected. The site explains the demonstrator with a labelled static example and the evaluation summary.

## Consequences

- AI & Data shares the Super Admin's availability and deployment. A client production system must not run inside the Super Admin; it gets its own isolated deployment decided per engagement (blueprint §10.5).
- The core is reuse level R2 (documented, tested) at most until reused in two engagements.
- Opportunity contact details are personal data: same 24-month retention as enquiries (`aidata_retention`, not scheduled yet).
- Without a model key, the model path is unavailable: unreadable statement layouts go to manual review. That is a designed degraded mode, not a failure.

## Revisit when

A paying client needs isolation; the owner chooses GCP; enquiry volume needs structured reporting columns; a second engagement reuses the core.
