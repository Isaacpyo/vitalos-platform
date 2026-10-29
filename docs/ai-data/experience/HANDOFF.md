# Handoff: AI & Data connected experience

_Lead handoff, overnight run of 28 October 2026. Change set: vitalos-technologies/vitalos-platform#106, merged as `dd61f63` and deployed on 28–29 October. Detail and evidence: [SCOPE.md](SCOPE.md) (acceptance criteria), [MILESTONES.md](MILESTONES.md) (lanes), [PROGRESS.md](PROGRESS.md) (log, decisions, blockers), [DEMO.md](DEMO.md) (click-through)._

## What works now

Everything below is merged and live in production (see "Merge and deploy" at the end). The AI switches are off, and no customer has been invited.

- **Marketing (`/ai-data`, ADR-054).**
  - **Hero:** a split layout with a walkthrough you step through yourself (input → read → check → review → what still needs a person). It is labelled "Synthetic data" and "Scripted example, not live AI", every check expands to its source line, and there are no fake timers.
  - **Below the hero:** the workflow explorer for the four topics, three use cases, a reconciliation preview, Discover → Prove → Build → Operate (and productise), the four offers by customer need, and a closing brief invitation.
  - **Demonstrator:** a workbench with three synthetic samples. The source sits beside the results, exceptions are shown in text and colour, evidence expands, "who does what" is explained, and the evaluation tables are in a secondary Evidence section (AC-14 still "not run").
  - **Components:** Base UI 1.9.0 wrappers (Popover, Dialog, Drawer, Toast, Tabs, Tooltip, Collapsible, CopyButton, Skeleton) in `@vitalos/ui/interactive`. Tokens come from one source (`packages/design-tokens`) for the website and the Super Admin.
- **Guided brief (`/ai-data/contact`).**
  - **Flow:** describe the workflow, answer 2–4 questions, then edit five brief cards tagged "You said", "Suggested by AI", "Suggested from our checklist" or "Edited by you".
  - **Sharing:** goes through the existing enquiry pipeline (validation, Turnstile, honeypot, rate limits, idempotency; three concurrent submits make one record).
  - **AI:** only after an explicit opt-in, through the Super Admin gateway (signed `assist` scope). Any failure falls back to the checklist with "AI was not used".
  - **Simple form:** one click away; it is also the no-JS fallback.
  - **Funnel events:** workflow started, brief completed, enquiry submitted (`brief_shared`), opportunity qualified (audited in the admin).
- **Admin workspace (`/ai-data/`, ADR-055).**
  - **Overview:** a work queue answering "needs my decision", "AI prepared", "blocked" and "next".
  - **Brief from a paste:** paste an enquiry to get an evidence-linked, editable brief. Blank stays blank, and duplicates are detected.
  - **Discovery and proposal:** a discovery pack, then a proposal drafted only from approved discovery. Nothing is ever sent.
  - **AI tasks:** durable, with lease recovery, bounded retries and idempotency.
  - **Assistant:** scoped to the opportunity.
  - **Reliability cases:** 22, labelled "reliability only".
  - **Brief-assist endpoint:** website brief assist is signed, rate-limited and off by default.
- **Client portal (`portal.vitalos.co.uk`, ADR-056).**
  - **Access:** invitation-only (single-use, expiring, hashed tokens), roles, isolation enforced on the server through scoped selectors, host-only cookies.
  - **Challenge workspace:** brief versions with provenance. "Your words" is only text the customer actually sent.
  - **Project workspace:** milestones (status labels, no percentages) and "What we need from you".
  - **Deliverables:** questions and answers, versioned deliverables with version-specific approval and change requests, and separate contractual acceptance for signatories.
  - **Files, notifications and services:** files are validated and served only to authorised users. Notifications have durable delivery records and bounded retries. Managed-service status is manual and labelled, and is marked stale after 72 hours.
  - **AI:** six activities with a labelled non-AI answer (today's production state).
  - **Staff side:** publishing, preview before publish, and "preview as customer".
- **Connected (W9):**
  - Linking an opportunity carries the approved brief as a draft brief version.
  - "Create portal project from proposal" is idempotent and copies no price.
  - Portal items appear in the admin work queue.
  - The admin shows "opportunity is at X; customer sees Y" with an explicit sync.
  - A status strip shows who is responsible, what is next, what is blocked, and what the customer needs to do.

## Minimum demonstration (owner's AC-1 to AC-12)

`superadmin/tests/test_experience_journey.py` runs the whole scenario through the real services and views on PostgreSQL:

- guided enquiry ingested once, even when delivered twice;
- brief prepared with AI off, and via the labelled simulated provider;
- operator edits and approves;
- invitation and sign-in;
- published information only;
- milestones and next action;
- question and answer;
- v1 changes requested, v2 approved, version-specific;
- decisions visible in the admin and the portal;
- second organisation gets 404 everywhere;
- AI-task and email failures are visible and recoverable without losing the enquiry.

[DEMO.md](DEMO.md) has the click-by-click version with local commands (`experience_seed_demo`, synthetic only, refuses outside DEBUG).

AC-1 has a gap: the website half is covered by the website e2e (`tests/end-to-end/ai-data-brief.spec.ts`, fake Super Admin). The Supabase → email → inbound-mail hop between the website and the Super Admin is the existing ADR-019/046 pipeline; locally the journey test injects the same notification format through the real inbound handler.

## Screenshots

Folder: `/tmp/claude-0/-home-user/c4f095cc-360d-5d23-a143-c311cf5ef6e4/scratchpad/shots/` (scratchpad of this session; a curated set was sent in the conversation). Every set has desktop (1440) and mobile (390):

| Set           | Contents                                                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `w5-web/`     | Hero stages, explorer, use cases, reconciliation preview, offers, dialog and toast, demonstrator states, no-JS and reduced motion                                                         |
| `w6-brief/`   | Describe, data-use note, loading, AI and checklist questions, provenance cards, edits, share, error, AI unavailable, thank-you, simple form                                               |
| `w7-admin/`   | Overview (empty and with data), composer, evidence preview, duplicates, workspace, discovery, proposal, running and failed tasks, toast, Viewer refused                                   |
| `w8-portal/`  | Sign-in and invitation, dashboard (empty and with data), challenge, project, deliverable, dialogs, questions, files, notifications, six AI activities (both modes), services, admin pages |
| `w9-journey/` | The 25-step connected walkthrough across admin and portal, including isolation and a failed email retried                                                                                 |
| `before/`     | The live pages before the redesign                                                                                                                                                        |

## Checks performed (lead, on the integrated tree)

- **Web:**
  - Commands: `pnpm format:check`, `check:raw-colours`, `check:turbo-env`, `content:types:check`, `lint`, `typecheck`, `test`, `check:boundaries`, `check:security` (`pnpm audit`: no known vulnerabilities), `check:email`, and `pnpm --filter web build`. All PASS.
  - The lanes also reported e2e (447 passed on W5; 256 on W6's subset), e2e-draft, axe and a11y, storybook-a11y, `seo:check`, and perf budgets. CI runs the full browser suites once the PR leaves draft.
- **Super Admin, PostgreSQL 16:**
  - Final tree (`f3c26c6`): ruff, format, the email guard, `makemigrations --check`, **pytest 1565 passed**, `recon_eval` (AC-1 to AC-13 pass, AC-14 not run), `aidata_eval` (22/22), bandit, and the migration guard (additive only). All PASS.
- **Secrets:** gitleaks 8.28.0 over history is clean (one false positive allowlisted by exact value). `pip-audit --strict` is clean on both requirements files.
- **CI on #106 (head `2fa8db6`, full ready-for-review run):** every job is green.
  - **Website:** quality (`pnpm audit`, format, the email guard, lint and typecheck, boundaries); unit tests and build; e2e plus axe WCAG 2.2 AA, the JS budgets and the client bundle secret scan; e2e-draft plus axe on the draft templates; e2e-sparse; e2e-askbridge; storybook-a11y; SEO with Lighthouse budgets; visual (no CI baselines existed, so this run recorded them for adoption).
  - **Database:** pgTAP.
  - **Super Admin:** lint, tests and deploy checks; email gallery; pip-audit and bandit; container build and browser smoke test.
  - **Code scanning:** CodeQL; gitleaks.
- **Independent review:** permission boundaries were reviewed on `471a52f`. There were no critical or high findings. All three medium and six low findings, and the question-id mismatch, are fixed with 50 new tests (W10, see PROGRESS.md). Cookie-name hardening (`__Host-`) and reset-endpoint timing are recorded as follow-ups in ADR-056.

## Known issues and configuration blockers

- **Live AI.** No model key reaches this repository (the organisation's `ANTHROPIC_API_KEY` is not shared with `vitalos-platform`). Every AI surface shows an honest unavailable state and a working non-AI path. To enable:
  1. Add `AI_DATA_LLM_API_KEY` as a `production` secret, or share the organisation secret.
  2. Re-run "AI & Data live evaluation" (`confirm=LIVE`).
  3. Then turn on "Live model path", and "Website brief assist" if wanted, in Super Admin › AI settings.
- **Portal files.** A private bucket and `PORTAL_FILES_BUCKET` are needed. Without them, uploads are refused with an honest message.
- **Payments.** These are carried over from #104: the Vitalos Stripe key and webhook, and the Super Admin `TURNSTILE_SECRET_KEY`.
- **Limits accepted for now:**
  - The website's brief-assist limiter is per instance; the Super Admin limits are the real backstop.
  - The contact route has about 3 KB of JS budget headroom.
  - The guided brief needs JavaScript (the simple form covers no-JS).
  - Guided-brief "Current tools" and "Desired outcome" sections carry no provenance in the notification (format v1), so they are never labelled "Your words".
  - Live monitoring integrations do not exist, so managed-service status is manual.
- **Pre-existing, not addressed:** the "Ask Vitalos" launcher overlaps the end of page content on 390 px phones, site-wide.

## Migrations and rollback

- **New migrations (all additive):** `aicore` 0002, `aidata` 0003, `portal` 0001 to 0004. They are CreateModel, AddField and constraints only, plus one RunPython backfill in `portal` 0003 that marks versions of already customer-visible files as visible. That is a no-op in production, which has no portal data yet.
- **Order:** they are applied by the release job before the new code serves traffic.
- **Rollback:** revert the merge. The tables can stay; nothing reads them after a revert. On the website, revert or roll back the Vercel deployment.

## Merge and deploy

- **Merged** on the owner's instruction ("Merge"): squash commit `dd61f63`, with all 19 checks green on the final head.
- **Website:** Vercel deployed it; the redesigned `/ai-data`, the demonstrator, the guided brief and `/pay` all return 200.
- **Super Admin:** the guarded deploy workflow backed up the database, ran the migrations in the release job, and switched to the new image. It is healthy on `dd61f63`.
- **Portal:** `portal.vitalos.co.uk` is live. Its Cloudflare record is DNS only and it has a free managed certificate. It serves only the portal: sign-in returns 200, and every admin route returns 404 on that host.
- **Still off or empty:** the AI switches stay off, nothing is seeded, and no customer is invited until staff invite one.
- **Evidence:** PROGRESS.md (29 Oct 00:05) has the probes and screenshots.

## Next highest-value task

1. Provide the model key and run the live evaluation (AC-14). It is the one thing that turns every "AI unavailable" path into the real assisted experience, and it gives the first honest evidence of model quality.
2. Then invite one friendly customer to the portal on a real (small) engagement.
