-- Enquiry pipeline v2 hardening (ADR-019, review of PR 23). Additive to 20261011090000.
--
-- * Lease token: mark_outbox must present the `attempts` value returned by the claim, so a stale
--   worker can never overwrite a row another worker has since re-claimed.
-- * Rows left `processing` with a null lease (legacy or interrupted writes) are reclaimable.
-- * References carry 48 bits (12 hex characters) instead of 32.
-- * find_enquiry_reference lets the application answer an idempotent replay before it spends a
--   Turnstile verification or a global rate-limit token.
--
-- Note on enquiries_v2_required (NOT VALID check from the previous migration): PostgreSQL also
-- evaluates a NOT VALID check when an existing row is updated. That is acceptable here because no
-- pre-v2 enquiry rows exist: the production project is unapproved (ADR 006) and the table has only
-- ever been written through submit_enquiry. If pre-v2 rows ever exist, drop and re-add the
-- constraint conditional on a v2 marker before updating them.

-- ---------------------------------------------------------------------------------------------
-- Reference helper (internal: only called from the SECURITY DEFINER functions below)
-- ---------------------------------------------------------------------------------------------
create function public.enquiry_reference(p_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'VIT-' || upper(substr(replace(p_id::text, '-', ''), 1, 12))
$$;
revoke all on function public.enquiry_reference(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- submit_enquiry: same behaviour, 12-character reference
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

  select e.id into v_id from public.enquiries e where e.idempotency_key = v_key;
  if found then
    return jsonb_build_object(
      'id', v_id, 'reference', public.enquiry_reference(v_id), 'duplicate', true
    );
  end if;

  insert into public.enquiries (
    name, email, organisation, message, role, timeframe, budget_range, intent, offer_slug,
    source_path, utm, consent_at, privacy_notice_version, correlation_id, ip_hash, idempotency_key
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
    v_key
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
        'sourcePath', nullif(p ->> 'sourcePath', '')
      )
    )
  );

  return jsonb_build_object(
    'id', v_id, 'reference', public.enquiry_reference(v_id), 'duplicate', false
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- find_enquiry_reference(p_key) -> {id, reference, duplicate: true} or null
-- ---------------------------------------------------------------------------------------------
create function public.find_enquiry_reference(p_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select e.id into v_id from public.enquiries e where e.idempotency_key = p_key;
  if v_id is null then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_id, 'reference', public.enquiry_reference(v_id), 'duplicate', true
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- claim_outbox_batch: null leases are reclaimable; 12-character reference
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
          'receivedAt', e.received_at
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

-- ---------------------------------------------------------------------------------------------
-- mark_outbox(id, attempts, state, error, retry_in_seconds) -> boolean
-- `p_attempts` is the lease token returned by claim_outbox_batch. A row re-claimed by another
-- worker has a higher attempts value, so a stale worker's mark matches nothing and returns false.
-- ---------------------------------------------------------------------------------------------
drop function public.mark_outbox(uuid, text, text, integer);

create function public.mark_outbox(
  p_id uuid,
  p_attempts integer,
  p_state text,
  p_error text default null,
  p_retry_in_seconds integer default 0
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_state not in ('sent', 'failed', 'pending') then
    raise exception 'invalid_state' using errcode = '22023';
  end if;

  update public.notification_outbox o
  set state = p_state,
      last_error = case when p_state = 'sent' then null else left(p_error, 200) end,
      sent_at = case when p_state = 'sent' then now() else o.sent_at end,
      locked_until = null,
      available_at = case
        when p_state = 'pending'
          then now() + make_interval(secs => greatest(0, coalesce(p_retry_in_seconds, 0)))
        else o.available_at
      end
  where o.id = p_id and o.state = 'processing' and o.attempts = p_attempts;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.find_enquiry_reference(uuid) from public, anon, authenticated;
revoke all on function public.mark_outbox(uuid, integer, text, text, integer) from public, anon, authenticated;
grant execute on function public.find_enquiry_reference(uuid) to service_role;
grant execute on function public.mark_outbox(uuid, integer, text, text, integer) to service_role;
