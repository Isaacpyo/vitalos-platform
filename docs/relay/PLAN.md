# Vitalos Relay: build plan

Branch `feat/relay`, one commit per phase, draft PR after Phase 2. Decisions are in `DECISIONS.md` and the repo survey is in `DISCOVERY.md`.

## Shape

```
packages/design-tokens     + relay scope (brand v2 values, --relay-* CSS variables)
packages/relay-core        server-only: schemas, db (supabase-js, schema relay), retrieval,
                           llm (DeepSeek + Mock), redact, handoff, limits, realtime broadcast,
                           admin service, webhook client (to Django), visitor email, faq sync
packages/relay-widget      client: Launcher (tiny, no deps) + lazy Panel, Phoenix socket client
packages/relay-knowledge   content/*.md seed, faq/master-faq.snapshot.json, CMS mapper,
                           ingest + faq-sync CLIs, evals
apps/web                   mounts <RelayRoot/> in the root layout (behind RELAY_ENABLED);
                           /api/relay/* visitor routes, /api/relay/admin/* (HMAC from Django),
                           /api/relay/cron/* (pg_cron with CRON_SECRET)
superadmin/apps/relay      Django Relay tab: inbox, thread, knowledge, insights, settings,
                           bell, toast, alerts (in-app + email), webhook receiver
supabase/migrations        <ts>_relay.sql (+ <ts>_relay_faq.sql, <ts>_relay_cron.sql)
supabase/functions/relay-embed   gte-small embeddings
```

## Phases

| Phase | Content                                                                                                                                                                                                                                                          | Acceptance                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 0     | Discovery, decisions, ADR-035 (admin boundary), ADR-036 (LLM provider, DeepSeek), ADR-037 (retrieval), ADR-038 (realtime and scheduling)                                                                                                                         | Documents committed                                                                                                    |
| 1     | Migration, RLS, `match_chunks` (with page boost), `hit_rate_limit`, `relay-embed`, seed + CMS + FAQ snapshot, ingest CLI, CI ingest job                                                                                                                          | Ingest indexes all published entries on slot 1; "rescue a failing project" ranks Engineering Rescue first; pgTAP green |
| 2     | relay-core pipeline (redact, intent, retrieve, confidence, prompt, stream, markers, citations), visitor API with SSE, widget (launcher, panel, welcome, conversation, sources, NEXT STEP, feedback, streaming, stop, errors, all breakpoints), Storybook stories | Unit + e2e + axe green on the mock; budgets hold; screenshots match the boards at 1440/768/390. **Draft PR**           |
| 3     | Hand-off card and statuses, admin API, Django Relay tab (inbox, thread, context, join/assign/hand back/close/notes/delete), realtime both ways, typing, availability and team status, summary                                                                    | Two-context Playwright run: thumbs down → form → admin sees it → join → messages → hand back → close                   |
| 4     | Webhooks → Django alerts (toast, bell, browser notification, prefs), emails with deep links, dedupe, reminders 10/30 min and digest via pg_cron, visitor reply email behind its flag                                                                             | One email per hand-off per 10 min; reminders fire once each; deep link lands on the thread after sign-in               |
| 5     | Knowledge admin (list, editor, publish, archive, re-index, gaps, retrieval test, FAQ strip, Needs confirmation, Held, Sync now), FAQ live sync, insights, settings with audit                                                                                    | Save reply → publish → same question cites it; FAQ retrieval recall ≥95% exact / ≥85% paraphrase                       |
| 6     | Security review, privacy drafts, evals, load test, runbook, final report                                                                                                                                                                                         | Gates green; report delivered                                                                                          |
