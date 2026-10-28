# Guided brief on /ai-data/contact (W6)

The contact page offers a guided, optionally AI-assisted way to describe a workflow, and keeps the plain form one click away. This note is the working record: flow, data handling, the serialisation format the Super Admin intake reads, configuration and tests. Decision record: the W6 section of ADR-054.

## Flow

1. **Describe.** A prompt-style textarea (20 to 1,500 characters) with example chips. `?topic=<slug>` prefills an editable starter. The four shared slugs live in `apps/web/src/features/ai-data/workflows.ts`; an unknown slug is ignored.
2. **Questions (2 to 4).** Each has quick-answer chips and a free-text answer, all optional. They come from the AI endpoint only if the visitor opted in and it answered; otherwise from the deterministic bank (`features/ai-data/brief/question-bank.ts`: topic- and keyword-aware, skips what the description already says). The step says which it is: "Questions suggested by AI" or "Questions from our checklist: no AI used".
3. **Brief.** Five cards: current workflow, desired outcome, possible automation, unknowns, suggested next step. Each is labelled "You said", "Suggested by AI", "Suggested from our checklist" or "Edited by you", and can be edited, reverted, removed and restored, with an inline polite status line. The checklist next step names the existing offers and a conversation; it contains no price, date or commitment (asserted in tests).
4. **Share.** Contact details (name, work email, organisation, sector, timeframe, optional offer interest, consent, human check) are asked for only now. The form posts to the existing `submitAiDataEnquiryAction`, so validation, rate limits, Turnstile, honeypot, idempotency and the ADR-019 pipeline (`X-Vitalos-Pipeline: ai-data`, `X-Vitalos-Offer`) are unchanged.
5. **Thank-you.** `/ai-data/contact/thank-you` shows the shared brief from this tab's sessionStorage with a copy action and a "remove this copy" button.
6. **Simple form.** `?mode=simple` (the "Prefer a simple form?" link and the "Simple form" switch) renders the unchanged `AiDataEnquiryForm`. Without JavaScript the default URL shows that form (server-rendered, hidden by `@media (scripting: enabled)` and removed after hydration); the guided brief needs scripts.

## Data handling

- The description and answers go to the AI endpoint only after an explicit opt-in checkbox (off by default, not remembered across sessions) next to a plain explanation: the text is sent to Vitalos's systems and on to the AI model provider to suggest questions and draft the brief, and is kept only if the brief is shared. The page makes no claim about the provider's own handling. If AI is not configured the opt-in is replaced by a notice and the checklist runs.
- The browser never calls the endpoint. Two Server Actions (`features/ai-data/brief/actions.ts`) validate input with zod (opt-in literal `true`, lengths, slug, 0 to 6 answers), apply a per-IP limit (`MemoryRateLimiter`, 12 calls per 10 minutes per hashed IP, per instance) and call the signed client.
- `visitor_ref` is `HMAC-SHA256(ENQUIRY_IP_HASH_SALT, "brief-assist\0" + ip)` as 64 hex characters. The raw IP is never sent or logged. No salt means AI is unavailable.
- Signing uses the existing scheme v1 (`features/content/signing.ts`) with the new scope `assist` and the read key (`CONTENT_READ_KEY_ID`, `CONTENT_READ_SECRET`): `POST {base}/api/ai-data/brief-assist/`, body `{version:1, stage, description, topic, answers, visitor_ref}`. The base is `BRIEF_ASSIST_BASE_URL`, else `CONTENT_API_BASE_URL`. 20 s timeout, no retry.
- Anything other than a valid 200 (not configured, 429, 503, 400, 401, timeout, network error, bad JSON, wrong shape) becomes "AI unavailable": the checklist runs, a warning says "AI was not used" and why, and nothing is ever labelled AI that was not. Model output is cleaned (control characters, lengths, at most 4 suggestions) before use.
- The draft lives in sessionStorage only (`vitalos.aid.brief.v1`), is never sent anywhere until the visitor shares, and "Start over" clears it. The shared copy for the receipt is `vitalos.aid.brief.shared.v1`.
- Duplicate submissions: the draft carries one `idempotencyKey` for the whole brief (kept across reloads, replaced on Start over). The enquiry service replays a repeated key to the original reference and stores one record; the button is also disabled while pending. Tested with concurrent submits.

## Events (no free text)

`brief_started {topic}` (first input), `brief_ai_opt_in {enabled}`, `brief_questions_answered {count, source}`, `brief_completed {source, cardsKept, cardsEdited}` (the visitor chose to share the brief), `brief_shared {source}` (receipt page, once per reference), `simple_form_submitted {route}` (receipt page when no brief was shared). Funnel with W5's `workflow_started`: started, completed, shared. The Vercel sink now also forwards numbers and booleans.

## Serialisation format (version 1)

The brief is sent as three existing enquiry fields, so `composeAiDataGoal` and `superadmin/apps/aidata/intake.py` need no change:

| Enquiry field    | Goal label                      | Content                                                                                                  |
| ---------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `problem` (2000) | `Business problem or workflow:` | marker, what the visitor said, follow-up answers, suggestion sections                                    |
| `currentProcess` | `Current tools and process:`    | the current workflow card (omitted if the card was removed)                                              |
| `desiredOutcome` | `Desired outcome:`              | the desired outcome card, or "Not described in the guided brief; to discuss on a call." if removed/blank |

`problem` is line-oriented:

```
[vitalos-brief v1 questions=ai|checklist brief=ai|checklist]
You said: <description on one line, at most 400 characters>
Follow-up answers (you said):
Q: <question>
A: <answer>
Possible automation (suggested by AI | suggested from our checklist | edited by you):
- <item>
Unknowns (<same provenance wording>):
- <item>
Suggested next step (<same provenance wording>): <text>
```

- The marker is the first line of `problem`; parse it with `^\[vitalos-brief v(\d+) questions=(ai|checklist) brief=(ai|checklist)\]$`.
- Every line that carries visitor text starts with a fixed prefix (`You said:`, `Q:`, `A:`, `- `), so it can never be read as `Sector:`, `Indicative budget:` or a section label. Removed cards are left out. Sections are cut with an ellipsis to fit the limits (problem 2000, process 1200, outcome 1000 code points).
- The offer interest is the existing `offer` select (`offerSlug`, and the `X-Vitalos-Offer` header). "Not sure yet" records none.

## Configuration

- `BRIEF_ASSIST_BASE_URL` (optional, server-only, falls back to `CONTENT_API_BASE_URL`), plus the existing `CONTENT_READ_KEY_ID` and `CONTENT_READ_SECRET`. The Super Admin side needs the "Website brief assist" switch on and a configured provider; until then every visitor gets the checklist.
- E2E: `tests/support/fake-brief-assist.mjs` stands in for the Super Admin (started by `playwright.config.ts`, `BRIEF_ASSIST_BASE_URL` points at it; `CONTENT_API_BASE_URL` stays unset).

## Tests

Unit: question bank, cards, serialiser (limits, intake-safety, real validation), assist client (signature verified with `verifyRequest`, 200, 429, 503, 400, 401, invalid payloads, timeout, network), assist service (opt-in, limits, visitor_ref), reducer and persistence, sharing through the real action (headers, idempotency), analytics schemas. E2E (`tests/end-to-end/ai-data-brief.spec.ts`): describe and prefill, short input, checklist path to receipt, AI path with the fake, 503/429/invalid fallbacks, draft and Start over, pending button, simple form; axe on each step. The existing no-JS spec still passes.
