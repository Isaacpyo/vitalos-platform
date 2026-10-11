begin;
select plan(73);

-- Start from empty operational tables so rows left by local development or the integration suite
-- cannot be claimed by these tests. Rolled back with the rest of the transaction.
delete from public.notification_outbox;
delete from public.enquiries;
delete from public.rate_limit_buckets;

-- ---------------------------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------------------------
select has_table('public', 'rate_limit_buckets', 'rate limit table exists');
select has_column('public', 'enquiries', 'idempotency_key', 'enquiries.idempotency_key exists');
select has_column('public', 'enquiries', 'ip_hash', 'enquiries.ip_hash exists');
select has_column('public', 'enquiries', 'retention_until', 'enquiries.retention_until exists');
select has_column('public', 'notification_outbox', 'locked_until', 'outbox.locked_until exists');
select has_function('public', 'submit_enquiry', array['jsonb'], 'submit_enquiry exists');
select has_function('public', 'claim_outbox_batch', array['integer'], 'claim_outbox_batch exists');
select has_function('public', 'mark_outbox', array['uuid', 'integer', 'text', 'text', 'integer'], 'mark_outbox exists');
select has_function('public', 'find_enquiry_reference', array['uuid'], 'find_enquiry_reference exists');
select has_function('public', 'enquiry_reference', array['uuid'], 'enquiry_reference exists');
select has_function('public', 'rate_limit_consume', array['text', 'integer', 'integer'], 'rate_limit_consume exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.rate_limit_buckets'::regclass),
  'rate_limit_buckets RLS enabled'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""'])
   from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('submit_enquiry', 'claim_outbox_batch', 'mark_outbox', 'rate_limit_consume', 'find_enquiry_reference')),
  'every enquiry function is SECURITY DEFINER with an empty search_path'
);

-- ---------------------------------------------------------------------------------------------
-- Privileges: anon and authenticated have nothing; service_role may execute the functions
-- ---------------------------------------------------------------------------------------------
select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated']) as r(role_name),
         unnest(array['public.enquiries', 'public.notification_outbox', 'public.rate_limit_buckets']) as t(table_name),
         unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as pr(privilege)
    where has_table_privilege(r.role_name, t.table_name, pr.privilege)
  ),
  'anon and authenticated hold no table privileges on the enquiry tables'
);
select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated']) as r(role_name),
         unnest(array[
           'public.submit_enquiry(jsonb)',
           'public.claim_outbox_batch(integer)',
           'public.mark_outbox(uuid, integer, text, text, integer)',
           'public.rate_limit_consume(text, integer, integer)',
           'public.find_enquiry_reference(uuid)',
           'public.enquiry_reference(uuid)'
         ]) as f(signature)
    where has_function_privilege(r.role_name, f.signature, 'EXECUTE')
  ),
  'anon and authenticated cannot execute any enquiry function'
);
select ok(
  (select bool_and(has_function_privilege('service_role', signature, 'EXECUTE'))
   from unnest(array[
     'public.submit_enquiry(jsonb)',
     'public.claim_outbox_batch(integer)',
     'public.mark_outbox(uuid, integer, text, text, integer)',
     'public.rate_limit_consume(text, integer, integer)',
     'public.find_enquiry_reference(uuid)'
   ]) as f(signature)),
  'service_role can execute every enquiry function'
);

set local role anon;
select throws_ok('select * from public.enquiries', '42501', null, 'anon cannot select enquiries');
select throws_ok(
  $$insert into public.enquiries (name, email, message) values ('Anon Person', 'anon@example.invalid', 'twenty characters or more here')$$,
  '42501', null, 'anon cannot insert enquiries'
);
select throws_ok('select * from public.notification_outbox', '42501', null, 'anon cannot select the outbox');
select throws_ok(
  $$select public.submit_enquiry('{}'::jsonb)$$, '42501', null, 'anon cannot call submit_enquiry'
);
select throws_ok(
  $$select public.rate_limit_consume('k', 60, 1)$$, '42501', null, 'anon cannot call rate_limit_consume'
);
reset role;

set local role authenticated;
select throws_ok('select * from public.enquiries', '42501', null, 'authenticated cannot select enquiries');
select throws_ok(
  $$select public.claim_outbox_batch(5)$$, '42501', null, 'authenticated cannot call claim_outbox_batch'
);
select throws_ok(
  $$select public.mark_outbox(gen_random_uuid(), 1, 'sent', null, 0)$$,
  '42501', null, 'authenticated cannot call mark_outbox'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- submit_enquiry: happy path, idempotency, atomicity
-- ---------------------------------------------------------------------------------------------
create temp table t_result (name text primary key, body jsonb);
grant all on t_result to service_role;

create function pg_temp.payload(p_key uuid, p_extra jsonb default '{}'::jsonb)
returns jsonb language sql as $$
  select jsonb_build_object(
    'name', 'Example Person',
    'organisation', 'Example Organisation (fixture)',
    'workEmail', 'person@example.invalid',
    'role', 'Fixture role',
    'goal', 'Clearly artificial non-production enquiry fixture used by tests.',
    'timeframe', 'within-3-months',
    'intent', 'project',
    'offerSlug', 'example-offer',
    'sourcePath', '/contact',
    'utm', jsonb_build_object('source', 'fixture'),
    'consent', true,
    'privacyNoticeVersion', 'fixture-1',
    'correlationId', 'corr-1',
    'ipHash', repeat('a', 64),
    'idempotencyKey', p_key
  ) || p_extra
$$;
grant execute on function pg_temp.payload(uuid, jsonb) to service_role;

set local role service_role;
insert into t_result values (
  'first',
  public.submit_enquiry(pg_temp.payload('11111111-1111-4111-8111-111111111111'))
);
insert into t_result values (
  'replay',
  public.submit_enquiry(
    pg_temp.payload('11111111-1111-4111-8111-111111111111', '{"goal":"A different goal that must be ignored by a replay."}')
  )
);
reset role;

select is((select body ->> 'duplicate' from t_result where name = 'first'), 'false', 'first submission is not a duplicate');
select is((select body ->> 'duplicate' from t_result where name = 'replay'), 'true', 'replayed idempotency key is a duplicate');
select is(
  (select body ->> 'id' from t_result where name = 'replay'),
  (select body ->> 'id' from t_result where name = 'first'),
  'replay returns the original enquiry id'
);
select is(
  (select body ->> 'reference' from t_result where name = 'first'),
  'VIT-' || upper(substr(replace((select body ->> 'id' from t_result where name = 'first'), '-', ''), 1, 12)),
  'reference is derived from the enquiry id and carries 48 bits'
);
select is(
  (select count(*)::int from public.enquiries where idempotency_key = '11111111-1111-4111-8111-111111111111'),
  1, 'exactly one enquiry row exists after a replay'
);
select is(
  (select message from public.enquiries where idempotency_key = '11111111-1111-4111-8111-111111111111'),
  'Clearly artificial non-production enquiry fixture used by tests.',
  'replay does not overwrite the stored enquiry'
);
select is(
  (select count(*)::int from public.notification_outbox o
     join public.enquiries e on e.id = o.enquiry_id
    where e.idempotency_key = '11111111-1111-4111-8111-111111111111'),
  1, 'exactly one outbox row exists after a replay'
);
select results_eq(
  $$select e.ip_hash, e.consent_at is not null, e.retention_until is null, e.utm ->> 'source', e.correlation_id
      from public.enquiries e where e.idempotency_key = '11111111-1111-4111-8111-111111111111'$$,
  $$values (repeat('a', 64), true, true, 'fixture', 'corr-1')$$,
  'v2 columns are stored; retention stays unset'
);
select results_eq(
  $$select o.kind, o.event_type, o.state, o.channel
      from public.notification_outbox o join public.enquiries e on e.id = o.enquiry_id
     where e.idempotency_key = '11111111-1111-4111-8111-111111111111'$$,
  $$values ('internal-notification', 'enquiry.received.v1', 'pending', 'email')$$,
  'outbox row is a pending internal notification'
);
select is(
  (select position('person@example.invalid' in o.payload::text) + position('Example Person' in o.payload::text)
     from public.notification_outbox o join public.enquiries e on e.id = o.enquiry_id
    where e.idempotency_key = '11111111-1111-4111-8111-111111111111'),
  0, 'outbox event payload carries no personal data'
);
select is(
  (select o.payload ->> 'eventType' || '/' || (o.payload ->> 'eventVersion') || '/' || (o.payload ->> 'producer')
     from public.notification_outbox o join public.enquiries e on e.id = o.enquiry_id
    where e.idempotency_key = '11111111-1111-4111-8111-111111111111'),
  'enquiry.received.v1/1/vitalos-web', 'outbox payload is an enquiry.received.v1 envelope'
);

-- Atomicity: if the outbox insert fails, the enquiry insert is rolled back with it.
create function pg_temp.fail_outbox() returns trigger language plpgsql as $$
begin raise exception 'forced outbox failure'; end $$;
create trigger fail_outbox before insert on public.notification_outbox
  for each row execute function pg_temp.fail_outbox();

select throws_ok(
  $$select public.submit_enquiry(pg_temp.payload('22222222-2222-4222-8222-222222222222'))$$,
  'P0001', 'forced outbox failure', 'submit_enquiry fails when the outbox insert fails'
);
select is(
  (select count(*)::int from public.enquiries where idempotency_key = '22222222-2222-4222-8222-222222222222'),
  0, 'no enquiry row survives a failed outbox insert (atomic)'
);
drop trigger fail_outbox on public.notification_outbox;

-- ---------------------------------------------------------------------------------------------
-- Constraints and input rules
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  $$select public.submit_enquiry(pg_temp.payload(gen_random_uuid(), '{"consent":false}'))$$,
  '22023', 'consent_required', 'consent is required'
);
select throws_ok(
  $$select public.submit_enquiry(pg_temp.payload(gen_random_uuid(), '{"goal":"too short"}'))$$,
  '23514', null, 'goal shorter than 20 characters is rejected'
);
select throws_ok(
  $$select public.submit_enquiry(pg_temp.payload(gen_random_uuid(), '{"intent":"spam"}'))$$,
  '23514', null, 'unknown intent is rejected'
);
select throws_ok(
  $$select public.submit_enquiry(pg_temp.payload(gen_random_uuid(), jsonb_build_object('utm', jsonb_build_object('x', repeat('x', 3000)))))$$,
  '23514', null, 'oversized utm is rejected'
);
select throws_ok(
  $$select public.submit_enquiry(pg_temp.payload(gen_random_uuid(), '{"offerSlug":"Not A Slug"}'))$$,
  '23514', null, 'malformed offer slug is rejected'
);
select throws_ok(
  $$select public.submit_enquiry(pg_temp.payload(gen_random_uuid(), '{"idempotencyKey":"not-a-uuid"}'))$$,
  '22P02', null, 'non-uuid idempotency key is rejected'
);
select throws_ok(
  $$insert into public.enquiries (name, email, message) values ('Direct Insert', 'direct@example.invalid', 'twenty characters or more here')$$,
  '23514', null, 'a direct insert without consent, intent and idempotency key violates the v2 rule'
);
select throws_ok(
  $$insert into public.notification_outbox (enquiry_id, channel, kind)
    select id, 'email', 'internal-notification' from public.enquiries limit 1$$,
  '23505', null, 'at most one outbox row per enquiry and kind'
);

-- ---------------------------------------------------------------------------------------------
-- Outbox claim / mark
-- ---------------------------------------------------------------------------------------------
create temp table t_claim (name text primary key, body jsonb);
grant all on t_claim to service_role;

set local role service_role;
insert into t_claim values ('c1', public.claim_outbox_batch(10));
insert into t_claim values ('c2', public.claim_outbox_batch(10));
reset role;

select is((select jsonb_array_length(body) from t_claim where name = 'c1'), 1, 'first claim returns the pending row');
select is((select jsonb_array_length(body) from t_claim where name = 'c2'), 0, 'a claimed row is not claimed twice');
select is(
  (select body -> 0 ->> 'attempts' from t_claim where name = 'c1'),
  '1', 'claiming increments attempts'
);
select is(
  (select body -> 0 -> 'enquiry' ->> 'workEmail' from t_claim where name = 'c1'),
  'person@example.invalid', 'claimed work item includes the enquiry for notification'
);

set local role service_role;
select is(
  public.mark_outbox((select (body -> 0 ->> 'id')::uuid from t_claim where name = 'c1'), 1, 'pending', 'provider-down', 3600),
  true, 'a processing row can be scheduled for retry'
);
reset role;
select results_eq(
  $$select state, last_error, available_at > now() + interval '55 minutes' from public.notification_outbox
     where id = (select (body -> 0 ->> 'id')::uuid from t_claim where name = 'c1')$$,
  $$values ('pending', 'provider-down', true)$$,
  'retry is scheduled in the future with the error code kept'
);

set local role service_role;
select is(public.claim_outbox_batch(10), '[]'::jsonb, 'a row waiting for its retry time is not claimed');
reset role;

update public.notification_outbox set available_at = now() - interval '1 second'
 where id = (select (body -> 0 ->> 'id')::uuid from t_claim where name = 'c1');

set local role service_role;
insert into t_claim values ('c3', public.claim_outbox_batch(10));
reset role;
select is((select body -> 0 ->> 'attempts' from t_claim where name = 'c3'), '2', 'a due retry is claimed with attempts incremented');

-- An expired lease (crashed worker) is reclaimable.
update public.notification_outbox set locked_until = now() - interval '1 second'
 where id = (select (body -> 0 ->> 'id')::uuid from t_claim where name = 'c3');
set local role service_role;
insert into t_claim values ('c4', public.claim_outbox_batch(10));
select is(
  public.mark_outbox((select (body -> 0 ->> 'id')::uuid from t_claim where name = 'c4'), 3, 'sent', null, 0),
  true, 'a processing row can be marked sent'
);
select is(
  public.mark_outbox((select (body -> 0 ->> 'id')::uuid from t_claim where name = 'c4'), 3, 'sent', null, 0),
  false, 'a row that is no longer processing cannot be marked again'
);
select throws_ok(
  $$select public.mark_outbox(gen_random_uuid(), 1, 'processing', null, 0)$$,
  '22023', 'invalid_state', 'mark_outbox rejects unknown target states'
);
reset role;
select results_eq(
  $$select state, sent_at is not null from public.notification_outbox
     where id = (select (body -> 0 ->> 'id')::uuid from t_claim where name = 'c4')$$,
  $$values ('sent', true)$$,
  'a sent row records sent_at'
);

-- ---------------------------------------------------------------------------------------------
-- Lease token: a stale worker cannot overwrite a row another worker re-claimed
-- ---------------------------------------------------------------------------------------------
create temp table t_lease (name text primary key, body jsonb);
grant all on t_lease to service_role;

set local role service_role;
insert into t_lease values ('submit', public.submit_enquiry(pg_temp.payload('33333333-3333-4333-8333-333333333333')));
insert into t_lease values ('claim-1', public.claim_outbox_batch(10));
reset role;

-- Worker A holds attempts = 1. Its lease expires and worker B claims the same row (attempts = 2).
update public.notification_outbox set locked_until = now() - interval '1 second'
 where id = (select (body -> 0 ->> 'id')::uuid from t_lease where name = 'claim-1');

set local role service_role;
insert into t_lease values ('claim-2', public.claim_outbox_batch(10));
select is((select body -> 0 ->> 'attempts' from t_lease where name = 'claim-2'), '2', 'worker B re-claims the expired row with attempts = 2');
select is(
  public.mark_outbox((select (body -> 0 ->> 'id')::uuid from t_lease where name = 'claim-1'), 1, 'sent', null, 0),
  false, 'stale worker A (attempts = 1) cannot mark the row sent'
);
select is(
  public.mark_outbox((select (body -> 0 ->> 'id')::uuid from t_lease where name = 'claim-1'), 1, 'failed', 'stale', 0),
  false, 'stale worker A cannot dead-letter the row either'
);
reset role;
select results_eq(
  $$select state, attempts from public.notification_outbox
     where id = (select (body -> 0 ->> 'id')::uuid from t_lease where name = 'claim-1')$$,
  $$values ('processing', 2)$$,
  'the row is untouched by the stale worker'
);
set local role service_role;
select is(
  public.mark_outbox((select (body -> 0 ->> 'id')::uuid from t_lease where name = 'claim-2'), 2, 'sent', null, 0),
  true, 'the current lease holder (attempts = 2) can mark the row sent'
);
reset role;

-- Legacy rows left processing with a null lease are reclaimable.
insert into public.notification_outbox (enquiry_id, channel, kind, state, attempts, locked_until)
select e.id, 'email', 'acknowledgement', 'processing', 1, null
  from public.enquiries e where e.idempotency_key = '33333333-3333-4333-8333-333333333333';
set local role service_role;
insert into t_lease values ('claim-null', public.claim_outbox_batch(10));
reset role;
select results_eq(
  $$select jsonb_array_length(body), body -> 0 ->> 'kind', body -> 0 ->> 'attempts' from t_lease where name = 'claim-null'$$,
  $$values (1, 'acknowledgement', '2')$$,
  'a processing row with a null lease is reclaimed'
);

-- ---------------------------------------------------------------------------------------------
-- find_enquiry_reference
-- ---------------------------------------------------------------------------------------------
set local role service_role;
select is(
  (public.find_enquiry_reference('11111111-1111-4111-8111-111111111111') ->> 'reference'),
  (select body ->> 'reference' from t_result where name = 'first'),
  'find_enquiry_reference returns the stored reference for a known key'
);
select is(
  public.find_enquiry_reference('99999999-9999-4999-8999-999999999999'),
  null::jsonb, 'find_enquiry_reference returns null for an unknown key'
);
reset role;
select matches(
  (select body ->> 'reference' from t_result where name = 'first'),
  '^VIT-[0-9A-F]{12}$', 'references are VIT- plus 12 hex characters'
);

-- ---------------------------------------------------------------------------------------------
-- rate_limit_consume
-- ---------------------------------------------------------------------------------------------
create temp table t_rate (n serial primary key, body jsonb);
grant all on t_rate to service_role;
grant usage on sequence t_rate_n_seq to service_role;

set local role service_role;
insert into t_rate (body) values (public.rate_limit_consume('test:key-a', 3600, 2));
insert into t_rate (body) values (public.rate_limit_consume('test:key-a', 3600, 2));
insert into t_rate (body) values (public.rate_limit_consume('test:key-a', 3600, 2));
insert into t_rate (body) values (public.rate_limit_consume('test:key-b', 3600, 2));
select throws_ok($$select public.rate_limit_consume('', 60, 1)$$, '22023', 'invalid_key', 'empty key is rejected');
select throws_ok($$select public.rate_limit_consume('k', 0, 1)$$, '22023', 'invalid_window', 'zero window is rejected');
select throws_ok($$select public.rate_limit_consume('k', 60, 0)$$, '22023', 'invalid_max', 'zero max is rejected');
reset role;

select is((select body ->> 'allowed' from t_rate where n = 1), 'true', 'first hit is allowed');
select is((select body ->> 'allowed' from t_rate where n = 2), 'true', 'hit at the limit is allowed');
select results_eq(
  $$select body ->> 'allowed', (body ->> 'retryAfterSeconds')::int between 1 and 3600 from t_rate where n = 3$$,
  $$values ('false', true)$$,
  'hit over the limit is denied with a retry-after inside the window'
);
select is((select body ->> 'allowed' from t_rate where n = 4), 'true', 'limits are per key');

select * from finish();
rollback;
