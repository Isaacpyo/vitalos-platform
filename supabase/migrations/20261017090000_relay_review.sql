-- Relay review fixes, 17 October 2026 (ADR-048). Additive only: one nullable column, one new
-- function, one replaced read-only function (same signature, more keys) and one new schedule.
-- Nothing is dropped, renamed or narrowed.

-- D6: why a visitor marked an answer "Not helpful" (one tap after thumbs-down).
alter table relay.messages
  add column if not exists feedback_reason text
  check (feedback_reason is null or feedback_reason in ('wrong', 'incomplete', 'didnt_understand'));
comment on column relay.messages.feedback_reason is
  'Thumbs-down reason chosen by the visitor (wrong, incomplete, didnt_understand). AI answers only.';

-- D2: vocabulary of published knowledge for typo tolerance (retrieval/spelling.ts). One jsonb
-- object {word: count}, so the Data API row limit does not truncate it. Words of 3+ letters.
create or replace function relay.kb_vocabulary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(w.word, w.n), '{}'::jsonb)
  from (
    select t.word, count(*) as n
    from relay.kb_chunks c
    join relay.kb_documents d on d.id = c.document_id
    cross join lateral regexp_split_to_table(
      lower(d.title || ' ' || coalesce(c.heading, '') || ' ' || c.content), '[^a-z]+'
    ) as t(word)
    where d.status = 'published' and char_length(t.word) >= 3
    group by t.word
  ) w;
$$;

revoke all on function relay.kb_vocabulary() from public, anon, authenticated;
grant execute on function relay.kb_vocabulary() to service_role;

-- D1 / D6: Insights gain per-turn input tokens (from stored AI answers, so evals and deleted
-- conversations no longer distort the per-conversation picture) and thumbs-down reasons.
-- E1: the hand-off rate is computed in relay-core as a fraction (docs/relay/API.md).
create or replace function relay.insights(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with conv as (
    select c.id from relay.conversations c where c.created_at >= p_since
  ),
  handed as (
    select distinct h.conversation_id from relay.handoffs h where h.requested_at >= p_since
  ),
  unhelpful as (
    select distinct m.conversation_id from relay.messages m
    where m.created_at >= p_since and m.sender_type = 'ai' and m.feedback = -1
  ),
  first_reply as (
    select extract(epoch from (
      (select min(m.created_at) from relay.messages m
        where m.conversation_id = h.conversation_id and m.sender_type = 'admin' and m.created_at >= h.requested_at)
      - h.requested_at)) as secs
    from relay.handoffs h
    where h.requested_at >= p_since
  ),
  firsts as (
    select distinct on (m.conversation_id) lower(left(coalesce(m.body_redacted, m.body), 120)) as q
    from relay.messages m
    join conv on conv.id = m.conversation_id
    where m.sender_type = 'visitor'
    order by m.conversation_id, m.created_at
  ),
  usage as (
    select coalesce(sum(tokens_in), 0) as ti, coalesce(sum(tokens_out), 0) as tout,
           coalesce(sum(cache_hit_tokens), 0) as ch, coalesce(sum(est_cost_usd), 0) as cost
    from relay.usage_daily where day >= p_since::date
  ),
  turns as (
    select count(*) as n, coalesce(sum(m.tokens_in), 0) as ti,
           coalesce(round(avg(m.tokens_in)), 0) as avg_ti, coalesce(max(m.tokens_in), 0) as max_ti
    from relay.messages m
    where m.created_at >= p_since and m.sender_type = 'ai' and m.tokens_in is not null
  ),
  reasons as (
    select
      count(*) filter (where m.feedback_reason = 'wrong') as wrong,
      count(*) filter (where m.feedback_reason = 'incomplete') as incomplete,
      count(*) filter (where m.feedback_reason = 'didnt_understand') as didnt_understand
    from relay.messages m
    where m.created_at >= p_since and m.sender_type = 'ai' and m.feedback = -1
  )
  select jsonb_build_object(
    'conversations', (select count(*) from conv),
    'handoffs', (select count(*) from handed),
    'aiResolved', (select count(*) from conv
                    where conv.id not in (select conversation_id from handed)
                      and conv.id not in (select conversation_id from unhelpful)),
    'helpful', (select count(*) from relay.messages m
                where m.created_at >= p_since and m.sender_type = 'ai' and m.feedback = 1),
    'notHelpful', (select count(*) from relay.messages m
                   where m.created_at >= p_since and m.sender_type = 'ai' and m.feedback = -1),
    'medianFirstReplySeconds', (select percentile_cont(0.5) within group (order by secs)
                                from first_reply where secs is not null),
    'waitingNow', (select count(*) from relay.conversations where status = 'awaiting_human'),
    'topQuestions', coalesce((select jsonb_agg(t) from (
        select q as question, count(*) as count from firsts group by q order by count(*) desc, q limit 10
      ) t), '[]'::jsonb),
    'tokensIn', (select ti from usage),
    'tokensOut', (select tout from usage),
    'cacheHitTokens', (select ch from usage),
    'estCostUsd', (select cost from usage),
    'turns', (select jsonb_build_object(
        'count', n, 'tokensIn', ti, 'avgTokensIn', avg_ti, 'maxTokensIn', max_ti) from turns),
    'feedbackReasons', (select jsonb_build_object(
        'wrong', wrong, 'incomplete', incomplete, 'didnt_understand', didnt_understand) from reasons)
  );
$$;

revoke all on function relay.insights(timestamptz) from public, anon, authenticated;
grant execute on function relay.insights(timestamptz) to service_role;

-- D4: hourly re-ingest of the bundled website and repo knowledge through the website's cron
-- route (same Vault-gated relay.cron_call as the other Relay jobs: no request until both Vault
-- secrets exist). Idempotent by checksum; records one kb_sync_runs row per source.
select cron.schedule('relay-ingest', '12 * * * *', $$select relay.cron_call('/api/relay/cron/ingest')$$);
