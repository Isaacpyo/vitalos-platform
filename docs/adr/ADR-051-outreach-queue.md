# ADR 051 Outreach queue and the outreach mailbox

- **Status:** Accepted (engineering), 27 Oct 2026. Sending stays off until the owner approves and sets up an outreach mailbox.
- **Owner request:** "build a feature that sends mail to bulk email addresses I have in my Notion page", "email can be exported from the Notion page … and loaded on the admin", "don't send the mail, just create the feature, merge and deploy".

## Context

The leads live in the Notion database Vitalos Leads (2,285 rows on 27 Oct 2026, 1,649 with an email address). The owner wants to send them an outreach template from the Super Admin and have it land in the recipient's inbox.

Every Vitalos email goes through one Resend account: support@ replies, sign-in links, alerts, Relay and the website's notifications. It is capped at 100 a day on the free tier (`RESEND_DAILY_LIMIT`). Resend's acceptable use policy (resend.com/legal/acceptable-use, read 27 Oct 2026) says: "You are prohibited from sending unsolicited messages of any kind, including cold outreach, purchased lists, or scraped contact data." Sending outreach through it would risk a suspension that stops every other email.

## Decision

1. **Outreach has its own transport.** Outreach-kind email goes only through an outreach mailbox over SMTP with TLS (`OUTREACH_SMTP_*`; `apps.mailer.backends.outreach_connection`), From and Reply-To that mailbox. It never falls back to Resend. Without a mailbox, outreach sends are refused on a live server (`EMAIL_TRANSPORT=resend`). With `EMAIL_TRANSPORT=log` they are written to the log.
2. **Leads come from a Notion export, not a live link.** Mail › Outreach accepts the CSV from Notion's Export › Markdown & CSV, or the same file saved as .xlsx (`openpyxl`, with `defusedxml`). There is no Notion token, sync job or write-back yet. A "Sent list (CSV)" export, keyed by Lead ID, lets Notion be updated.
3. **The queue is held in PostgreSQL** (`apps.outreach`: `Contact`, `OutreachSettings`). Each address is held once and never emailed twice. Unsubscribed addresses (`EmailSuppression`) are skipped at import and again at send time.
4. **Import filters, all on by default except the last:**
   - Limited companies, LLPs and PLCs only, because the ICO treats sole traders and partnerships as individuals for marketing email;
   - Status "New" only;
   - optionally, "No website" ticked only.
5. **Paced sending from the content tick (ADR-042).** The tick sends at most one email per run, and only:
   - while a person has pressed Start (the queue starts paused);
   - on weekdays from 09:00 to 17:00, London time;
   - up to the daily limit (15 by default, 50 at most);
   - with a random gap of 3 to 8 minutes between emails.

   `next_due` feeds `nextDueAt`, so the per-minute Worker wakes the admin only when an email is due. Each email is claimed (status Sending) before it goes, so a crash cannot send it twice. Three failures in a row pause the queue.

6. **Audit:** imports, settings changes, start, pause, removals and exports are recorded, and so is each send. The audit summary holds a lead reference, never the recipient's address.

## Consequences

- Nothing can be sent until the owner approves a mailbox (it costs money) and its DNS records (a DNS change). Until then, Start is disabled and the page says why.
- Deliverability depends on that mailbox's domain reputation, authentication (SPF, DKIM, DMARC), low volume and low complaints. The software cannot guarantee the Primary tab.
- Contact rows hold business email addresses and first names. They are kept so that no address is emailed twice, and they are not deleted automatically. The owner is to set a retention period, which would then become a documented retention job.
- `outreach_connection` builds Django's SMTP backend directly, which Django 6.1 deprecates along with `EMAIL_BACKEND`. It moves to a `MAILERS` alias in the same migration.
