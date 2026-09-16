begin;
select plan(4);
select has_table('public','enquiries','enquiries exists');
select has_table('public','notification_outbox','outbox exists');
select ok((select relrowsecurity from pg_class where oid='public.enquiries'::regclass),'enquiries RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.notification_outbox'::regclass),'outbox RLS enabled');
select * from finish();
rollback;
