begin;
select plan(9);

-- Health & Care enquiries (Website Build Pack, 25 Oct 2026; migration 20261025090000).
delete from public.notification_outbox;
delete from public.enquiries;

create function pg_temp.payload(p_key text, p_intent text, p_extra jsonb default '{}'::jsonb)
returns jsonb language sql as $$
  select jsonb_build_object(
    'name', 'Fixture Person',
    'workEmail', 'person@example.invalid',
    'goal', 'Clearly artificial fixture enquiry used by database tests.',
    'intent', p_intent,
    'consent', true,
    'privacyNoticeVersion', 'fixture-1',
    'idempotencyKey', p_key
  ) || p_extra
$$;

select has_column('public', 'enquiries', 'details', 'enquiries.details exists');

select lives_ok(
  $$select public.submit_enquiry(pg_temp.payload(
    '55555555-5555-4555-8555-555555555555', 'healthcare-audit',
    '{"details":{"tags":["healthcare"],"healthcare":{"organisationType":"nhs-trust","sites":2,"needs":["letters"]}}}'
  ))$$,
  'a healthcare-audit enquiry with details is stored'
);
select lives_ok(
  $$select public.submit_enquiry(pg_temp.payload('66666666-6666-4666-8666-666666666666', 'healthcare-partner'))$$,
  'a healthcare-partner enquiry without details is stored'
);
select throws_ok(
  $$select public.submit_enquiry(pg_temp.payload('77777777-7777-4777-8777-777777777777', 'not-an-intent'))$$,
  '23514', null, 'an unknown intent is still refused'
);
select throws_ok(
  $$select public.submit_enquiry(pg_temp.payload(
    '88888888-8888-4888-8888-888888888888', 'general', '{"details":[1]}'
  ))$$,
  '22023', null, 'details must be an object'
);

select is(
  (select details -> 'healthcare' ->> 'organisationType' from public.enquiries
   where idempotency_key = '55555555-5555-4555-8555-555555555555'),
  'nhs-trust',
  'details are stored as sent'
);
select is(
  (select details from public.enquiries where idempotency_key = '66666666-6666-4666-8666-666666666666'),
  '{}'::jsonb,
  'details default to an empty object'
);
select is(
  (select o.payload -> 'payload' -> 'tags' from public.notification_outbox o
   join public.enquiries e on e.id = o.enquiry_id
   where e.idempotency_key = '55555555-5555-4555-8555-555555555555'),
  '["healthcare"]'::jsonb,
  'the outbox event carries the tags'
);
select ok(
  (select bool_or(item -> 'enquiry' -> 'details' -> 'tags' = '["healthcare"]'::jsonb)
   from jsonb_array_elements(public.claim_outbox_batch(10)) as item),
  'claim_outbox_batch returns the details'
);

select * from finish();
rollback;
