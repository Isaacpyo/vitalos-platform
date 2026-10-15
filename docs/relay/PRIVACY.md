# Relay: privacy notice section and DPIA note (DRAFT, not published)

Status: **draft for owner approval.** None of this text is on the website. Relay stays off in production (`RELAY_ENABLED=false`) until the owner approves a privacy notice version that covers it (decision 19). Points marked **OWNER** need a decision, and points marked **LEGAL** need checking against the provider's current terms. Nothing here has been checked by a lawyer.

## 1. What Relay does with personal data (facts from the code)

| Data                                                                             | When                                    | Where it is stored                                                   | Sent to the AI model?                  |
| -------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| Messages the visitor types                                                       | Every message                           | Website database (Supabase), `relay.messages`                        | Yes, **after redaction**               |
| Page URL and title, referrer, campaign tags                                      | Conversation start                      | `relay.conversations`                                                | Page path only                         |
| Browser user agent, device type, country (from the hosting edge)                 | Conversation start                      | `relay.conversations`                                                | No                                     |
| One-way hash of the IP address (salted HMAC)                                     | Conversation start, rate limits         | `relay.conversations`, `relay.rate_limits`                           | No                                     |
| Name, email, organisation (optional), consent time and notice version            | Only when the visitor asks for a person | `relay.conversations`                                                | **Never**                              |
| Helpful / not helpful votes                                                      | When given                              | `relay.messages`                                                     | No                                     |
| AI-written summary of the conversation for the team                              | After a hand-off                        | `relay.conversations.summary`                                        | Generated from the redacted transcript |
| Conversation id and visitor token                                                | After the first message                 | Visitor's browser, `localStorage` key `vitalos.relay.v1`             | No                                     |
| Alert copy (visitor name, first 280 characters of the message that triggered it) | Hand-off and reminders                  | Super Admin database (`RelayNotification`); alert emails to the team | No                                     |

Redaction (`packages/relay-core/src/redact`) runs before every model call. It replaces email addresses, phone numbers, UK postcodes, National Insurance numbers, NHS numbers (mod 11), card numbers (Luhn), IBANs (mod 97), and sort codes and account numbers with placeholders. The model never receives the hand-off name, email or organisation.

Relay uses no analytics, advertising or tracking. The browser storage is written only after the visitor sends a first message, because it is strictly necessary for the conversation they asked for. It holds no personal data beyond the conversation id and token.

## 2. Proposed privacy notice section (for the next notice version)

> **Relay, our website assistant**
>
> Our website has an optional chat assistant, Relay. Relay answers questions about Vitalos using an AI model and the information published on this website. If you ask, it passes the conversation to a member of our team.
>
> **What we collect.** We collect what you type, the page you are on, the page that referred you, any campaign tags in the link you followed, your browser type and approximate country, and a one-way hash of your IP address that we use to prevent abuse. If you ask to talk to a person, we also collect your name, email address and, optionally, your organisation, with your consent.
>
> **The AI model.** Relay sends your messages to DeepSeek, our AI model provider, to generate answers. Before anything is sent, we remove email addresses, phone numbers, postcodes, account and card numbers and similar identifiers. We never send your name, email address or organisation. DeepSeek processes this data on servers in the People's Republic of China. **[OWNER/LEGAL: the transfer safeguard. See section 3.]** Please do not type sensitive personal information into Relay.
>
> **Why we use it.** We use it to answer your question, to let our team reply if you ask for a person, and to keep the service secure. Our lawful basis is our legitimate interest in answering enquiries about our services. When you ask for a person, it is also your consent to us contacting you about that enquiry. **[OWNER: confirm the lawful basis. See section 3.]**
>
> **How long we keep it.** We delete conversations where you did not leave contact details after **[90 days]**, and conversations with contact details after **[12 months]** from the last message. **[OWNER: confirm. Enquiries are kept for 24 months. Pick one rule or keep both.]** You can delete a conversation at any time from the chat menu.
>
> **Who we share it with.** These providers process Relay data on our behalf: DeepSeek (AI answers), Supabase (database), Vercel (hosting), Cloudflare (bot protection), Resend (email) and **[Microsoft Azure (our internal team console)]**.
>
> **Your rights.** You have the same rights as for any other data we hold. See "Your rights" above.

## 3. DPIA note (short form)

**Purpose.** Answer visitor questions about Vitalos from published content, and hand conversations to the team on request.

**Necessity and proportionality.** Relay collects only what the conversation needs. Contact details are optional and collected only for a hand-off. Visitor text is redacted before the model sees it. History sent to the model is capped at 8 turns, and messages at 2,000 characters.

**Lawful basis options (OWNER):**

1. Legitimate interests (answering enquiries, security), with a short legitimate interests assessment. This matches the enquiry form today.
2. Consent at first message. This is stronger for the DeepSeek transfer, but it adds friction and needs a withdraw mechanism. Delete conversation already exists.

The recommendation is option 1 for the chat, plus explicit consent for hand-off contact details (already built: the tick records `RELAY_PRIVACY_NOTICE_VERSION`).

**Processors (LEGAL: confirm the DPA and transfer terms for each):**

| Processor       | Role                                          | Location (as understood)                | Safeguard to confirm                                                                                                                                     |
| --------------- | --------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DeepSeek        | Model inference (redacted text only)          | People's Republic of China              | There are no UK adequacy regulations for China. Needs the UK IDTA or Addendum and a transfer risk assessment, or a different provider. **Highest risk.** |
| Supabase        | Website database, embeddings (Edge Function)  | Per project region (**OWNER: confirm**) | Existing DPA (already listed in the notice)                                                                                                              |
| Vercel          | Hosting                                       | Existing                                | Existing                                                                                                                                                 |
| Cloudflare      | Turnstile bot check                           | Existing                                | Existing                                                                                                                                                 |
| Resend          | Team alert emails; visitor reply emails (off) | Existing                                | Existing                                                                                                                                                 |
| Microsoft Azure | Super Admin hosting (alerts, quotes)          | **OWNER: confirm region**               | Microsoft DPA                                                                                                                                            |

**Risks and mitigations:**

| Risk                                                                                      | Mitigation                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal data reaches DeepSeek despite redaction (for example, a name typed in free text) | Pattern redaction, a composer notice, no contact fields sent, and the provider is swappable (`LlmProvider`). Residual risk: free-text names and special category data typed by visitors. |
| The model invents claims about Vitalos                                                    | Answers only from retrieved sources, a confidence threshold, hand-off when low, and golden evals (`docs/relay/evals`).                                                                   |
| Conversation hijack                                                                       | 32-byte visitor tokens stored as HMAC, constant-time comparison, single-use resume tokens.                                                                                               |
| Abuse and cost                                                                            | Turnstile, per-IP rate limits, a daily token cap and an AI kill switch in Settings.                                                                                                      |
| Over-retention                                                                            | `relay.purge_expired` (dry-run supported). **Not scheduled until the owner confirms the periods** (decision 20).                                                                         |

**Visitor rights.** Delete conversation (widget menu) removes the conversation and its messages at once. Access, correction and other requests go through support@vitalos.co.uk. The team can find a conversation by email in the Relay inbox and delete it there (audited).

**Sign-off:** **OWNER**, before `RELAY_ENABLED=true` in production.
