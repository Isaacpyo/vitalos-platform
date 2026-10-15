# ADR 032 Relay LLM provider: DeepSeek behind a swappable interface

Status: Accepted (engineering, 15 October 2026). Adds DeepSeek to the approved AI tools for Relay. Production use waits for the privacy-notice update (owner).

## Context

Relay answers visitor questions from published Vitalos knowledge. The owner chose DeepSeek for cost: `deepseek-flash` (DeepSeek-V4.1-Flash) costs about $0.001 per typical answer (prices checked on DeepSeek's pricing page, 15 October 2026). DeepSeek's privacy policy says data is stored on servers in the People's Republic of China.

## Decision

1. An `LlmProvider` interface (`streamAnswer`, `generateSummary`) in `@vitalos/relay-core`, with two implementations:
   - `DeepSeekProvider`: Vercel AI SDK `ai` 7 with `@ai-sdk/deepseek`, base URL `https://api.deepseek.com`, model from `RELAY_MODEL` (default `deepseek-flash`).
   - A deterministic `MockProvider` for tests, previews and environments without a key.

   `RELAY_LLM_PROVIDER=deepseek|mock` selects one. `deepseek-chat` and `deepseek-reasoner` are retired and never used.

2. Thinking is disabled (`providerOptions.deepseek.thinking = { type: 'disabled' }`). Temperature 0.3, at most 700 output tokens, no tools in the chat path.
3. **Data minimisation before every call:**
   - personal data is redacted (email, phone, postcode, NHS number, NI number, card, bank details);
   - contact details from the hand-off form never reach the model;
   - history is limited to 8 turns;
   - the privacy notice and the composer caption say Relay is AI.
4. **Cost controls:**
   - the static system prompt goes first and stays byte-stable, so DeepSeek's prefix caching applies;
   - per-request usage and estimated cost go to `relay.usage_daily`;
   - a daily token cap and a kill switch are enforced.
5. Timeouts: 15 s to first token, 45 s in total. One retry with jitter, before the first token only.

## Options

A UK/EU-hosted model (higher cost; the interface allows a later swap); OpenAI or Anthropic (not chosen by the owner, for cost); a self-hosted open model (operating burden).

## Consequences

Visitor questions are processed in China, after redaction. The privacy notice must say so before production; a transfer assessment is drafted in `docs/relay/PRIVACY.md` for owner approval. Swapping providers touches only `src/llm/`.

## Revisit triggers

The privacy review rejects the transfer; DeepSeek changes model names or pricing; evals fall below target.
