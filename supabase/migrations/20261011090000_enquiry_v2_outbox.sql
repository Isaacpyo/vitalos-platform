-- Enquiry pipeline v2 (ADR-019). Additive: the original tables and constraints are untouched.
--
-- * enquiries gains the v2 fields (role, timeframe, intent, source context, consent record, ...).
-- * notification_outbox gains event/kind/lock columns and a per-(enquiry, kind) uniqueness rule.
-- * All access goes through SECURITY DEFINER functions granted to service_role only.
--   anon and authenticated have no table privileges and cannot execute any function.
-- * No retention period is set: retention_until stays null until the owner approves a policy.

-- ---------------------------------------------------------------------------------------------
-- enquiries
-- ---------------------------------------------------------------------------------------------
alter table public.enquiries
  add column role text check (role is null or char_length(role) <= 120),
  add column timeframe text check (timeframe is null or char_length(timeframe) <= 40),
  add column budget_range text check (budget_range is null or char_length(budget_range) <= 40),
  add column intent text check (
    intent is null or intent in (
      'project', 'offer', 'engineering', 'ai', 'managed-services',
      'procurement', 'partnership', 'careers', 'general'
    )
  ),
  add column offer_slug text check (
    offer_slug is null or (char_length(offer_slug) <= 120 and offer_slug ~ '^[a-z0-9][a-z0-9-]*$')
  ),
  add column source_path text check (source_path is null or char_length(source_path) <= 300),
  add column utm jsonb not null default '{}'::jsonb check (
    jsonb_typeof(utm) = 'object' and octet_length(utm::text) <= 2048
  ),
  add column consent_at timestamptz,
  add column privacy_notice_version text check (
    privacy_notice_version is null or char_length(privacy_notice_version) <= 40
  ),
  add column correlation_id text check (correlation_id is null or char_length(correlation_id) <= 64),
  add column ip_hash text check (ip_hash is null or char_length(ip_hash) <= 128),
  add column idempotency_key uuid,
  add column retention_until timestamptz;

alter table public.enquiries
  add constraint enquiries_idempotency_key_key unique (idempotency_key);

-- NOT VALID: enforced for every new row without rewriting or rejecting pre-v2 rows.
alter table public.enquiries
  add constraint enquiries_v2_required check (
    consent_at is not null
    and privacy_notice_version is not null
    and intent is not null
    and idempotency_key is not null
  ) not valid;

comment on column public.enquiries.ip_hash is 'HMAC of the client IP under a server-side salt. The raw address is never stored.';
comment on column public.enquiries.retention_until is 'Null until the owner approves a retention policy (stage-1 plan section 6).';

-- ---------------------------------------------------------------------------------------------
-- notification_outbox
-- ---------------------------------------------------------------------------------------------
alter table public.notification_outbox
  add column event_type text not null default 'enquiry.received.v1'
    check (event_type in ('enquiry.received.v1')),
  add column kind text not null default 'internal-notification'
    check (kind in ('internal-notification', 'acknowledgement')),
  add column locked_until timestamptz,
  add column payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 4096),
  add column correlation_id text check (correlation_id is null or char_length(correlation_id) <= 64);

alter table public.notification_outbox
  add constraint notification_outbox_enquiry_kind_key unique (enquiry_id, kind);

create index notification_outbox_claim_idx
  on public.notification_outbox (available_at)
  where state in ('pending', 'processing');

comment on column public.notification_outbox.payload is 'Event envelope (enquiry.received.v1). Carries identifiers only, never personal data.';
comment on column public.notification_outbox.state is 'pending (incl. scheduled retry) | processing | sent | failed (terminal: attempts exhausted or permanent error).';

-- ---------------------------------------------------------------------------------------------
-- rate_limit_buckets (fixed-window counters; keys are salted hashes, never raw identifiers)
-- ---------------------------------------------------------------------------------------------
create table public.rate_limit_buckets (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  hits integer not null check (hits > 0),
  primary key (key, window_start)
);
alter table public.rate_limit_buckets enable row level security;
revoke all on table public.rate_limit_buckets from anon, authenticated;
create index rate_limit_buckets_window_idx on public.rate_limit_buckets (window_start);
comment on table public.rate_limit_buckets is 'Server-side abuse counters. Keys are salted hashes.';

-- ---------------------------------------------------------------------------------------------
-- submit_enquiry(p jsonb) -> {id, reference, duplicate}
-- Enquiry row and outbox row are written in one transaction (a function body is atomic).
-- A replayed idempotency key returns the original enquiry and writes nothing.
-- ---------------------------------------------------------------------------------------------
create function public.submit_enquiry(p jsonb)
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
      'id', v_id,
      'reference', 'VIT-' || upper(substr(v_id::text, 1, 8)),
      'duplicate', true
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
    -- A concurrent request inserted the same key between the lookup and the insert.
    select e.id into v_id from public.enquiries e where e.idempotency_key = v_key;
    return jsonb_build_object(
      'id', v_id,
      'reference', 'VIT-' || upper(substr(v_id::text, 1, 8)),
      'duplicate', true
    );
  end if;

  -- Only the internal notification is queued. Customer acknowledgements are not enqueued until
  -- the owner approves them (stage-1 plan section 6); the 'acknowledgement' kind is reserved.
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
        'reference', 'VIT-' || upper(substr(v_id::text, 1, 8)),
        'intent', p ->> 'intent',
        'offerSlug', nullif(p ->> 'offerSlug', ''),
        'sourcePath', nullif(p ->> 'sourcePath', '')
      )
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'reference', 'VIT-' || upper(substr(v_id::text, 1, 8)),
    'duplicate', false
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- claim_outbox_batch(p_limit) -> jsonb array of work items
-- Takes due pending rows and rows whose lock expired (a crashed worker), using
-- FOR UPDATE SKIP LOCKED so concurrent dispatchers never claim the same row. Claiming
-- increments attempts and takes a lease.
-- ---------------------------------------------------------------------------------------------
create function public.claim_outbox_batch(p_limit integer default 10)
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
       or (o.state = 'processing' and o.locked_until < now())
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
          'reference', 'VIT-' || upper(substr(e.id::text, 1, 8)),
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
-- mark_outbox(id, state, error, retry_in_seconds) -> boolean
-- Only a row currently being processed can be marked. 'pending' schedules a retry.
-- ---------------------------------------------------------------------------------------------
create function public.mark_outbox(
  p_id uuid,
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
  where o.id = p_id and o.state = 'processing';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- rate_limit_consume(key, window, max) -> {allowed, retryAfterSeconds}
-- Fixed window counter. Every call counts, including denied ones.
-- ---------------------------------------------------------------------------------------------
create function public.rate_limit_consume(
  p_key text,
  p_window_seconds integer,
  p_max integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
  v_retry integer;
begin
  if p_key is null or char_length(p_key) = 0 or char_length(p_key) > 200 then
    raise exception 'invalid_key' using errcode = '22023';
  end if;
  if p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid_window' using errcode = '22023';
  end if;
  if p_max is null or p_max not between 1 and 100000 then
    raise exception 'invalid_max' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_buckets as b (key, window_start, hits)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start) do update set hits = b.hits + 1
  returning b.hits into v_hits;

  -- Opportunistic cleanup of long-expired windows keeps the table small without a scheduler.
  if random() < 0.02 then
    delete from public.rate_limit_buckets where window_start < now() - interval '1 day';
  end if;

  if v_hits <= p_max then
    return jsonb_build_object('allowed', true, 'retryAfterSeconds', 0);
  end if;

  v_retry := greatest(
    1,
    ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - now())))::integer
  );
  return jsonb_build_object('allowed', false, 'retryAfterSeconds', v_retry);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Privileges: callable by the server-side service role only.
-- ---------------------------------------------------------------------------------------------
revoke all on function public.submit_enquiry(jsonb) from public, anon, authenticated;
revoke all on function public.claim_outbox_batch(integer) from public, anon, authenticated;
revoke all on function public.mark_outbox(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.rate_limit_consume(text, integer, integer) from public, anon, authenticated;

grant execute on function public.submit_enquiry(jsonb) to service_role;
grant execute on function public.claim_outbox_batch(integer) to service_role;
grant execute on function public.mark_outbox(uuid, text, text, integer) to service_role;
grant execute on function public.rate_limit_consume(text, integer, integer) to service_role;
