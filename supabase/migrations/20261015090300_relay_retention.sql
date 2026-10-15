-- Vitalos Relay: schedule the retention job the owner approved on 15 Oct 2026 (DECISIONS.md 28,
-- privacy notice 2026-10-relay). relay.purge_expired deletes conversations 90 days after the
-- last message when no contact details were left, and 12 months after when they were (periods
-- from relay.settings, defaults 90 / 365 days), plus rate-limit rows older than two days. It
-- deletes nothing else. Dry run before applying: select relay.purge_expired(true);
-- Daily at 03:40 UTC, after the enquiry purge at 03:30.

select cron.schedule('relay-retention', '40 3 * * *', $$select relay.purge_expired(false)$$);
