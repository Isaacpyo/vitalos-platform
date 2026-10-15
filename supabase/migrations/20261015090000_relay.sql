-- Vitalos Relay (ADR-031 to ADR-034). Additive: a new `relay` schema; nothing existing changes.
--
-- * Every table has RLS enabled and NO policies: anon and authenticated can read or write nothing.
-- * Only service_role (the website's server code, Supabase secret key) has privileges. The schema
--   is exposed to the Data API so supabase-js can reach it with that key; without grants the
--   anon and authenticated roles still see nothing.
-- * Personal data: contact fields on conversations, message bodies. Visitor tokens are stored only
--   as HMACs; IP addresses only as salted hashes. Retention: relay.purge_expired (not scheduled
--   until the owner confirms the periods; docs/relay/PRIVACY.md).

create extension if not exists vector with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists relay;
comment on schema relay is 'Vitalos Relay: website chat assistant (ADR-031). Server-only; RLS deny-all.';

revoke all on schema relay from public, anon, authenticated;
grant usage on schema relay to service_role;

-- ---------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------
create type relay.conversation_status as enum ('ai', 'awaiting_human', 'human', 'closed');
create type relay.sender_type as enum ('visitor', 'ai', 'admin', 'system', 'note');
create type relay.handoff_trigger as enum (
  'not_helpful', 'explicit_request', 'low_confidence', 'model_flag', 'admin_initiated'
);
create type relay.kb_source as enum ('repo', 'cms', 'team_answer', 'faq');
create type relay.kb_status as enum ('draft', 'published', 'archived');

create function relay.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------------------------------
create table relay.conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_token_hash text not null check (char_length(visitor_token_hash) between 32 and 128),
  channel_key text not null unique check (char_length(channel_key) between 32 and 64),
  status relay.conversation_status not null default 'ai',
  assigned_admin_id text check (assigned_admin_id is null or char_length(assigned_admin_id) <= 64),
  assigned_admin_name text check (assigned_admin_name is null or char_length(assigned_admin_name) <= 120),
  assigned_admin_initials text check (
    assigned_admin_initials is null or char_length(assigned_admin_initials) <= 4
  ),
  contact_name text check (contact_name is null or char_length(contact_name) <= 120),
  contact_email extensions.citext check (contact_email is null or char_length(contact_email) <= 254),
  contact_company text check (contact_company is null or char_length(contact_company) <= 160),
  consent_at timestamptz,
  consent_notice_version text check (
    consent_notice_version is null or char_length(consent_notice_version) <= 40
  ),
  page_url text check (page_url is null or char_length(page_url) <= 500),
  page_title text check (page_title is null or char_length(page_title) <= 200),
  referrer text check (referrer is null or char_length(referrer) <= 500),
  utm jsonb not null default '{}'::jsonb check (
    jsonb_typeof(utm) = 'object' and octet_length(utm::text) <= 2048
  ),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  device text check (device is null or char_length(device) <= 80),
  country char(2),
  ip_hash text check (ip_hash is null or char_length(ip_hash) <= 128),
  ai_turns integer not null default 0 check (ai_turns >= 0),
  last_message_at timestamptz not null default now(),
  last_visitor_seen_at timestamptz,
  admin_last_read_at timestamptz,
  first_admin_joined_at timestamptz,
  closed_at timestamptz,
  closed_reason text check (closed_reason is null or char_length(closed_reason) <= 40),
  summary text check (summary is null or char_length(summary) <= 600),
  summary_meta jsonb,
  tags text[] not null default '{}',
  enquiry_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_consent_with_contact check (contact_email is null or consent_at is not null)
);
create index conversations_status_recent_idx on relay.conversations (status, last_message_at desc);
create index conversations_contact_email_idx on relay.conversations (contact_email);
create trigger conversations_touch before update on relay.conversations
  for each row execute function relay.touch_updated_at();
comment on column relay.conversations.visitor_token_hash is 'HMAC-SHA256 of the visitor bearer token under RELAY_TOKEN_PEPPER.';
comment on column relay.conversations.channel_key is 'Unguessable Realtime channel suffix (relay:v:{key}). Pings only, never content.';
comment on column relay.conversations.ip_hash is 'Salted hash of the client IP (RELAY_IP_SALT). The address is never stored.';

create table relay.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references relay.conversations (id) on delete cascade,
  sender_type relay.sender_type not null,
  admin_id text check (admin_id is null or char_length(admin_id) <= 64),
  admin_name text check (admin_name is null or char_length(admin_name) <= 120),
  admin_initials text check (admin_initials is null or char_length(admin_initials) <= 4),
  body text not null check (char_length(body) <= 8000),
  body_redacted text check (body_redacted is null or char_length(body_redacted) <= 8000),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  confidence real,
  handoff_suggested boolean not null default false,
  truncated boolean not null default false,
  model text check (model is null or char_length(model) <= 80),
  tokens_in integer,
  tokens_out integer,
  cache_hit_tokens integer,
  latency_ms integer,
  first_token_ms integer,
  feedback smallint check (feedback is null or feedback in (-1, 1)),
  feedback_at timestamptz,
  client_message_id uuid,
  created_at timestamptz not null default now(),
  constraint messages_client_message_unique unique (conversation_id, client_message_id)
);
create index messages_conversation_created_idx on relay.messages (conversation_id, created_at);
comment on column relay.messages.body_redacted is 'Visitor messages only: the text the model saw after personal-data redaction.';

create table relay.handoffs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references relay.conversations (id) on delete cascade,
  trigger relay.handoff_trigger not null,
  message_id uuid references relay.messages (id) on delete set null,
  requested_at timestamptz not null default now(),
  joined_by text,
  joined_at timestamptz,
  resolved_at timestamptz,
  reminder_count smallint not null default 0,
  last_reminder_at timestamptz
);
create index handoffs_open_idx on relay.handoffs (requested_at) where joined_at is null and resolved_at is null;
create index handoffs_conversation_idx on relay.handoffs (conversation_id, requested_at desc);

create table relay.resume_tokens (
  token_hash text primary key check (char_length(token_hash) between 32 and 128),
  conversation_id uuid not null references relay.conversations (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table relay.resume_tokens is 'Single-use visitor resume links (7 days), stored as HMACs.';

-- ---------------------------------------------------------------------------------------------
-- Knowledge
-- ---------------------------------------------------------------------------------------------
create table relay.kb_documents (
  id uuid primary key default gen_random_uuid(),
  source relay.kb_source not null,
  source_ref text not null unique check (char_length(source_ref) <= 300),
  external_id text check (external_id is null or char_length(external_id) <= 80),
  title text not null check (char_length(title) between 1 and 300),
  url text check (url is null or char_length(url) <= 500),
  type text not null check (
    type in ('offer', 'solution', 'practice', 'industry', 'page', 'guide', 'policy', 'faq', 'company')
  ),
  body_md text not null default '' check (char_length(body_md) <= 60000),
  checksum text not null default '',
  status relay.kb_status not null default 'draft',
  owner text check (owner is null or char_length(owner) <= 120),
  review_date date,
  updated_by text check (updated_by is null or char_length(updated_by) <= 120),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  admin_meta jsonb not null default '{}'::jsonb check (jsonb_typeof(admin_meta) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kb_documents_external_unique unique (source, external_id)
);
create index kb_documents_source_status_idx on relay.kb_documents (source, status);
create trigger kb_documents_touch before update on relay.kb_documents
  for each row execute function relay.touch_updated_at();
comment on column relay.kb_documents.meta is 'Public metadata (section, page_placements, canonical_path, linked_cta, ...). May reach visitors.';
comment on column relay.kb_documents.admin_meta is 'Admin-only metadata (source refs, confirm notes, hold reasons). Never selected by retrieval, prompts or visitor APIs.';

create table relay.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references relay.kb_documents (id) on delete cascade,
  ix integer not null check (ix >= 0),
  heading text not null default '' check (char_length(heading) <= 400),
  content text not null check (char_length(content) <= 8000),
  token_count integer not null default 0,
  fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(heading, '')), 'A')
    || setweight(to_tsvector('english', content), 'B')
  ) stored,
  embedding extensions.vector(384),
  created_at timestamptz not null default now(),
  constraint kb_chunks_document_ix_unique unique (document_id, ix)
);
create index kb_chunks_fts_idx on relay.kb_chunks using gin (fts);
create index kb_chunks_embedding_idx on relay.kb_chunks
  using hnsw (embedding extensions.vector_ip_ops);

create table relay.kb_gaps (
  id uuid primary key default gen_random_uuid(),
  question_norm text not null unique check (char_length(question_norm) <= 300),
  example_question text not null check (char_length(example_question) <= 500),
  count integer not null default 1 check (count > 0),
  last_asked_at timestamptz not null default now(),
  example_conversation_id uuid references relay.conversations (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'answered', 'ignored')),
  created_at timestamptz not null default now()
);
comment on column relay.kb_gaps.example_question is 'Redacted visitor question (what the model saw).';

create table relay.kb_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source relay.kb_source not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  mode text not null check (mode in ('incremental', 'full', 'snapshot')),
  added integer not null default 0,
  updated integer not null default 0,
  archived integer not null default 0,
  held integer not null default 0,
  skipped_unverified integer not null default 0,
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array')
);
create index kb_sync_runs_source_started_idx on relay.kb_sync_runs (source, started_at desc);

-- ---------------------------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------------------------
create table relay.admin_presence (
  admin_id text primary key check (char_length(admin_id) <= 64),
  name text not null check (char_length(name) <= 120),
  initials text not null check (char_length(initials) <= 4),
  available boolean not null default false,
  last_seen_at timestamptz not null default now()
);

create table relay.settings (
  id smallint primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into relay.settings (id) values (1);
create trigger settings_touch before update on relay.settings
  for each row execute function relay.touch_updated_at();

create table relay.usage_daily (
  day date primary key,
  requests integer not null default 0,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  cache_hit_tokens bigint not null default 0,
  est_cost_usd numeric(12, 6) not null default 0,
  cap_notified_at timestamptz
);

create table relay.rate_limits (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  count integer not null check (count > 0),
  primary key (key, window_start)
);
create index rate_limits_window_idx on relay.rate_limits (window_start);

create table relay.audit_log (
  id bigint generated always as identity primary key,
  actor_admin_id text,
  action text not null check (char_length(action) <= 80),
  target_type text check (target_type is null or char_length(target_type) <= 40),
  target_id text check (target_id is null or char_length(target_id) <= 128),
  meta jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
comment on table relay.audit_log is 'System and visitor actions. Staff actions are audited in the Super Admin. Deleted conversations appear by hashed id only.';

create table relay.email_outbox (
  id uuid primary key default gen_random_uuid(),
  "to" text not null check (char_length("to") <= 254),
  subject text not null check (char_length(subject) <= 200),
  html text not null,
  text text not null,
  provider text not null check (provider in ('log', 'resend', 'postmark', 'console')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'logged')),
  provider_message_id text,
  conversation_id uuid references relay.conversations (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table relay.email_outbox is 'Visitor emails (reply notifications): the log provider''s store and the audit of real sends.';

-- ---------------------------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------------------------

-- Fixed-window counter. True while the key is within its limit (the hit is counted either way).
create function relay.hit_rate_limit(key text, window_seconds integer, max_count integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if window_seconds <= 0 or max_count <= 0 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  insert into relay.rate_limits as r (key, window_start, count)
  values (hit_rate_limit.key, v_window, 1)
  on conflict on constraint rate_limits_pkey do update set count = r.count + 1
  returning r.count into v_count;
  -- Opportunistic cleanup of old windows (cheap with the window index).
  delete from relay.rate_limits where window_start < now() - interval '2 days';
  return v_count <= max_count;
end;
$$;

-- Hybrid search over PUBLISHED documents: full-text (ts_rank_cd) and semantic (inner product on
-- normalised gte-small vectors) fused by reciprocal rank fusion, plus a small bonus for documents
-- placed on the visitor's current page (meta.page_placements). Null embedding: full text only.
-- Never returns admin_meta.
create function relay.match_chunks(
  query_text text,
  query_embedding extensions.vector(384) default null,
  match_count integer default 6,
  rrf_k integer default 50,
  page_path text default null,
  page_bonus double precision default 0.25
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  url text,
  type text,
  source relay.kb_source,
  external_id text,
  heading text,
  content text,
  meta jsonb,
  rrf_score double precision,
  similarity double precision,
  fts_rank real
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  pub as (
    select c.id, c.document_id, c.heading, c.content, c.fts, c.embedding
    from relay.kb_chunks c
    join relay.kb_documents d on d.id = c.document_id
    where d.status = 'published'
  ),
  fts as (
    select p.id, ts_rank_cd(p.fts, q.tsq) as r,
           row_number() over (order by ts_rank_cd(p.fts, q.tsq) desc, p.id) as rk
    from pub p, q
    where p.fts @@ q.tsq
    order by r desc
    limit greatest(match_count, 1) * 4
  ),
  sem as (
    select p.id,
           -(p.embedding operator(extensions.<#>) query_embedding) as sim,
           row_number() over (
             order by p.embedding operator(extensions.<#>) query_embedding, p.id
           ) as rk
    from pub p
    where query_embedding is not null and p.embedding is not null
    order by p.embedding operator(extensions.<#>) query_embedding
    limit greatest(match_count, 1) * 4
  ),
  fused as (
    select coalesce(f.id, s.id) as id,
           coalesce(1.0 / (rrf_k + f.rk), 0) + coalesce(1.0 / (rrf_k + s.rk), 0) as score,
           s.sim,
           f.r
    from fts f
    full join sem s on s.id = f.id
  )
  select c.id, d.id, d.title, d.url, d.type, d.source, d.external_id, c.heading, c.content, d.meta,
         (fu.score + case
            when page_path is not null and (d.meta -> 'page_placements') ? page_path
              then page_bonus / (rrf_k + 1)
            else 0
          end)::double precision as rrf_score,
         fu.sim::double precision,
         fu.r::real
  from fused fu
  join relay.kb_chunks c on c.id = fu.id
  join relay.kb_documents d on d.id = c.document_id
  order by rrf_score desc, c.id
  limit match_count;
$$;

-- Atomic usage counters for the daily token cap and cost estimate.
create function relay.add_usage(
  p_day date, p_tokens_in bigint, p_tokens_out bigint, p_cache_hit bigint, p_cost numeric
)
returns relay.usage_daily
language sql
security definer
set search_path = ''
as $$
  insert into relay.usage_daily as u (day, requests, tokens_in, tokens_out, cache_hit_tokens, est_cost_usd)
  values (p_day, 1, p_tokens_in, p_tokens_out, p_cache_hit, p_cost)
  on conflict (day) do update set
    requests = u.requests + 1,
    tokens_in = u.tokens_in + excluded.tokens_in,
    tokens_out = u.tokens_out + excluded.tokens_out,
    cache_hit_tokens = u.cache_hit_tokens + excluded.cache_hit_tokens,
    est_cost_usd = u.est_cost_usd + excluded.est_cost_usd
  returning *;
$$;

-- Records a question Relay could not answer (normalised for grouping).
create function relay.record_gap(p_question_norm text, p_example text, p_conversation_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into relay.kb_gaps as g (question_norm, example_question, example_conversation_id)
  values (left(p_question_norm, 300), left(p_example, 500), p_conversation_id)
  on conflict (question_norm) do update set
    count = g.count + 1,
    last_asked_at = now(),
    example_conversation_id = excluded.example_conversation_id,
    status = case when g.status = 'answered' then 'open' else g.status end;
$$;

-- Retention (docs/relay/PRIVACY.md). Deletes conversations whose last activity is older than the
-- configured period: no contact details -> noContactDays (default 90), with contact details ->
-- withContactDays (default 365). Messages, hand-offs and resume tokens cascade. Dry run counts only.
create function relay.purge_expired(p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb;
  v_no_contact integer;
  v_with_contact integer;
  v_a integer;
  v_b integer;
begin
  select config into v_cfg from relay.settings where id = 1;
  v_no_contact := coalesce((v_cfg #>> '{retention,noContactDays}')::integer, 90);
  v_with_contact := coalesce((v_cfg #>> '{retention,withContactDays}')::integer, 365);
  if v_no_contact < 1 or v_with_contact < 1 then
    raise exception 'invalid_retention' using errcode = '22023';
  end if;

  select count(*) into v_a from relay.conversations
  where contact_email is null and last_message_at < now() - make_interval(days => v_no_contact);
  select count(*) into v_b from relay.conversations
  where contact_email is not null and last_message_at < now() - make_interval(days => v_with_contact);

  if not p_dry_run then
    delete from relay.conversations
    where contact_email is null and last_message_at < now() - make_interval(days => v_no_contact);
    delete from relay.conversations
    where contact_email is not null and last_message_at < now() - make_interval(days => v_with_contact);
    delete from relay.rate_limits where window_start < now() - interval '2 days';
    insert into relay.audit_log (action, target_type, meta)
    values ('retention.purged', 'conversation',
            jsonb_build_object('noContact', v_a, 'withContact', v_b,
                               'noContactDays', v_no_contact, 'withContactDays', v_with_contact));
  end if;

  return jsonb_build_object('dryRun', p_dry_run, 'noContact', v_a, 'withContact', v_b,
                            'noContactDays', v_no_contact, 'withContactDays', v_with_contact);
end;
$$;

-- Inbox list for the Super Admin (docs/relay/API.md). `needs`: longest wait first; other tabs:
-- most recent first. Keyset pagination on (sort timestamp, id). p_q is matched literally (the
-- caller escapes % and _).
create function relay.inbox_list(
  p_tab text,
  p_q text default null,
  p_limit integer default 50,
  p_cursor_ts timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  conversation jsonb,
  last_message jsonb,
  waiting_since timestamptz,
  handoff_trigger relay.handoff_trigger,
  sort_ts timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select c.*, h.requested_at as h_requested_at, h.trigger as h_trigger
    from relay.conversations c
    left join lateral (
      select hh.requested_at, hh.trigger
      from relay.handoffs hh
      where hh.conversation_id = c.id and hh.resolved_at is null
      order by hh.requested_at desc
      limit 1
    ) h on true
    where c.status = (case p_tab
        when 'needs' then 'awaiting_human'
        when 'live' then 'human'
        when 'ai' then 'ai'
        else 'closed' end)::relay.conversation_status
      and (
        coalesce(p_q, '') = ''
        or c.contact_name ilike '%' || p_q || '%'
        or c.contact_email::text ilike '%' || p_q || '%'
        or exists (
          select 1 from relay.messages m
          where m.conversation_id = c.id
            and m.sender_type in ('visitor', 'ai', 'admin')
            and m.body ilike '%' || p_q || '%'
        )
      )
  ),
  sorted as (
    select b.*,
           case when p_tab = 'needs' then coalesce(b.h_requested_at, b.last_message_at)
                else b.last_message_at end as s_ts
    from base b
  )
  select
    to_jsonb(s) - 'h_requested_at' - 'h_trigger' - 's_ts',
    (
      select jsonb_build_object('body', left(m.body, 140), 'sender_type', m.sender_type, 'at', m.created_at)
      from relay.messages m
      where m.conversation_id = s.id and m.sender_type in ('visitor', 'ai', 'admin')
      order by m.created_at desc
      limit 1
    ),
    s.h_requested_at,
    s.h_trigger,
    s.s_ts
  from sorted s
  where p_cursor_ts is null
     or (p_tab = 'needs' and (s.s_ts, s.id) > (p_cursor_ts, p_cursor_id))
     or (p_tab <> 'needs' and (s.s_ts, s.id) < (p_cursor_ts, p_cursor_id))
  order by
    case when p_tab = 'needs' then s.s_ts end asc,
    case when p_tab = 'needs' then s.id end asc,
    case when p_tab <> 'needs' then s.s_ts end desc,
    case when p_tab <> 'needs' then s.id end desc
  limit greatest(least(p_limit, 200), 1);
$$;

create function relay.inbox_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'needs', count(*) filter (where status = 'awaiting_human'),
    'live', count(*) filter (where status = 'human'),
    'ai', count(*) filter (where status = 'ai'),
    'closed', count(*) filter (where status = 'closed')
  )
  from relay.conversations;
$$;

-- Insights for the Super Admin (7 / 30 / 90 days).
create function relay.insights(p_since timestamptz)
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
    'estCostUsd', (select cost from usage)
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Row-level security: enabled everywhere, no policies (deny all to anon and authenticated).
-- ---------------------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'conversations', 'messages', 'handoffs', 'resume_tokens', 'kb_documents', 'kb_chunks',
    'kb_gaps', 'kb_sync_runs', 'admin_presence', 'settings', 'usage_daily', 'rate_limits',
    'audit_log', 'email_outbox'
  ] loop
    execute format('alter table relay.%I enable row level security', t);
    execute format('revoke all on table relay.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table relay.%I to service_role', t);
  end loop;
end;
$$;

grant usage, select on all sequences in schema relay to service_role;
revoke all on all functions in schema relay from public, anon, authenticated;
grant execute on all functions in schema relay to service_role;
alter default privileges in schema relay revoke all on tables from public, anon, authenticated;
alter default privileges in schema relay revoke all on functions from public, anon, authenticated;
