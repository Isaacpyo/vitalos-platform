-- Relay review fixes (20261017090000_relay_review.sql, ADR-048).
begin;
select plan(19);

-- D6: thumbs-down reason column
select has_column('relay', 'messages', 'feedback_reason', 'messages.feedback_reason exists');
insert into relay.conversations (id, visitor_token_hash, channel_key)
values ('00000000-0000-0000-0000-0000000000c1', repeat('e', 64), repeat('q', 43));
insert into relay.messages (id, conversation_id, sender_type, body, tokens_in, feedback, feedback_reason) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'ai', 'Answer one', 4000, -1, 'incomplete'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'ai', 'Answer two', 6000, null, null);
select throws_ok(
  $$insert into relay.messages (conversation_id, sender_type, body, feedback, feedback_reason)
    values ('00000000-0000-0000-0000-0000000000c1', 'ai', 'x', -1, 'rude')$$,
  '23514', null, 'an unknown feedback reason is rejected');

-- D1 / D6: insights report per-turn tokens and reasons
select is(((relay.insights(now() - interval '1 day')) -> 'turns' ->> 'count')::int, 2,
  'insights count measured AI turns');
select is(((relay.insights(now() - interval '1 day')) -> 'turns' ->> 'avgTokensIn')::int, 5000,
  'insights average input tokens per turn');
select is(((relay.insights(now() - interval '1 day')) -> 'turns' ->> 'maxTokensIn')::int, 6000,
  'insights maximum input tokens per turn');
select is(((relay.insights(now() - interval '1 day')) -> 'feedbackReasons' ->> 'incomplete')::int, 1,
  'insights count thumbs-down reasons');
select is(((relay.insights(now() - interval '1 day')) -> 'feedbackReasons' ->> 'wrong')::int, 0,
  'reasons not chosen count zero');
select ok((relay.insights(now() - interval '1 day')) ? 'handoffs', 'existing insights keys are kept');

-- D2: vocabulary of published knowledge only
insert into relay.kb_documents (id, source, source_ref, title, type, status) values
  ('00000000-0000-0000-0000-0000000000e1', 'repo', 'test/solutions', 'Our solutions', 'page', 'published'),
  ('00000000-0000-0000-0000-0000000000e2', 'repo', 'test/hidden', 'Hidden draft', 'page', 'draft');
insert into relay.kb_chunks (document_id, ix, heading, content) values
  ('00000000-0000-0000-0000-0000000000e1', 0, 'Solutions', 'Six solutions: Application Modernisation and more solutions.'),
  ('00000000-0000-0000-0000-0000000000e2', 0, 'Hidden', 'Zebracorn secret wording.');
select ok((relay.kb_vocabulary() ->> 'solutions')::int >= 3, 'vocabulary counts published words');
select ok(not (relay.kb_vocabulary() ? 'zebracorn'), 'vocabulary leaves out draft documents');
select ok(not (relay.kb_vocabulary() ? 'an'), 'vocabulary skips words shorter than three letters');
select ok(not has_function_privilege('anon', 'relay.kb_vocabulary()', 'execute'), 'anon cannot call kb_vocabulary');
select ok(not has_function_privilege('authenticated', 'relay.insights(timestamptz)', 'execute'),
  'authenticated cannot call insights');

-- D1: usage tagged by source; the daily cap counter still sees every call
select lives_ok($$select relay.add_usage_tagged(current_date, 1000, 100, 0, 0.001, 'chat')$$, 'tagged usage is recorded');
select lives_ok($$select relay.add_usage_tagged(current_date, 9000, 200, 0, 0.002, 'test')$$, 'test traffic is recorded');
select is((select tokens_in from relay.usage_daily where day = current_date) >= 10000, true,
  'usage_daily (daily cap) counts every tagged call');
select is(((relay.insights(now() - interval '1 day')) -> 'usageBySource' -> 'test' ->> 'tokensIn')::int, 9000,
  'insights show test traffic separately');
select throws_ok($$select relay.add_usage_tagged(current_date, 1, 1, 0, 0, 'other')$$, '23514', null,
  'an unknown usage source is rejected');

-- D4: hourly ingest schedule
select is((select schedule from cron.job where jobname = 'relay-ingest'), '12 * * * *',
  'website and repo knowledge re-ingest runs hourly');

select * from finish();
rollback;
