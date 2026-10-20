-- Relay case ID (ADR-050). Additive: one nullable column, one index, and inbox_list also matches it.
--
-- A case ID is the reference a visitor quotes when a person from the team takes over: 15 digits,
-- the Unix time in seconds of the hand-off followed by five random digits. It is created once per
-- conversation, at the first hand-off or when a person first joins, and never changes. It is a
-- reference only: it grants no access to the conversation (visitors authenticate with their bearer
-- token, staff through the Super Admin) and it is deleted with the conversation (relay.purge_expired).

alter table relay.conversations
  add column case_id text
    constraint conversations_case_id_format check (case_id is null or case_id ~ '^[0-9]{15}$');

create unique index conversations_case_id_key on relay.conversations (case_id) where case_id is not null;
comment on column relay.conversations.case_id is
  'Reference shown to the visitor and staff once a person is involved: Unix seconds plus five digits. Not a credential.';

-- Hand-offs that already exist get a case ID built from the time of their first request. The suffix
-- is a counter within that second, so every value is unique.
update relay.conversations c
set case_id = b.case_id
from (
  select h.conversation_id,
         floor(extract(epoch from min(h.requested_at)))::bigint::text
         || lpad(
              (row_number() over (
                 partition by floor(extract(epoch from min(h.requested_at)))
                 order by h.conversation_id
               ))::text,
              5, '0'
            ) as case_id
  from relay.handoffs h
  group by h.conversation_id
) b
where c.id = b.conversation_id and c.case_id is null;

-- Inbox search also matches the case ID (staff paste it from an email or a call).
create or replace function relay.inbox_list(
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
        or c.case_id like '%' || p_q || '%'
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
