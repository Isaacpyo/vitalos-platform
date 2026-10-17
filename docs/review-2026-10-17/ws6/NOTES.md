# WS6 notes: Relay quality and cost

Branch `review/ws6-relay`, worktree `D:/Development/vitalos-ws6` (moved from C:, which was full). ADR: [ADR-048](../../adr/ADR-048-relay-retrieval-budget-small-talk-widget.md). Decisions: [DECISIONS.md](DECISIONS.md). Copy: [COPY-CHANGES.md](COPY-CHANGES.md).

## D1: where 509,640 input tokens for 4 conversations came from

- The Insights token tiles read `relay.usage_daily`: one row per day, summing **every** model call (`add_usage` adds a delta per call, which is correct). They are not joined to conversations.
- Calls that record usage with no surviving conversation message:
  - `pnpm relay:eval --answers` (15 cases; run against the production database from a preview on 15 Oct, per docs/relay/evals/REPORT.md). Each case creates a conversation, asks, then `DELETE`s it, which cascades to its messages. Its tokens stay in `usage_daily`.
  - `pnpm relay:load` does the same (local runs went to slot 1, but nothing stopped a run against production).
  - Hand-off summaries (`generateSummary`): usage with no AI message.
  - Stopped streams: an estimate (as intended, for the cap).
- `toUsage(totalUsage)` in `deepseek.ts` is correct: one step (no tools), and `inputTokens` includes cached tokens, which `estimateCostUsd` subtracts.
- So "~127k per conversation" = period usage including test traffic ÷ the 4 conversations that still exist. The per-turn prompt the code builds was about 3–5k tokens. It could grow (an oversized first chunk was always kept), but nowhere near 127k.
- Fixes:
  1. Measurement. Usage is tagged by source (`chat`, `summary`, `aborted`, `test`) in `relay.usage_by_source`; the harnesses send `utm_source=relay-eval|relay-load`. Insights now show input tokens per AI answer (count, average, p95, maximum) from `relay.messages.tokens_in`, usage by source, and label the old tiles "all model calls". Each AI message stores `meta.prompt_tokens_est`, and a `relay.turn` log line carries tokens in and out plus the estimate (no content).
  2. Budget leaks fixed (chunk cap, skip rather than keep, FAQ split, history cap, hard total of 8,000).
- To confirm on production (read-only, after the migration): compare `select sum(tokens_in) from relay.messages where sender_type='ai' and created_at >= now() - interval '7 days'` with `relay.usage_daily` for the same days. The difference is summaries, stopped answers and deleted/test conversations.

### Tokens per turn on the 25-question set (memory store, mock model)

`pnpm relay:eval --turns`. "Before" ran the same harness against the relay code at `9e37e21`; tokens are input tokens of the one model call, estimated from exactly what was sent. With the mock model and memory store the prompt was already about 2.5k tokens per turn, which confirms that the 127k figure was not prompt size. Embeddings are off in this harness (full text only).

| Question               | Before: tokens | Before | After: tokens | After |
| ---------------------- | -------------: | ------ | ------------: | ----- |
| abt-01                 |           2735 | FAIL   |          2662 | pass  |
| abt-12                 |           2717 | pass   |          2702 | pass  |
| ai-03                  |           2424 | pass   |          2421 | pass  |
| ai-08                  |           2522 | pass   |          2495 | pass  |
| con-04                 |           2742 | pass   |          2720 | pass  |
| del-03                 |           2630 | pass   |          2665 | pass  |
| eng-05                 |           2352 | pass   |          2349 | pass  |
| eng-16                 |           2290 | pass   |          2287 | pass  |
| hq-08                  |           2356 | pass   |          2495 | pass  |
| ind-01                 |           2778 | pass   |          2714 | pass  |
| ind-16                 |           2757 | pass   |          2754 | pass  |
| lab-01                 |           2754 | pass   |          2740 | pass  |
| ms-08                  |           2573 | pass   |          2580 | pass  |
| off-04                 |           2142 | pass   |          1896 | pass  |
| off-10                 |           2140 | pass   |          2137 | pass  |
| off-16                 |           2238 | pass   |          2166 | pass  |
| sol-01                 |           2818 | pass   |          2590 | pass  |
| sol-09                 |           2150 | pass   |          2147 | pass  |
| tru-04                 |           2697 | pass   |          2694 | pass  |
| wwd-01                 |           2461 | pass   |          2585 | pass  |
| gap-hello              |           1147 | FAIL   |             0 | pass  |
| gap-founder            |           2757 | pass   |          2654 | pass  |
| gap-solutions-typo     |           1152 | FAIL   |          2523 | pass  |
| gap-getting-started    |           2415 | pass   |          2463 | pass  |
| gap-modernise-followup |           2471 | pass   |          2346 | pass  |

Before: 22/25 pass, avg 2,409 / p95 2,778 / max 2,818. After: 25/25 pass (also 25/25 with the drafted entries approved), avg 2,491 / p95 2,740 / max 2,754, budget 8,000. "Hello" now makes no model call (0 tokens).

## Check results (17 Oct)

- relay-core vitest: 11 files, 119 tests pass (including `services/review.test.ts`). relay-knowledge: 14 pass (including the turn eval in both modes). relay-widget: 10 pass (including `launcher.test.tsx`).
- tsc and eslint are clean for relay-core, relay-knowledge, relay-widget and `@vitalos/web`. One existing warning in `apps/web` `components.test.tsx` is not from WS6.
- Playwright, chromium + mobile: `tests/end-to-end/relay.spec.ts`, `tests/accessibility/relay.spec.ts` and WS5's `tests/end-to-end/relay-closed.spec.ts` (copied in from `review/ws5-measurement` for the run, not committed here) all pass: 46 tests. An earlier single-project run had 4 axe-spec timeouts while the cold server started. They passed on the rerun.
- pgTAP on VM slot 2 (released): 5 files, 142 tests pass, including `005_relay_review.sql`.
- Django: 703 pass. `tests/test_security.py` has 2 failures that only occur on this laptop: the production-settings subprocess fails with `WinError 10106`, a Windows socket provider error, before any assertion. They are unrelated to WS6 and pass in CI on Linux. ruff check and format are clean, and `makemigrations --check` reports no changes.
- WCAG 2.5.3: the launcher's accessible name is "Ask Vitalos. Open chat with Relay, the Vitalos assistant", which starts with the visible text. `aria-controls` is set only while the panel is mounted.

## Master FAQ entries that still say "five practices" (owner to correct in Notion)

The snapshot is synced from Notion and was not edited:

- **ABT-01** "What does Vitalos do?": "Vitalos works through five practices … with Vitalos Labs as a separate research and technical proof capability."
- **LAB-01** "What is Vitalos Labs?": "… separate from its five practices."
- **WWD-01** "How are Vitalos services organised?": "Vitalos Labs sits alongside them as a separate capability."
- **WWD-12** "How does Vitalos Labs relate to the five practices?": the question and answer describe five practices with Labs separate.

After the Notion edits, run the FAQ sync (or `pnpm --filter @vitalos/relay-knowledge faq-snapshot` and commit). Until then, an FAQ source can contradict the system prompt's six practices.

## Entries awaiting confirmation (repo, drafts)

`founder.md`, `solutions-list.md`, `getting-started.md`, `modernise-my-system.md` in `packages/relay-knowledge/content/`. To approve one: set `status: published`, delete `confirmation: needed`, then run `build-content`. Every sentence's source is in COPY-CHANGES.md.

## For WS5 and the orchestrator

- Analytics: listen for `window` `vitalos:relay` events. `detail.type` is `opened`, `question` or `handoff`, and nothing else is in `detail`. Exported as `RELAY_EVENT` from `@vitalos/relay-widget`. Not wired to `track()` (WS5 owns that).

## For WS7

- Overview: `get_client(user).overview()` returns `{awaitingConfirmation, awaitingConfirmationFaq, awaitingConfirmationRepo, gapsThisWeek, waitingNow, liveNow, sync:{cms,repo,faq:{lastSyncAt,ageHours,stale,errors}, oldestAgeHours, stale, staleAfterHours}}` (docs/relay/API.md). The fake implements it.
- Display name: `apps/relay/client.py` `staff_name()` reads `user.display_name` when it exists, then `full_name`, else "Vitalos team".

## Follow-ups

- Apply `supabase/migrations/20261017090000_relay_review.sql` to production **before** deploying this code (approval item). Without it, typo tolerance is off, usage is untagged, and the new Insights fields read 0. Feedback reasons are not stored, but nothing breaks.
- The `relay-ingest` schedule only runs once the Vault secrets used by the other Relay jobs exist (`relay_cron_base_url`, `relay_cron_secret`).
- Optional: `pnpm relay:eval --retrieval` on a slot with embeddings, to re-check the paraphrase recall after the typo corrector (not run: no embedding function on the VM slot tonight).
