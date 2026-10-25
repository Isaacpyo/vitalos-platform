-- Health & Care enquiries (Website Build Pack, 25 Oct 2026). Additive.
--
-- * Two new intents: healthcare-audit and healthcare-partner.
-- * enquiries.details (jsonb object, at most 2048 bytes): the server-derived tags (["healthcare"]
--   for the healthcare intents) and the optional healthcare answers (organisation type, number of
--   sites, needs, systems in use). The application validates its shape (`@vitalos/validation`);
--   the database bounds its type and size. No patient information is asked for, and the form says
--   so above the message field.
-- * submit_enquiry stores details and adds the tags to the outbox event; claim_outbox_batch returns
--   details, so the internal notification shows the tag and the answers.
--
-- Apply before deploying the code that sends the new intents: until then the old intent check
-- would refuse them (AGENTS.md: additive migrations before the code that depends on them).

-- ---------------------------------------------------------------------------------------------
-- enquiries
-- ---------------------------------------------------------------------------------------------
alter table public.enquiries drop constraint enquiries_intent_check;
alter table public.enquiries
  add constraint enquiries_intent_check check (
    intent is null or intent in (
      'project', 'offer', 'engineering', 'ai', 'managed-services',
      'procurement', 'partnership', 'careers', 'general',
      'healthcare-audit', 'healthcare-partner'
    )
  );

alter table public.enquiries
  add column details jsonb not null default '{}'::jsonb check (
    jsonb_typeof(details) = 'object' and octet_length(details::text) <= 2048
  );

comment on column public.enquiries.details is
  'Server-derived tags and structured answers for some intents (Health & Care). Never patient information.';

-- ---------------------------------------------------------------------------------------------
-- submit_enquiry: as 20261011100000, plus details and the event's tags
-- ---------------------------------------------------------------------------------------------
create or replace function public.submit_enquiry(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key uuid;
  v_id uuid;
  v_correlation text;
  v_details jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if (p ->> 'consent') is distinct from 'true' then
    raise exception 'consent_required' using errcode = '22023';
  end if;

  v_key := (p ->> 'idempotencyKey')::uuid;
  if v_key is null then
    raise exception 'idempotency_key_required' using errcode = '22023';
  end if;
  v_correlation := nullif(p ->> 'correlationId', '');
  v_details := coalesce(p -> 'details', '{}'::jsonb);
  if jsonb_typeof(v_details) <> 'object' then
    raise exception 'invalid_details' using errcode = '22023';
  end if;

  select e.id into v_id from public.enquiries e where e.idempotency_key = v_key;
  if found then
    return jsonb_build_object(
      'id', v_id, 'reference', public.enquiry_reference(v_id), 'duplicate', true
    );
  end if;

  insert into public.enquiries (
    name, email, organisation, message, role, timeframe, budget_range, intent, offer_slug,
    source_path, utm, consent_at, privacy_notice_version, correlation_id, ip_hash, idempotency_key,
    details
  ) values (
    p ->> 'name',
    p ->> 'workEmail',
    nullif(p ->> 'organisation', ''),
    p ->> 'goal',
    nullif(p ->> 'role', ''),
    nullif(p ->> 'timeframe', ''),
    nullif(p ->> 'budgetRange', ''),
    p ->> 'intent',
    nullif(p ->> 'offerSlug', ''),
    nullif(p ->> 'sourcePath', ''),
    coalesce(p -> 'utm', '{}'::jsonb),
    now(),
    p ->> 'privacyNoticeVersion',
    v_correlation,
    nullif(p ->> 'ipHash', ''),
    v_key,
    v_details
  )
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    select e.id into v_id from public.enquiries e where e.idempotency_key = v_key;
    return jsonb_build_object(
      'id', v_id, 'reference', public.enquiry_reference(v_id), 'duplicate', true
    );
  end if;

  insert into public.notification_outbox (
    enquiry_id, channel, kind, event_type, correlation_id, payload
  ) values (
    v_id,
    'email',
    'internal-notification',
    'enquiry.received.v1',
    v_correlation,
    jsonb_build_object(
      'eventId', gen_random_uuid(),
      'eventType', 'enquiry.received.v1',
      'eventVersion', 1,
      'occurredAt', now(),
      'producer', 'vitalos-web',
      'correlationId', v_correlation,
      'payload', jsonb_build_object(
        'enquiryId', v_id,
        'reference', public.enquiry_reference(v_id),
        'intent', p ->> 'intent',
        'offerSlug', nullif(p ->> 'offerSlug', ''),
        'sourcePath', nullif(p ->> 'sourcePath', ''),
        'tags', coalesce(v_details -> 'tags', '[]'::jsonb)
      )
    )
  );

  return jsonb_build_object(
    'id', v_id, 'reference', public.enquiry_reference(v_id), 'duplicate', false
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- claim_outbox_batch: as 20261011100000, plus the enquiry's details
-- ---------------------------------------------------------------------------------------------
create or replace function public.claim_outbox_batch(p_limit integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  with picked as (
    select o.id
    from public.notification_outbox o
    where (o.state = 'pending' and o.available_at <= now())
       or (o.state = 'processing' and coalesce(o.locked_until, 'epoch'::timestamptz) < now())
    order by o.available_at
    limit greatest(1, least(coalesce(p_limit, 10), 50))
    for update skip locked
  ),
  claimed as (
    update public.notification_outbox o
    set state = 'processing',
        attempts = o.attempts + 1,
        locked_until = now() + interval '5 minutes'
    from picked
    where o.id = picked.id
    returning o.*
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'kind', c.kind,
        'eventType', c.event_type,
        'attempts', c.attempts,
        'correlationId', c.correlation_id,
        'event', c.payload,
        'enquiry', jsonb_build_object(
          'id', e.id,
          'reference', public.enquiry_reference(e.id),
          'name', e.name,
          'organisation', e.organisation,
          'workEmail', e.email,
          'role', e.role,
          'goal', e.message,
          'timeframe', e.timeframe,
          'budgetRange', e.budget_range,
          'intent', e.intent,
          'offerSlug', e.offer_slug,
          'sourcePath', e.source_path,
          'utm', e.utm,
          'receivedAt', e.received_at,
          'details', e.details
        )
      )
      order by c.available_at
    ),
    '[]'::jsonb
  )
  into v_result
  from claimed c
  join public.enquiries e on e.id = c.enquiry_id;

  return v_result;
end;
$$;

-- `create or replace` keeps the existing grants: service_role only (20261011090000).
