-- Enquiry retention (ADR-019). Owner decision, 11 Oct 2026: enquiries are kept 24 months after
-- the last contact, then deleted. The published privacy notice says exactly that.
--
-- There is no "last contact" field, so retention is measured from received_at. If a conversation
-- is still active when the date approaches, extending it is a manual, deliberate update of
-- enquiries.retention_until (for example `update public.enquiries set retention_until = now() +
-- interval '24 months' where id = ...`). Nothing extends it automatically.
--
-- * A BEFORE INSERT trigger sets retention_until = received_at + 24 months when it is not given,
--   so submit_enquiry needs no change and no insert path can leave the column null.
-- * Existing rows with a null retention_until are backfilled the same way.
-- * purge_expired_enquiries() deletes expired enquiries and their outbox rows (the outbox foreign
--   key is ON DELETE RESTRICT, so outbox rows go first) in one statement and returns the number of
--   enquiries deleted. It returns a count only. service_role only; anon and authenticated cannot
--   execute it.
-- * rate_limit_buckets hold salted hashes with a one-day lifetime and need no change.

create function public.set_enquiry_retention()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.retention_until is null then
    new.retention_until := new.received_at + interval '24 months';
  end if;
  return new;
end;
$$;
revoke all on function public.set_enquiry_retention() from public, anon, authenticated;

create trigger enquiries_set_retention
  before insert on public.enquiries
  for each row execute function public.set_enquiry_retention();

update public.enquiries
set retention_until = received_at + interval '24 months'
where retention_until is null;

comment on column public.enquiries.retention_until is
  'Deletion date: received_at + 24 months by default (owner decision 2026-10-11), set by trigger. Extend manually for an active conversation. purge_expired_enquiries() deletes rows past this date.';

create index enquiries_retention_until_idx on public.enquiries (retention_until);

create function public.purge_expired_enquiries()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
  v_ids uuid[];
begin
  -- Separate statements, outbox first: the outbox foreign key is ON DELETE RESTRICT and is
  -- checked per row, so child rows must be gone before their parents are deleted.
  select coalesce(array_agg(e.id), '{}'::uuid[])
  into v_ids
  from public.enquiries e
  where e.retention_until < now();

  delete from public.notification_outbox o where o.enquiry_id = any (v_ids);

  delete from public.enquiries e where e.id = any (v_ids);
  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_enquiries() from public, anon, authenticated;
grant execute on function public.purge_expired_enquiries() to service_role;
