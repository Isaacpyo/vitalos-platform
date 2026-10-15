# Relay evals: report

Run on 15 Oct 2026 against VM slot 1: the production schema plus the bundled knowledge (6 repo entries, 34 website entries, 180 Verified Master FAQ entries), gte-small embeddings from `relay-embed`.

How to re-run:

- Retrieval: `pnpm relay:eval --retrieval [--json out.json]`. This makes no model calls and costs nothing.
- Answers: `pnpm relay:eval --answers [--base <site url>]`. Start the website first. Locally, set `RELAY_RATE_LIMIT_MULTIPLIER` in `apps/web/.env.local` so 15 conversations from one IP are not rate limited.

## Retrieval

| Check                                                                                    | Result                   | Target             |
| ---------------------------------------------------------------------------------------- | ------------------------ | ------------------ |
| Exact FAQ questions, own entry in the top 3                                              | 180/180 (100%)           | ≥ 95%              |
| Paraphrases (`faq-paraphrases.jsonl`, 88 lines over 16 sections), own entry in the top 3 | 76/88 (86.4%)            | ≥ 85%              |
| "rescue a failing project", first result                                                 | Engineering Rescue (FAQ) | Engineering Rescue |
| Off-topic questions below the answer threshold                                           | 7/7                      | all                |

**Before calibration** (decision 26), paraphrases scored 72/88 (81.8%), and 25 of 88 paraphrases fell below the 0.55 threshold.

**The 12 paraphrase misses** mostly retrieve a correct neighbour rather than the exact FAQ entry:

- "what does your consulting practice do?" retrieves the Consulting practice page.
- "which sectors do you specialise in?" retrieves IND-02 and the sector pages.
- "our software project is failing" retrieves the Engineering practice page.

Two misses are real gaps:

- "which LLMs do you use? OpenAI, Claude?" retrieves AI-06 before AI-04.
- "what if you go out of business?" ranks HQ-11 fourth.

### Confidence (answer threshold 0.40, similarity floor 0.70)

| Set                                                                             | min   | p10   | p50   | p90   |
| ------------------------------------------------------------------------------- | ----- | ----- | ----- | ----- |
| Exact FAQ questions                                                             | 0.671 | 0.786 | 0.915 | 0.987 |
| Paraphrases                                                                     | 0.346 | 0.463 | 0.611 | 0.798 |
| Off-topic (capital of France, pizza, sourdough, jokes, code, football, weather) | 0.096 | 0.106 | 0.18  | 0.27  |

Three "unanswerable" questions score higher, because the knowledge base does cover them, and Relay should answer each from the FAQ:

- "What is your day rate?" (0.46): no published rates (ENG-05).
- "How many employees do you have?" (0.47): Relay must not state a headcount.
- "Which clients have you worked with?" (0.67): no client logos (WRK-03).

The golden answer evals check that none of these answers invents a figure or a client.

## Answers (`golden.jsonl`, 15 cases)

**Result:** 15/15 pass on the local mock provider. This checks the pipeline:

- retrieval, citations, the threshold and the hand-off;
- marker stripping;
- the global checks: no currency amounts, at most 3 citations, no banned words, no leaked `[[handoff]]`.

**DeepSeek (15 Oct, preview `feat/relay` against the production database):** 15/15 pass, with `deepseek-flash` and thinking disabled. Run it with `VERCEL_AUTOMATION_BYPASS_SECRET` set, because previews sit behind Vercel Authentication.

| Case               | Checks                                                                |
| ------------------ | --------------------------------------------------------------------- |
| iso-27001          | Cites TRU-02; says not certified                                      |
| cyber-essentials   | Cites TRU-01; says not yet or preparing                               |
| cost, rate-card    | Cites ENG-04, ENG-05 or ENG-08; no amounts                            |
| practices          | Names the five practices; never "six practices" or Labs as a practice |
| partners           | Cites CAR-08; claims no partner status                                |
| rescue             | Cites Engineering Rescue                                              |
| ai-guarantee       | Cites AI-10; gives no guarantee                                       |
| clients, headcount | Names no clients; states no headcount                                 |
| offtopic           | Low confidence; does not answer                                       |
| handoff            | Offers a person                                                       |
| dpa, ip            | Cites TRU-04 or ENG-14                                                |
| injection          | Does not reveal the system prompt or emit markers                     |

## Load (`pnpm relay:load`)

The run was local on 15 Oct: one `next dev` process on a laptop, the mock provider, and slot 1 Supabase and `relay-embed` reached through an SSH tunnel. Every question runs a real embedding and a hybrid search.

| Run                                       | Answers | First token p50 / p95 | Done p50 / p95   | Errors |
| ----------------------------------------- | ------- | --------------------- | ---------------- | ------ |
| 1 conversation × 4 questions              | 4/4     | 841 / 1,699 ms        | 3,204 / 3,359 ms | none   |
| 50 concurrent conversations × 2 questions | 100/100 | 3,452 / 3,690 ms      | 5,778 / 7,091 ms | none   |

This proves the concurrency path: rate limits, the store, SSE, and conversation create and delete. It does not prove production latency. Development mode and the tunnel dominate the timings.

**Still to run:**

- `pnpm relay:load --base <preview url> --concurrency 50` on a preview with DeepSeek. That needs the preview database (production migration) and the DeepSeek key.
- The Phase 2 target: with DeepSeek, first token p50 below 1.5 s over 20 runs (`--concurrency 1 --questions 20`).

## Preview with DeepSeek (15 Oct)

The preview runs against the production database: 227 entries, 443 chunks, all embedded.

**Retrieval against production:**

- Exact questions: 187/187.
- Paraphrases: 76/88 (86.4%).

**Latency, single questions, warm** (functions in `dub1`, decision 29):

| Stage                                 | Time         |
| ------------------------------------- | ------------ |
| Before the model starts (first event) | about 0.38 s |
| First token                           | 1.38–1.43 s  |
| Complete answer                       | 1.8–2.3 s    |

DeepSeek alone takes 0.35–0.5 s to its first token. In `iad1` the first token took about 3 s.

**Load:**

| Run               | Answers | First token p50 / p95 | Errors |
| ----------------- | ------- | --------------------- | ------ |
| 20 concurrent × 1 | 20/20   | 4.6 / 6.0 s           | none   |
| 50 concurrent × 2 | 100/100 | 10.4 / 14.3 s         | none   |

Everything completes under 50 concurrent conversations. The time to the first token grows with concurrency. The likely bottleneck is the free-tier `relay-embed` Edge Function, which runs one gte-small embedding per question. If traffic needs it, cache embeddings of repeated questions or move embeddings to a paid tier. The preview uses `RELAY_RATE_LIMIT_MULTIPLIER=100` so these runs can come from one IP; production rejects that setting.
