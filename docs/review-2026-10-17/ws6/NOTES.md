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

See "Check results" below for the before/after table.

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

- Analytics: listen for `window` `vitalos:relay` events. `detail.type` is `relay_opened`, `relay_question` or `relay_handoff`, and nothing else is in `detail`. Exported as `RELAY_EVENT` from `@vitalos/relay-widget`. Not wired to `track()` (WS5 owns that).

## For WS7

- Overview: `get_client(user).overview()` returns `{awaitingConfirmation, awaitingConfirmationFaq, awaitingConfirmationRepo, gapsThisWeek, waitingNow, liveNow, sync:{cms,repo,faq:{lastSyncAt,ageHours,stale,errors}, oldestAgeHours, stale, staleAfterHours}}` (docs/relay/API.md). The fake implements it.
- Display name: `apps/relay/client.py` `staff_name()` reads `user.display_name` when it exists, then `full_name`, else "Vitalos team".

## Follow-ups

- Apply `supabase/migrations/20261017090000_relay_review.sql` to production **before** deploying this code (approval item). Without it, typo tolerance is off, usage is untagged, and the new Insights fields read 0. Feedback reasons are not stored, but nothing breaks.
- The `relay-ingest` schedule only runs once the Vault secrets used by the other Relay jobs exist (`relay_cron_base_url`, `relay_cron_secret`).
- Optional: `pnpm relay:eval --retrieval` on a slot with embeddings, to re-check the paraphrase recall after the typo corrector (not run: no embedding function on the VM slot tonight).
