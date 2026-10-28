# W6 status: guided, AI-assisted brief on /ai-data/contact

Paused at the coordinator's request (concurrency cap). No application code has been written yet; this checkpoint is investigation and design only.

## Done

- Dependencies installed in the worktree (Node 24 at /opt/nvm/versions/node/v24.22.1/bin on PATH; `corepack pnpm install --frozen-lockfile`).
- Read: shared brief, apps/web/AGENTS.md, enquiry server action, form state, AiDataEnquiryForm, `packages/validation/src/ai-data-enquiry.ts`, content signing/client/server, config schema, analytics events/sink, `superadmin/apps/aidata/intake.py`, AI & Data primitives and tokens, e2e and a11y layout.

## Findings that shape the design

- Intake parses the goal from `composeAiDataGoal`: sections "Business problem or workflow:", "Current tools and process:", "Desired outcome:", plus "Sector:" and "Indicative budget:". The brief must therefore be sent through the EXISTING action as the form fields `problem` (max 2000), `currentProcess` (max 1200), `desiredOutcome` (max 1000), so intake and the pipeline headers keep working unchanged.
- Contract signing differs from the repo's `signing.ts` (scheme v1: `v1\nscope\nts\nMETHOD\npath\nsha256`, signature header `v1=<hex>`). The shared brief specifies `POST\n<path>\n<ts>\n<sha256 hex of body>` with a plain hex signature. Implement the brief's version exactly in a separate helper; do not alter `signing.ts`. CONTRACT QUESTION for W7/main: confirm plain hex (no `v1=` prefix) and no scope line.
- `ENQUIRY_IP_HASH_SALT` is the existing salt; `visitor_ref = HMAC-SHA256(salt, "brief-assist\0" + ip)` (64 hex), via `saltedHash` in `@vitalos/security/rate-limit`.
- Website-side limiter: reuse `MemoryRateLimiter` (`features/content/http/guards.ts`), e.g. 12 calls per 10 minutes per hashed IP.
- E2E: setting `CONTENT_API_BASE_URL` in the e2e server would affect the content proxy for /insights and /careers. Plan: optional new env `BRIEF_ASSIST_BASE_URL` (falls back to `CONTENT_API_BASE_URL`), added to config schema, `turbo.json`, `.env.example`, and a small fake Super Admin for e2e. DECISION for main: acceptable?
- Existing no-JS e2e opens `/ai-data/contact` and expects `form#ai-data-enquiry-form`. Plan keeps this working by rendering the simple form inside `<noscript>` on the default URL, and by `?mode=simple` (a plain link, "Prefer a simple form?") rendering it for everyone.

## Design decided (not yet built)

- `apps/web/src/features/ai-data/brief/`: topics (4 shared slugs, starters, example chips), zod schemas and limits (description 20..1500 in the UI, API allows 4000; answers <=500), deterministic question bank (topic and keyword aware, 2-4 questions, each with a role and suggestion chips), deterministic brief drafting, serialiser, assist client (signed POST, 20 s timeout, injectable fetch, outcome union: ai | unavailable{not-configured, rate-limited, unavailable, timeout, invalid}), server actions `requestQuestionsAction` and `requestBriefAction` (require explicit opt-in literal true, zod-validated, per-IP limit).
- Serialisation: first line marker `[vitalos-brief v1 questions=ai|checklist brief=ai|checklist]`; every user-derived line starts with a fixed prefix (`You said:`, `Q:`, `A:`, `- `) so a visitor line can never be read by intake as `Sector:` or a section label. `currentProcess` carries the current workflow card, `desiredOutcome` the outcome card (fallback text of 10+ characters if removed), `problem` carries description, answers, automation, unknowns and next step. Per-section budgets with an ellipsis truncation.
- Components under `apps/web/src/components/ai-data/brief/` (no changes to `packages/ui`): GuidedBrief (client state machine: describe, questions, brief, share), BriefCard (You said / Suggested by AI / Suggested from our checklist / Edited by you; edit, remove, restore, aria-live save feedback), chips, opt-in disclosure, skeletons only during a real request, focus management and polite announcements, sessionStorage draft with "Start over".
- Share step is a form posting to `submitAiDataEnquiryAction` (name, work email, organisation, sector, timeframe, offer, consent, Turnstile, honeypot, hidden idempotency key). Thank-you page shows the shared brief from sessionStorage with a copy action.
- Docs to write: `docs/ai-data/engineering/guided-brief.md`, an append-only W6 section in ADR-054 (create with placeholder header if absent), W6 notes in TASKS.md and PLAN.md.

## Next steps, in order

1. Add `BRIEF_ASSIST_BASE_URL` to config, turbo env, `.env.example`.
2. Brief feature modules plus unit tests (bank, serialiser incl. limits and intake-safety, assist client: ai, unavailable, timeout, 429, 503, invalid; actions; visitor_ref).
3. Analytics block in `events.ts`: `brief_started`, `brief_ai_opt_in` (boolean), `brief_questions_answered` (count), `brief_completed`, `brief_shared`, `simple_form_submitted`; schema tests. Funnel per the coordinator: Workflow started (`brief_started`), Brief completed (`brief_completed`), Enquiry submitted (`brief_shared`); no free text.
4. Components, page integration (`?topic=`, `?mode=simple`, noscript), thank-you panel.
5. Idempotency (coordinator requirement): the share form carries a stable `idempotencyKey` generated once per brief (server-rendered UUID per page load, kept in the draft so retries and double clicks reuse it); the submit button is disabled while pending; the existing service already replays idempotently, so add a test that two submits with the same key give one record and the same reference. Verify against `receive-enquiry` behaviour before relying on it.
6. E2E (fake Super Admin), a11y checks, build, format/lint/typecheck/tests/boundaries, screenshots to `shots/w6-brief/` at 1440 and 390 (all states listed in the task).
7. Docs, ADR-054 section, TASKS/PLAN notes, final report.

## Open questions

- Signature format confirmation (plain hex, no scope line) with W7.
- Acceptance of the `BRIEF_ASSIST_BASE_URL` addition.
