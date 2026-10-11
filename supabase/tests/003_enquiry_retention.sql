begin;
select plan(16);

delete from public.notification_outbox;
delete from public.enquiries;

-- ---------------------------------------------------------------------------------------------
-- Structure and grants
-- ---------------------------------------------------------------------------------------------
select has_function('public', 'purge_expired_enquiries', array[]::text[], 'purge_expired_enquiries exists');
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.purge_expired_enquiries()'::regprocedure),
  'purge_expired_enquiries is SECURITY DEFINER with an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.purge_expired_enquiries()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.purge_expired_enquiries()', 'EXECUTE')
  and has_function_privilege('service_role', 'public.purge_expired_enquiries()', 'EXECUTE'),
  'only service_role can execute purge_expired_enquiries'
);
select ok(
  not has_function_privilege('anon', 'public.set_enquiry_retention()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.set_enquiry_retention()', 'EXECUTE'),
  'the retention trigger function is not callable by anon or authenticated'
);

-- ---------------------------------------------------------------------------------------------
-- Default: received_at + 24 months on insert; an explicit value is respected
-- ---------------------------------------------------------------------------------------------
create function pg_temp.new_enquiry(p_received timestamptz, p_retention timestamptz default null)
returns uuid language sql as $$
  insert into public.enquiries (
    name, email, message, intent, consent_at, privacy_notice_version, idempotency_key,
    received_at, retention_until
  ) values (
    'Example Person', 'person@example.invalid', 'Clearly artificial non-production enquiry fixture.',
    'general', now(), 'fixture-1', gen_random_uuid(), p_received, p_retention
  ) returning id
$$;

create temp table t_ids (label text primary key, id uuid);
insert into t_ids values
  ('default', pg_temp.new_enquiry(timestamptz '2026-01-15 10:00:00+00')),
  ('explicit', pg_temp.new_enquiry(timestamptz '2026-01-15 10:00:00+00', timestamptz '2030-01-01 00:00:00+00')),
  ('expired', pg_temp.new_enquiry(now() - interval '25 months')),
  ('fresh', pg_temp.new_enquiry(now() - interval '1 month')),
  ('expired_nooutbox', pg_temp.new_enquiry(now() - interval '30 months'));

select is(
  (select retention_until from public.enquiries where id = (select id from t_ids where label = 'default')),
  timestamptz '2028-01-15 10:00:00+00',
  'retention_until defaults to received_at + 24 months'
);
select is(
  (select retention_until from public.enquiries where id = (select id from t_ids where label = 'explicit')),
  timestamptz '2030-01-01 00:00:00+00',
  'an explicit retention_until (manual extension) is respected'
);
select is(
  (select count(*) from public.enquiries where retention_until is null),
  0::bigint,
  'no enquiry is left without a retention date'
);

-- ---------------------------------------------------------------------------------------------
-- Backfill: the migration statement fills null rows (simulated by clearing and re-running it)
-- ---------------------------------------------------------------------------------------------
alter table public.enquiries disable trigger enquiries_set_retention;
update public.enquiries set retention_until = null
where id = (select id from t_ids where label = 'fresh');
update public.enquiries set retention_until = received_at + interval '24 months'
where retention_until is null;
alter table public.enquiries enable trigger enquiries_set_retention;
select is(
  (select retention_until = received_at + interval '24 months' from public.enquiries
   where id = (select id from t_ids where label = 'fresh')),
  true,
  'backfill gives null rows received_at + 24 months'
);

-- ---------------------------------------------------------------------------------------------
-- Purge
-- ---------------------------------------------------------------------------------------------
insert into public.notification_outbox (enquiry_id, channel, kind)
select id, 'email', 'internal-notification' from t_ids where label in ('expired', 'fresh', 'default');
insert into public.notification_outbox (enquiry_id, channel, kind)
select id, 'email', 'acknowledgement' from t_ids where label = 'expired';

create temp table t_purge (n integer);
grant all on t_purge to service_role;

set local role anon;
select throws_ok($$select public.purge_expired_enquiries()$$, '42501', null, 'anon cannot purge');
reset role;
set local role authenticated;
select throws_ok($$select public.purge_expired_enquiries()$$, '42501', null, 'authenticated cannot purge');
reset role;

set local role service_role;
insert into t_purge select public.purge_expired_enquiries();
reset role;

select is((select n from t_purge), 2, 'purge returns the number of enquiries deleted');
select is(
  (select count(*) from public.enquiries where id in (select id from t_ids where label in ('expired', 'expired_nooutbox'))),
  0::bigint,
  'expired enquiries are deleted'
);
select is(
  (select count(*) from public.enquiries where id in (select id from t_ids where label in ('default', 'explicit', 'fresh'))),
  3::bigint,
  'unexpired enquiries are kept'
);
select is(
  (select count(*) from public.notification_outbox o where not exists (select 1 from public.enquiries e where e.id = o.enquiry_id)),
  0::bigint,
  'no outbox row is left pointing at a deleted enquiry'
);
select is(
  (select count(*) from public.notification_outbox where enquiry_id in (select id from t_ids where label in ('fresh', 'default'))),
  2::bigint,
  'outbox rows of kept enquiries survive'
);

set local role service_role;
delete from t_purge;
insert into t_purge select public.purge_expired_enquiries();
reset role;
select is((select n from t_purge), 0, 'a second purge deletes nothing');

select * from finish();
rollback;
