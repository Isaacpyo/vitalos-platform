# Retention policy: client portal delivery records

Status: proposed defaults, implemented 30 Oct 2026 (W13). The job runs as a **dry run** until a person sets `RETENTION_ENFORCE=true`, the switch every Super Admin retention job uses. Decision record: [ADR-056, "Delivery status and retention"](../../adr/ADR-056-client-portal.md#delivery-status-and-retention-30-oct-2026).

## What the records are

Each portal email and push notification has a delivery record. They exist so staff can see what was sent, what failed and why, and retry it (Client portal › Notification deliveries).

- `EmailDelivery`: the recipient's address, the subject, status, attempts, an error category and times. There is no email body.
- `PushDelivery`: the device, status, attempts, an error category and times. There is no payload and no push-service response.
- `PushSubscription`: a member's device. It holds the browser's push address and keys, which are capability secrets.

None of them is decision evidence. The decisions themselves are kept for the life of the engagement (ADR-056 section 10): notifications, approvals, audit events and every other portal record.

## Policy

| Record                                     | Deleted                                                                      | Setting (default)                             |
| ------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------------- |
| Sent email or push delivery                | 90 days after it was sent (after it was queued if no send time was recorded) | `PORTAL_DELIVERY_SENT_RETENTION_DAYS` (90)    |
| Failed-for-good or cancelled email or push | 180 days after it was queued                                                 | `PORTAL_DELIVERY_FAILED_RETENTION_DAYS` (180) |
| Turned-off push device                     | 90 days after it was turned off, once none of its delivery records is kept   | `PORTAL_PUSH_DISABLED_RETENTION_DAYS` (90)    |

- **Never deleted, whatever their age:**
  - queued deliveries;
  - retrying deliveries (the last attempt failed and an automatic attempt remains);
  - active devices;
  - notifications, audit events and every other record.
- **Why devices wait for their records.** Deleting a device deletes its delivery records with it. So a turned-off device stays until its own records have aged out under the rows above. A device with a failed delivery is kept for up to 180 days, and one with a queued delivery is kept until that delivery is handled.
- **Floor.** A setting below 7 days counts as 7, so the delivery page's seven-day summary always has its records. A value that is not a number falls back to the default.
- **Why these periods.** 90 days of sent records covers any question about whether a customer was told. Failures are kept twice as long because they are what staff investigate. A turned-off device's address and keys are useless after it is turned off, so they go as soon as nothing refers to them.

## How it runs

- **Schedule:** once a day, in the content tick's daily step (`content_sync.tick.run_daily`, step `portal_deliveries`), beside recruitment retention. The step's result (the number of rows deleted, or that would be deleted) is stored in the tick's `last_result`. A failure is logged and retried on the next tick, and never skips the other daily steps.
- **By hand:** `python manage.py portal_delivery_retention` prints, per category, what would be deleted and the cutoff date. With `RETENTION_ENFORCE=true` it then deletes.
- **Dry run (the default):** nothing is deleted. The job logs `Portal delivery retention dry run` with the counts per category (`email_sent`, `email_failed`, `push_sent`, `push_failed`, `devices`).
- **Enforced:** the job deletes only the rows above, in one transaction, re-checking each device at the moment of deletion. It logs `Portal delivery retention` with the counts and writes one audit event, `portal.delivery_retention`, with the counts. It never writes the deleted contents.
- **Code:** `superadmin/apps/portal/retention.py`. The tests are in `superadmin/tests/test_portal_deliveries.py`: the dry run, enforcement, every boundary, the never-delete cases, the floor and the tick.

## Before turning it on

1. After deploy, run `python manage.py portal_delivery_retention` in the release job (or read the tick's `last_result`), and record the counts.
2. The portal went live on 29 Oct 2026, so no production delivery or device can be old enough to fall under the policy until late January 2027. The first dry runs should report **0 in every category**. Anything else means the clock or the data is wrong: stop and investigate.
3. `RETENTION_ENFORCE` also governs the enquiry and recruitment retention. Turning it on applies all three policies, so read all three dry runs first (`enforce_enquiry_retention` prints its own).
