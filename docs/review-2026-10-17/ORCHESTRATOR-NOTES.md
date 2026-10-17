# Orchestrator notes

## D1 — Relay token figure (diagnosis, 17 Oct, read-only)

Read-only look at the production `relay` schema (token columns and counts only; no message content):

- Per AI turn, `relay.messages.tokens_in` is 1,023–2,417 (13 AI turns over 3 conversations). Prompts are already well under the 8k per-turn target.
- `relay.usage_daily`: 15 Oct had 249 requests and 497,645 input tokens; 16 Oct had 7 requests and 11,995 input tokens (~1.7k per request).
- The messages account for about 22k input tokens. The other ~487k came from ~242 requests on 15 Oct that stored no conversation message. That pattern matches evaluation or load runs (`pnpm relay:eval`, `relay:load`) pointed at production on launch day, or another non-conversation call path, being counted in `usage_daily`.
- So the "127k per conversation" in Relay Insights is a measurement defect: period usage, test traffic included, shown beside the count of real conversations. It is not knowledge-base stuffing.

Fix direction (WS6 scope, applied at integration if WS6 did not cover it): tag usage by source so evaluation and load traffic is excluded or shown separately; show input tokens per AI turn (average, p95, max) in Relay Insights; keep the budget-leak fixes (the first chunk is always kept; FAQ chunks are unbounded).

## Production reads not shared with agents

The auto-mode classifier blocked passing production data to subagents. Workstreams therefore used only the repo, fixtures and public pages. Two items that needed admin data are follow-ups: WS4's verdicts on the 7 draft roles, and verifying the salary bands from the admin revision history.
