# Relay: server-to-server contract (website ⇄ Super Admin)

The website (`apps/web`, `@vitalos/relay-core`) owns conversations and knowledge in the `relay` schema of the website database. The Super Admin (Django) owns staff, roles, alerts, preferences and admin email (ADR-035). They talk only through the two signed HTTP interfaces below. Neither side reads the other's database.

## Signing (both directions)

```
X-Relay-Timestamp: <unix seconds>
X-Relay-Admin:     <base64url(JSON)>        admin API only; omitted for webhooks
X-Relay-Signature: v1=<hex HMAC-SHA256(secret, canonical)>

canonical = ts + "\n" + METHOD + "\n" + pathWithQuery + "\n" + (X-Relay-Admin or "") + "\n" + hex(SHA-256(raw body bytes))
```

- Admin API secret `RELAY_ADMIN_API_SECRET`. Webhook secret `RELAY_WEBHOOK_SECRET`. Each is 32+ random bytes and set on both apps. Values are never logged.
- The receiver rejects a missing or bad signature (401 `bad_signature`), or a timestamp more than 300 s from its clock (401 `stale`). It compares in constant time. `pathWithQuery` is the request path plus query exactly as sent (e.g. `/api/relay/admin/inbox?tab=needs`).
- `X-Relay-Admin` = `{"id":"sa:12","name":"Temitope Agbola","initials":"TA","email":"…","role":"SuperAdmin"}`. Django has already authenticated and authorised the user, and the website trusts this header only when the signature is valid. `role` is `SuperAdmin` or `ServiceLead`. Settings writes and knowledge publish, archive and re-index need `SuperAdmin` (403 `forbidden`).
- Responses: `200 {"data": …}`; errors `{"error":{"code","message"}}` with 400 `invalid`, 401, 403, 404 `not_found`, 409 `conflict`, 503 `disabled`. When `RELAY_ENABLED` is off, every route returns 404.

## Admin API (website): base `/api/relay/admin`

Times are ISO-8601 UTC. Ids are uuids. `displayName` = contact name, or `Visitor XXXX` (the first 4 hex characters of the id, upper case).

### Inbox and threads

| Method and path                             | Body / query                                                   | `data`                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET `/inbox`                                | `tab=needs\|live\|ai\|closed`, `q`, `cursor`                   | `{counts:{needs,live,ai,closed}, items:[ConversationRow], nextCursor, realtime:{url,key,channel}\|null}` |
| GET `/conversations/:id`                    | (marks it read)                                                | `{conversation: Conversation, messages:[Message], visitorTyping:boolean}`                                |
| GET `/conversations/:id/messages`           | `after=<message createdAt ISO>`                                | `{messages:[Message], status, assigned, visitorTyping}`                                                  |
| POST `/conversations/:id/join`              |                                                                | `{conversation}` (status → `human`, assigned to caller, Relay AI paused)                                 |
| POST `/conversations/:id/assign`            | `{admin:{id,name,initials}}`                                   | `{conversation}`                                                                                         |
| POST `/conversations/:id/handback`          |                                                                | `{conversation}` (status → `ai`)                                                                         |
| POST `/conversations/:id/close`             |                                                                | `{conversation}`                                                                                         |
| POST `/conversations/:id/reply`             | `{text (1–4000), clientMessageId (uuid), emailIfAway:boolean}` | `{message, emailed:boolean, conversation}`; joins first if not `human`                                   |
| POST `/conversations/:id/note`              | `{text}`                                                       | `{message}` (sender `note`, never shown to the visitor)                                                  |
| POST `/conversations/:id/typing`            |                                                                | `{}`                                                                                                     |
| DELETE `/conversations/:id`                 |                                                                | `{}` (hard delete; audit row with a hashed id)                                                           |
| POST `/conversations/:id/save-to-knowledge` | `{messageId}`                                                  | `{documentId}` (draft `team_answer`: visitor question + reply)                                           |
| GET `/conversations/:id/transcript`         |                                                                | `{text}` (plain-text transcript, notes excluded)                                                         |

`ConversationRow` = `{id, status, displayName, contactName|null, lastMessage:{body (≤140 chars), senderType, at}, waitingSince|null, assigned:{id,name,initials}|null, tags:string[], pagePath|null, lastMessageAt, aiTurns}`. Tags: `NOT_HELPFUL`, `NOT_IN_KNOWLEDGE`, `ASKED_FOR_A_PERSON`, `MODEL_FLAG`. Sort for `needs`: longest wait first. Otherwise most recent first.

`Conversation` = `{id, status, displayName, contact:{name,email,company,consentAt,noticeVersion}|null, session:{pageUrl,pageTitle,referrer,device,country,startedAt,messageCount}, summary|null, summaryMeta:{intent,sector,urgency}|null, assigned|null, handoff:{trigger,requestedAt}|null, firstAdminJoinedAt|null, visitorLastSeenAt|null, closedAt|null, tags}`.

`Message` = `{id, senderType:'visitor'|'ai'|'admin'|'system'|'note', body, adminName|null, adminInitials|null, citations:[{n,title,url,type}], confidence|null, feedback:-1|1|null, feedbackReason:'wrong'|'incomplete'|'didnt_understand'|null (visitor API; ADR-048), latencyMs|null, handoffSuggested, truncated, meta, createdAt}`. `meta` is `{}` except on system messages, which carry a machine `body` key (`handoff_requested`, `admin_joined`, `ai_paused`, `ai_back`, `closed`) and `meta` `{trigger?, consent?, name?, by?, outOfHours?}`. `messages?after=<createdAt>` returns messages strictly after that time, oldest first.

### Presence

| POST `/presence` | `{available:boolean}`. Also the 60 s heartbeat. | `{teamStatus:'online'\|'offline'}` |
| GET `/presence` | | `{admins:[{id,name,available,lastSeenAt}], teamStatus}` |

### Knowledge

| Method and path                                           | Body / query                                                   | `data`                                                                                                                                                                                                                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/knowledge`                                          | `source=cms\|repo\|team_answer\|faq`, `status`, `section`, `q` | `{sync, sources:{cms:{count,syncedAt}, repo:{count,syncedAt}, team_answer:{count,syncedAt}, faq:{verified,awaiting,held,syncedAt,mode:'notion'\|'snapshot'}}, items:[{id,source,title,type,status,chunks,updatedAt,url,externalId,section,readOnly,notionUrl}]}` |
| GET `/knowledge/:id`                                      |                                                                | `{document:{id,source,title,url,type,owner,reviewDate,bodyMd,status,meta,adminMeta,updatedAt,updatedBy,readOnly,chunks}}`                                                                                                                                  |
| POST `/knowledge`                                         | `{title,url?,type,owner?,reviewDate?,bodyMd}`                  | `{document}` (draft `team_answer`)                                                                                                                                                                                                                         |
| PATCH `/knowledge/:id`                                    | same fields                                                    | `{document}` (team answers only; others 409 `read_only`)                                                                                                                                                                                                   |
| POST `/knowledge/:id/publish` \| `/archive` \| `/reindex` |                                                                | `{document}`                                                                                                                                                                                                                                               |
| POST `/knowledge/reindex-all`                             |                                                                | `{documents, chunks}`                                                                                                                                                                                                                                      |
| GET `/knowledge/gaps`                                     | `days=30`                                                      | `{gaps:[{id,count,question,lastAskedAt,status}]}`                                                                                                                                                                                                          |
| POST `/knowledge/gaps/:id/ignore`                         |                                                                | `{}`                                                                                                                                                                                                                                                       |
| POST `/knowledge/gaps/:id/suggest`                        |                                                                | `{documentId, source:{title,url,type,kind}}`: a DRAFT `team_answer` (title = the gap question, body = the best-matching published chunk). Never published by this call; an already-published answer for the gap is returned unchanged (ADR-048).        |
| POST `/knowledge/test`                                    | `{question, pagePath?}`                                        | `{threshold, confident:boolean, chunks:[{documentId,title,heading,content,confidence,similarity,rrfScore,source,type}]}`                                                                                                                                   |
| GET `/knowledge/faq`                                      |                                                                | `{needsConfirmation:[{externalId,question,section,confirmNote,notionUrl}], held:[{externalId,question,reasons}], lastRun:{startedAt,finishedAt,mode,added,updated,archived,held,skippedUnverified,errors}\|null, hubActive:boolean\|null, mode}`           |
| POST `/knowledge/faq/sync`                                | `{full?:boolean}`                                              | `{run}`                                                                                                                                                                                                                                                    |

### Insights, Overview, settings, email log

| GET `/insights` | `days=7\|30\|90` | `{conversations, aiResolved, handoffs, handoffRate, helpful, notHelpful, medianFirstReplySeconds, waitingNow, topQuestions:[{question,count}], topGaps:[…], tokensIn, tokensOut, cacheHitTokens, estCostUsd, usageBySource:{chat,summary,aborted,test,untagged:{tokensIn,tokensOut,requests}}, turns:{count,tokensIn,avgTokensIn,p95TokensIn,maxTokensIn}, feedbackReasons:{wrong,incomplete,didnt_understand}}` |
| GET `/overview` | | `{awaitingConfirmation, awaitingConfirmationFaq, awaitingConfirmationRepo, gapsThisWeek, waitingNow, liveNow, sync}` (counts for the Super Admin Overview; `sync` as in GET `/knowledge`) |
| GET `/settings` | | `{settings: RelaySettings}` |
| PUT `/settings` | `{settings: RelaySettings}` (full replace; zod-validated) | `{settings}` |
| GET `/email-log` | | `{emails:[{id,to,subject,provider,status,createdAt}]}` (visitor emails only) |

**Units (17 Oct 2026, ADR-048):**

- `handoffRate` (insights and `digest.daily`) is a **fraction between 0 and 1**, rounded to three places: 4 conversations with 1 hand-off is `0.25`. The Super Admin formats it as `25%`. (Until 17 Oct the website sent a percentage, which the Super Admin multiplied by 100 again: "2500%", finding E1.)
- `tokensIn`, `tokensOut`, `cacheHitTokens`, `estCostUsd` are **all model calls on the days in the period** (`relay.usage_daily`): visitor answers, hand-off summaries, stopped answers and test traffic, including conversations deleted since. `usageBySource` splits the same totals: `chat` (visitor answers), `summary`, `aborted` (estimated), `test` (conversations started by `pnpm relay:eval --answers` and `relay:load`, tagged with `utm_source=relay-eval|relay-load`) and `untagged` (usage recorded before the source column existed).
- `turns` is measured from stored AI answers (`relay.messages.tokens_in`) in the period: the number to compare with the 8,000-token budget per answer.

`sync` (GET `/knowledge` and `/overview`) = `{cms, repo, faq: {lastSyncAt|null, ageHours|null, stale, errors}, oldestAgeHours|null, stale, staleAfterHours: 24}`: the last **finished sync run** per source (`relay.kb_sync_runs`). `sources.*.syncedAt` is kept for older Super Admins but is the last time content *changed*, not the last sync.

`RelaySettings` (defaults in `relay-core/src/schemas/settings.ts`): `{aiEnabled:true, model:'deepseek-flash', businessHours:{days:[1,2,3,4,5], start:'09:00', end:'17:30', timezone:'Europe/London'}, outOfHoursText, reminderMinutes:10, secondReminderMinutes:30, emailSnippet:true, visitorEmailsEnabled:false, greeting, suggestedQuestions:string[4], confidenceThreshold:0.4, dailyTokenCap:2000000, retention:{noContactDays:90, withContactDays:365}, allowedOrigins:string[]}`.

### Admin identity (`X-Relay-Admin`)

`name` is the staff member's display name or full name, never the email address or its local part; with neither it is `Vitalos team`. Visitors only ever see the first word of it (`publicStaffName`: "Temitope · Vitalos" in the widget, "Temitope" in the header and typing line).

## Visitor API additions (17 Oct 2026, ADR-048)

- `POST /api/relay/feedback` accepts an optional `reason: 'wrong'|'incomplete'|'didnt_understand'` with `value: -1`. Sent a second time with a reason, it only stores the reason (no second gap).
- `GET /api/relay/suggestions`, `POST /api/relay/conversations` (`settings`) and `GET /api/relay/conversations/:id/messages` carry `nextOpening: {at, label}|null`: the next start of working hours (Relay Settings, Europe/London) while the team is offline, for "Back Monday 09:00".
- Greetings, thanks, goodbyes and bare acknowledgements get a fixed reply (`meta.small_talk`), with no retrieval, model call or gap.
- The widget dispatches `window` events `vitalos:relay` with `detail: {type: 'relay_opened'|'relay_question'|'relay_handoff'}` (no content, names or ids), for the site's analytics.

## Scheduled jobs

`/api/relay/cron/{reminders,digest,faq-sync,ingest}` with `Authorization: Bearer $CRON_SECRET`, called by pg_cron through `relay.cron_call` (Vault-gated, ADR-038). `ingest` (hourly at :12, added 17 Oct 2026) re-ingests the bundled website and repo knowledge by checksum and records one `kb_sync_runs` row per source: `{cms:{added,updated,archived}, repo:{…}, errors}`.

## Webhook (website → Super Admin): POST `{RELAY_SUPERADMIN_WEBHOOK_URL}` (`/api/inbound/relay`)

Body `{id:<uuid>, type, at, counts:{needs,live}, data}`. Django answers `200 {"ok":true}` within 5 s and ignores a repeated `id`. The website retries twice (1 s, 4 s) on network errors and 5xx. Message text in events is the visitor's original words (Django is internal), at most 280 characters, and only included when `emailSnippet` is on. Otherwise it is `null`.

| `type`              | `data`                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `handoff.requested` | `{conversationId, displayName, trigger, lastVisitorMessage, pagePath, requestedAt}`                                                     |
| `visitor.replied`   | `{conversationId, displayName, assignedAdminId\|null, lastVisitorMessage, pagePath}`                                                    |
| `handoff.reminder`  | `{conversationId, displayName, trigger, minutesWaiting, nth:1\|2, lastVisitorMessage, pagePath, requestedAt}`                           |
| `relay.no_answer`   | `{conversationId, question (redacted), pagePath}`                                                                                       |
| `relay.token_cap`   | `{day, tokensUsed, cap}`                                                                                                                |
| `faq.attention`     | `{held:number, consecutiveFailures:number, runId}`                                                                                      |
| `digest.daily`      | `{waitingNow, yesterday:{conversations, handoffs, handoffRate, helpful, notHelpful, aiResolved}, openGaps, topGaps:[{question,count}]}` |
| `inbox.changed`     | `{}` (badge refresh only)                                                                                                               |

Django turns these into `RelayNotification` rows (in-app), emails (per-user prefs, 10-minute dedupe per conversation/type/recipient in `RelayAlertLog`), and the badge count. The deep link in every email is `{APP_BASE_URL}/relay/inbox/{conversationId}?ref=email`. It never carries a login token.
