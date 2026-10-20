begin;
select plan(35);

-- Schema, RLS deny-all, privileges
select has_schema('relay', 'relay schema exists');
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'relay' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'every relay table has RLS enabled');
select is(
  (select count(*)::int from pg_policies where schemaname = 'relay'),
  0, 'no RLS policies: anon and authenticated are denied everything');
select ok(not has_schema_privilege('anon', 'relay', 'usage'), 'anon cannot use the relay schema');
select ok(not has_schema_privilege('authenticated', 'relay', 'usage'), 'authenticated cannot use the relay schema');
select ok(not has_table_privilege('anon', 'relay.conversations', 'select'), 'anon cannot read conversations');
select ok(not has_table_privilege('authenticated', 'relay.messages', 'select'), 'authenticated cannot read messages');
select ok(has_table_privilege('service_role', 'relay.conversations', 'insert'), 'service_role can write conversations');
select ok(not has_function_privilege('anon', 'relay.match_chunks(text, extensions.vector, integer, integer, text, double precision)', 'execute'),
  'anon cannot call match_chunks');
select ok(not has_function_privilege('anon', 'relay.purge_expired(boolean)', 'execute'), 'anon cannot call purge_expired');

-- Rate limiter
select ok(relay.hit_rate_limit('t:a', 600, 2), 'first hit allowed');
select ok(relay.hit_rate_limit('t:a', 600, 2), 'second hit allowed');
select ok(not relay.hit_rate_limit('t:a', 600, 2), 'third hit over the limit');
select ok(relay.hit_rate_limit('t:b', 600, 2), 'other keys are independent');

-- Knowledge and hybrid search
insert into relay.kb_documents (id, source, source_ref, title, type, status, meta, admin_meta) values
  ('00000000-0000-0000-0000-000000000001', 'repo', 'test/rescue', 'Engineering Rescue', 'offer', 'published',
   '{"page_placements":["/offers/engineering-rescue"]}', '{"confirm_note":"internal only"}'),
  ('00000000-0000-0000-0000-000000000002', 'repo', 'test/draft', 'Rescue draft', 'offer', 'draft', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000003', 'repo', 'test/modernise', 'Application Modernisation', 'offer', 'published',
   '{"page_placements":["/offers/application-modernisation"]}', '{}');
insert into relay.kb_chunks (document_id, ix, heading, content) values
  ('00000000-0000-0000-0000-000000000001', 0, 'Engineering Rescue', 'We stabilise and rescue failing software projects.'),
  ('00000000-0000-0000-0000-000000000002', 0, 'Rescue draft', 'Rescue failing projects draft text.'),
  ('00000000-0000-0000-0000-000000000003', 0, 'Application Modernisation', 'We modernise legacy software projects in stages.');

select is((select title from relay.match_chunks('rescue a failing project') limit 1), 'Engineering Rescue',
  'full-text match ranks the rescue offer first');
select is((select count(*)::int from relay.match_chunks('rescue a failing project') where title = 'Rescue draft'), 0,
  'draft documents are never returned');
select ok((select fts_rank from relay.match_chunks('rescue failing') limit 1) > 0, 'fts rank reported');
select is((select similarity from relay.match_chunks('rescue failing') limit 1), null::double precision,
  'no embedding: similarity is null (full text only)');
select is(
  (select title from relay.match_chunks('software projects', null, 6, 50, '/offers/application-modernisation') limit 1),
  'Application Modernisation', 'page placement bonus lifts the document placed on the current page');
select ok(
  not exists (select 1 from information_schema.routines r
    join information_schema.parameters p on p.specific_name = r.specific_name
    where r.routine_schema = 'relay' and r.routine_name = 'match_chunks' and p.parameter_name = 'admin_meta'),
  'match_chunks has no admin_meta output');

-- Semantic path: unit vectors, inner product
update relay.kb_chunks set embedding = ('[' || array_to_string(array_fill(0::real, array[383]) || array[1::real], ',') || ']')::extensions.vector
  where document_id = '00000000-0000-0000-0000-000000000003';
update relay.kb_chunks set embedding = ('[' || array_to_string(array[1::real] || array_fill(0::real, array[383]), ',') || ']')::extensions.vector
  where document_id = '00000000-0000-0000-0000-000000000001';
select is(
  (select title from relay.match_chunks('zzzz unmatched', ('[' || array_to_string(array_fill(0::real, array[383]) || array[1::real], ',') || ']')::extensions.vector) limit 1),
  'Application Modernisation', 'semantic match by inner product');
select is(
  (select round(similarity::numeric, 3) from relay.match_chunks('zzzz unmatched', ('[' || array_to_string(array_fill(0::real, array[383]) || array[1::real], ',') || ']')::extensions.vector) limit 1),
  1.000, 'similarity of identical unit vectors is 1');

-- Retention
insert into relay.conversations (id, visitor_token_hash, channel_key, last_message_at)
values ('00000000-0000-0000-0000-0000000000a1', repeat('a', 64), repeat('k', 43), now() - interval '100 days');
insert into relay.conversations (id, visitor_token_hash, channel_key, last_message_at, contact_email, consent_at)
values ('00000000-0000-0000-0000-0000000000a2', repeat('b', 64), repeat('m', 43), now() - interval '100 days',
        'someone@example.invalid', now() - interval '100 days');
select is((relay.purge_expired(true) ->> 'noContact')::int, 1, 'dry run counts the expired anonymous conversation');
select is((select count(*)::int from relay.conversations where id::text like '00000000-0000-0000-0000-0000000000a%'), 2,
  'dry run deletes nothing');
select lives_ok($$select relay.purge_expired(false)$$, 'purge runs');
select is((select count(*)::int from relay.conversations where id::text like '00000000-0000-0000-0000-0000000000a%'), 1,
  'purge keeps conversations with contact details inside their period');

-- Deleting a conversation forgets its gap examples (security review M4)
insert into relay.conversations (id, visitor_token_hash, channel_key)
values ('00000000-0000-0000-0000-0000000000b1', repeat('c', 64), repeat('n', 43)),
       ('00000000-0000-0000-0000-0000000000b2', repeat('d', 64), repeat('p', 43));
insert into relay.kb_gaps (question_norm, example_question, count, example_conversation_id)
values ('only asked once', 'Only asked once by this visitor', 1, '00000000-0000-0000-0000-0000000000b1'),
       ('asked by several', 'Asked by several, example from b2', 3, '00000000-0000-0000-0000-0000000000b2');
delete from relay.conversations where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from relay.kb_gaps where question_norm = 'only asked once'), 0,
  'a gap asked only in the deleted conversation is removed');
select is((select example_question from relay.kb_gaps where question_norm = 'asked by several'), 'asked by several',
  'a shared gap keeps only its normalised question');
select is((select example_conversation_id from relay.kb_gaps where question_norm = 'asked by several'), null::uuid,
  'a shared gap no longer points at the deleted conversation');

select is((select schedule from cron.job where jobname = 'relay-retention'), '40 3 * * *',
  'retention runs daily at 03:40 UTC');

-- Case ID: a reference shown once a person is involved (ADR-050)
select has_column('relay', 'conversations', 'case_id', 'conversations have a case_id');
insert into relay.conversations (id, visitor_token_hash, channel_key, status, contact_name, case_id)
values ('00000000-0000-0000-0000-0000000000c1', repeat('e', 64), repeat('q', 43), 'awaiting_human', 'Case Tester', '179249323700172'),
       ('00000000-0000-0000-0000-0000000000c2', repeat('f', 64), repeat('r', 43), 'awaiting_human', 'Someone Else', null);
select throws_ok(
  $$update relay.conversations set case_id = '1234' where id = '00000000-0000-0000-0000-0000000000c2'$$,
  '23514', null, 'a case ID must be 15 digits');
select throws_ok(
  $$update relay.conversations set case_id = '179249323700172' where id = '00000000-0000-0000-0000-0000000000c2'$$,
  '23505', null, 'a case ID is unique');
select is((select count(*)::int from relay.inbox_list('needs', '9249323700')), 1,
  'the inbox finds a conversation by part of its case ID');
select is((select count(*)::int from relay.inbox_list('needs', '999999999999999')), 0,
  'the inbox returns nothing for an unknown case ID');

select * from finish();
rollback;
