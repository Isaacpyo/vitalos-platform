-- Relay scheduled jobs (ADR-034): pg_cron calls the website's cron routes through pg_net.
--
-- The base URL and the bearer secret are read from Supabase Vault at run time
-- (`relay_cron_base_url`, `relay_cron_secret`). Until both exist the jobs do nothing, so local
-- stacks, CI and a production project with Relay switched off make no requests. No secret is
-- stored in this file or in the job definitions.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create function relay.cron_call(p_path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_secret text;
begin
  if p_path !~ '^/api/relay/cron/[a-z-]+(\?[a-z=&-]+)?$' then
    raise exception 'invalid_cron_path' using errcode = '22023';
  end if;
  select decrypted_secret into v_base from vault.decrypted_secrets where name = 'relay_cron_base_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'relay_cron_secret';
  if v_base is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_base, '/') || p_path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function relay.cron_call(text) from public, anon, authenticated;
grant execute on function relay.cron_call(text) to service_role;

select cron.schedule('relay-reminders', '*/5 * * * *', $$select relay.cron_call('/api/relay/cron/reminders')$$);
select cron.schedule('relay-digest', '45 * * * *', $$select relay.cron_call('/api/relay/cron/digest')$$);
select cron.schedule('relay-faq-sync', '7,22,37,52 * * * *', $$select relay.cron_call('/api/relay/cron/faq-sync')$$);
select cron.schedule('relay-faq-sync-full', '20 2 * * *', $$select relay.cron_call('/api/relay/cron/faq-sync?mode=full')$$);
-- Retention is deliberately not scheduled: the owner confirms the periods first
-- (docs/relay/PRIVACY.md). Prepared: select cron.schedule('relay-retention', '40 3 * * *',
-- $$select relay.purge_expired(false)$$);
