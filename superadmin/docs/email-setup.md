# Email setup: operator runbook

For Temitope. This turns on mail for the Super Admin: support@ mail appearing in the Enquiries tab, sign-in and set-password links, notifications and the website contact form. Everything here changes a live account, so **every step is marked "Needs approval"**: nothing in the repository has done any of it, and nothing happens until you run the step.

Design and reasons: [ADR-029](../../docs/adr/ADR-029-superadmin-enquiries-mail-console.md). The Worker: [infra/cloudflare-email-worker](../../infra/cloudflare-email-worker/README.md).

## What is known, and what is not

Recorded 11 Oct 2026:

- DNS is on Cloudflare (name servers `jose.ns.cloudflare.com` and `kimora.ns.cloudflare.com`).
- Inbound mail uses Cloudflare Email Routing (MX `route1`, `route2`, `route3.mx.cloudflare.net`).
- SPF is `v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all`. DMARC is `v=DMARC1; p=none;`. No DKIM was found at the common selectors.
- Google Workspace was cancelled in Feb 2026, so the Google SPF include is probably stale.
- Microsoft 365 is planned (Entra SSO is Phase 2 item 1) but is not live in DNS.
- support@ appears to forward to a shared Gmail inbox. **This is an inference: confirm it** in the Cloudflare dashboard (Email, Email Routing, Routing rules) before step 1.
- A Resend account exists. Whether a domain is verified in it is unknown.
- Resend's free tier was 3,000 emails a month and 100 a day. **Recheck on the Resend pricing page before relying on it.**

## Decisions this runbook assumes

- One primary owner, `admin@vitalos.co.uk` (`PRIMARY_OWNER_EMAIL`). Only the owner grants or revokes SuperAdmin. There is no `SUPER_ADMIN_EMAILS` list and no `APP_ENV`: the app keeps `APP_ENVIRONMENT`.
- Inbound mail: Cloudflare Email Worker (primary). Fallback if the Worker is not wanted: Resend Inbound on a subdomain (see "Fallback" at the end).
- Outbound mail: Resend. Until `EMAIL_TRANSPORT=resend` the app only logs messages (`log` is the default), so it is safe to deploy first.

## 0. Before you start

Needs approval (you decide to start).

- You need: the Cloudflare account that owns vitalos.co.uk, the Resend account, Azure access (the `az` CLI signed in) and GitHub access to the repository's `Production` environment.
- Pick the shared inbox that must keep receiving every support@ message (call it `INBOX`, probably the Gmail address). Under Email Routing, Destination addresses, it must show **Verified**.
- Generate the shared secret for the Worker once, and keep it out of chat, files and the terminal history:

```sh
openssl rand -hex 32
```

Store it as `INBOUND_WEBHOOK_SECRET` (step 9) and give the same value to the Worker (step 1). Never commit it.

## 1. Deploy the Worker and bind it to support@

Needs approval. This **replaces that route's plain forward**: from the moment you save the rule, support@ mail goes to the Worker, which forwards it to `INBOX` itself and posts a copy to the app. Do it after the app has `INBOUND_WEBHOOK_SECRET` (step 9), or the Worker will forward only and log that the webhook is not configured.

```sh
cd infra/cloudflare-email-worker
npx wrangler login                                  # opens a browser; sign in to the Vitalos Cloudflare account
node --test "test/*.test.js"                        # all tests pass before you deploy
npx wrangler deploy                                 # creates the Worker "vitalos-inbound"
npx wrangler secret put INBOUND_WEBHOOK_URL         # https://admin.vitalos.co.uk/api/inbound/email
npx wrangler secret put INBOUND_WEBHOOK_SECRET      # the value from step 0
npx wrangler secret put FORWARD_TO                  # INBOX (must be a verified destination)
```

Then in the Cloudflare dashboard: **Email, Email Routing, Routing rules**. Edit the `support@vitalos.co.uk` custom address, set **Action: Send to a Worker** and **Destination: vitalos-inbound**, and save. Note the old destination first so you can restore it (rollback).

## 2. Routes for admin@ and notifications@

Needs approval. In **Email Routing, Routing rules, Create address**:

| Custom address | Action        | Destination                              | Why                                                                      |
| -------------- | ------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| `admin@`       | Send to email | your own inbox (verified destination)    | The primary owner receives set-password and sign-in recovery links here  |
| `notifications@` | Send to email | your own inbox (verified destination)  | Receives bounces and any replies to notification mail                    |

Add a new destination under **Destination addresses** first if needed; Cloudflare emails a verification link to it.

## 3. Verify a Resend sending domain

Needs approval. In Resend: **Domains, Add Domain**. Choose one:

| Option                           | From address                          | Trade-off                                                                                                  |
| -------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Apex `vitalos.co.uk`             | `support@vitalos.co.uk`                | Replies and notices come from the real support address and align with the DMARC policy on the apex. More records on the main domain, and every sender on the apex must keep DKIM passing before DMARC tightens. |
| Subdomain `mail.vitalos.co.uk`   | `notifications@mail.vitalos.co.uk`     | Isolated reputation and the lowest risk to existing mail. DMARC aligns on the subdomain, but replies shown as From support@ would not align, so set `Reply-To: support@vitalos.co.uk` instead. |

Use the apex only if replies to enquirers must be sent From `support@`. Otherwise use the subdomain.

Resend then shows the exact records. Add **those** in Cloudflare (DNS, Records), with **Proxy status: DNS only**. They are normally:

- a DKIM `TXT` record at `resend._domainkey` (or `resend._domainkey.mail` for the subdomain) with the long `p=` value Resend displays;
- an SPF `TXT` record and a return-path `MX` record on the `send` (or `send.mail`) subdomain, pointing at Amazon SES feedback servers.

Copy values exactly from the Resend page (do not retype). Resend places SPF on the `send` subdomain, so the apex SPF record is not edited for Resend. Click **Verify DNS Records** in Resend and wait for **Verified**.

## 4. DMARC reporting and the Google SPF include

Needs approval.

1. Add a report address now, keeping the policy at `none`. Edit the `_dmarc` TXT record to:

   `v=DMARC1; p=none; rua=mailto:dmarc@vitalos.co.uk`

   `dmarc@` needs an Email Routing rule (as in step 2) or reports go nowhere. A third-party DMARC report reader can be added later.
2. Read the reports for a few weeks. Move to `p=quarantine` **only after DKIM passes for every sender** of vitalos.co.uk mail (Resend, and any other service that sends as the domain). Do not move to `reject` without a further review.
3. Remove `include:_spf.google.com` from the apex SPF record **once you have confirmed nothing still sends through Google** (the Workspace subscription was cancelled in Feb 2026). The record then reads `v=spf1 include:_spf.mx.cloudflare.net ~all`. Keep exactly one SPF record on the apex.

## 5. Resend API key and webhook

Needs approval.

1. **API Keys, Create API Key**: name `superadmin-prod`, permission **Sending access**, restricted to the verified domain. Copy it once; it is `RESEND_API_KEY`.
2. **Webhooks, Add Endpoint**: URL `https://admin.vitalos.co.uk/api/webhooks/resend`. Events: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained` (add `email.received` only if you choose the Resend Inbound fallback). Copy the signing secret (`whsec_...`); it is `RESEND_WEBHOOK_SECRET`.
3. Store both **only** in Container Apps and the GitHub `Production` environment secrets (step 9). Do not put them in `.env` files that are committed, chat or tickets.

## 6. Optional: private R2 bucket for attachments

Needs approval. Without object storage the app does not store attachments (the message text is kept; attachment names and sizes are listed). To store them:

```sh
npx wrangler r2 bucket create vitalos-enquiry-attachments      # private by default; never enable public access
```

In the Cloudflare dashboard, **R2, Manage API tokens, Create API token** with **Object Read & Write** limited to that bucket. Set `OBJECT_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `OBJECT_STORAGE_BUCKET=vitalos-enquiry-attachments`, `OBJECT_STORAGE_REGION=auto`, and the token's access key as `OBJECT_STORAGE_ACCESS_KEY_ID` and `OBJECT_STORAGE_SECRET_ACCESS_KEY`. R2 has a free tier; check current limits and whether it needs a payment method before creating the bucket.

## 7. Turn sending on

Needs approval. Set `EMAIL_TRANSPORT=resend` (step 9 sets it through the deploy). Also set `NOTIFY_FROM` to an address on the verified domain (the address only, for example `notifications@vitalos.co.uk`; the app adds the display name), `SUPPORT_MAILBOX=support@vitalos.co.uk` and `NOTIFY_OWNER_EMAIL`. Forgot-password is offered only when mail can be delivered, so it appears once this is on.

## 8. Notification schedule (Container Apps job)

Needs approval. `send_enquiry_notifications` runs every 5 minutes: it flushes pending notifications and sends the 08:00 digest. Create it as a scheduled job that uses the same image, secrets and variables as the app:

```sh
RG=rg-vitalos-superadmin
IMAGE="$(az containerapp show -n superadmin -g "$RG" --query 'properties.template.containers[0].image' -o tsv)"
secret() { az containerapp secret show -n superadmin -g "$RG" --secret-name "$1" --query value -o tsv; }

az containerapp job create -n superadmin-notify -g "$RG" --environment cae-vitalos-superadmin \
  --trigger-type Schedule --cron-expression "*/5 * * * *" \
  --replica-timeout 300 --replica-retry-limit 0 --parallelism 1 --replica-completion-count 1 \
  --image "$IMAGE" --cpu 0.25 --memory 0.5Gi \
  --command python --args "manage.py" "send_enquiry_notifications" \
  --secrets "django-secret-key=$(secret django-secret-key)" "database-url=$(secret database-url)" \
            "resend-api-key=$(secret resend-api-key)" \
  --env-vars DJANGO_SETTINGS_MODULE=config.settings.prod DJANGO_SECRET_KEY=secretref:django-secret-key \
             DATABASE_URL=secretref:database-url RESEND_API_KEY=secretref:resend-api-key \
             APP_ENVIRONMENT=production APP_BASE_URL=https://admin.vitalos.co.uk \
             EMAIL_TRANSPORT=resend SUPPORT_MAILBOX=support@vitalos.co.uk \
             NOTIFY_FROM=notifications@vitalos.co.uk NOTIFY_OWNER_EMAIL="<same as the app>"
```

Add any other variable the command needs from the same list the app has (for example `SLACK_WEBHOOK_URL` as a `secretref:`). After a new image deploys, update the job image: `az containerapp job update -n superadmin-notify -g "$RG" --image <new image>`.

**Cost note.** 288 runs a day is about 8,600 a month. At 0.25 vCPU and 0.5 GiB, each run of roughly 15 seconds (including the database connection) uses about 4 vCPU-seconds and 8 GiB-seconds, so about 32,000 vCPU-seconds and 65,000 GiB-seconds a month. That is an estimate against the free grant of 180,000 vCPU-seconds and 360,000 GiB-seconds shared with the app, so it should stay inside the grant, but check Azure Cost Management after a week and keep the £1 budget alert. The runs also keep the free-tier database awake. A slower cadence (every 15 minutes) cuts the usage by two thirds.

## 9. Secrets and variables in GitHub and Container Apps

Needs approval. The deploy workflow passes these through when they are set; unset ones are left alone and an existing Container Apps secret is never overwritten with an empty value.

GitHub, repository, **Settings, Environments, Production**:

| Kind     | Name                                                                                      |
| -------- | ----------------------------------------------------------------------------------------- |
| Secrets  | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `INBOUND_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `OBJECT_STORAGE_ACCESS_KEY_ID`, `OBJECT_STORAGE_SECRET_ACCESS_KEY`, `SLACK_WEBHOOK_URL` |
| Variables | `PRIMARY_OWNER_EMAIL` (`admin@vitalos.co.uk`), `EMAIL_TRANSPORT` (`resend`), `INBOUND_PROVIDER` (`cloudflare`), `NOTIFY_OWNER_EMAIL`, `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_REGION`, `RETENTION_ENFORCE` (leave unset or `false` until you have read a dry run) |

Set them with the CLI so values are not echoed (it prompts or reads standard input):

```sh
gh secret set INBOUND_WEBHOOK_SECRET --env Production
gh secret set RESEND_API_KEY --env Production
gh secret set RESEND_WEBHOOK_SECRET --env Production
gh variable set EMAIL_TRANSPORT --env Production --body resend
gh variable set PRIMARY_OWNER_EMAIL --env Production --body admin@vitalos.co.uk
```

Then run the **Super Admin deploy** workflow (type `DEPLOY`). `APP_BASE_URL` is always `https://admin.vitalos.co.uk`. `PRIMARY_OWNER_EMAIL` also reaches the release job, which runs `create_owner`.

## 10. Create the owner and its first password

Needs approval. The release job creates `admin@vitalos.co.uk` with **no password** when `PRIMARY_OWNER_EMAIL` is set (`create_owner`; it is idempotent and leaves other SuperAdmins alone). Issue a one-time link from a terminal; it prints the link to that terminal only, and it works once for 30 minutes:

```sh
az containerapp exec -n superadmin -g rg-vitalos-superadmin --command "python manage.py issue_setup_link --email admin@vitalos.co.uk"
```

Open the link, set a password, then enrol the authenticator app (TOTP is required for SuperAdmin). Do not paste the link anywhere else. Run the command again for a new link if it expires.

## 11. Test plan

Needs approval (it sends real mail).

1. Send one email from a personal address to `support@vitalos.co.uk`.
2. Confirm it arrives in `INBOX` **and** appears in **Enquiries** in the Super Admin within a minute. This also proves the Worker's `forward()` works after reading the message.
3. If it reached `INBOX` but not the app, check `npx wrangler tail vitalos-inbound` (log lines carry status codes only) and that the two `INBOUND_WEBHOOK_SECRET` values match.
4. If it reached the app but not `INBOX`, roll back (below) and report it: the Worker's order of reading then forwarding needs changing.
5. Send the same message again from the sender's side: the app should report `duplicate`, not a second enquiry.
6. Reply from the Enquiries tab to the test address and check the Resend dashboard shows `delivered`.
7. Use **Forgot password** on the sign-in page with `admin@vitalos.co.uk`: the link should arrive at `INBOX` through the `admin@` route.
8. Run `python manage.py enforce_enquiry_retention` and read the dry run. Set `RETENTION_ENFORCE=true` only after approving what it would remove (the owner-approved retention is 24 months).

## 12. Website contact form (document only; needs sign-off)

Needs approval and a separate pull request. Do **not** change `apps/web` as part of this runbook. The website form would post to the Super Admin as well as, or instead of, today's pipeline (ADR-019 holds the current one and its unapproved items). The app endpoint is `POST /api/inbound/web-form`, JSON `{name, email, company, message, website, turnstile_token}` where `website` is a honeypot and must be empty, signed with the same HMAC scheme over the exact JSON body bytes. It answers 201 `{ref}`.

A server-side Next.js route handler sketch. The secret stays on the server; never expose it to the browser, and add the variable names to `turbo.json` `globalEnv` and the web app's `.env.example`:

```ts
// apps/web/app/api/contact/route.ts (sketch; not part of this change)
import { createHmac } from "node:crypto";

const URL = process.env.SUPERADMIN_WEB_FORM_URL; // https://admin.vitalos.co.uk/api/inbound/web-form
const SECRET = process.env.SUPERADMIN_WEB_FORM_SECRET; // same value as the app's INBOUND_WEBHOOK_SECRET

export async function POST(request: Request) {
  const input = await request.json(); // validate and rate limit first (existing enquiry rules)
  const body = JSON.stringify({
    name: input.name,
    email: input.email,
    company: input.company ?? "",
    message: input.message,
    website: input.website ?? "", // honeypot
    turnstile_token: input.turnstileToken,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", SECRET!).update(`${timestamp}.`).update(body).digest("hex");

  const response = await fetch(URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Vitalos-Timestamp": timestamp,
      "X-Vitalos-Signature": signature,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return Response.json({ ok: false }, { status: 502 });
  return Response.json({ ok: true, ref: (await response.json()).ref }, { status: 201 });
}
```

Before shipping it the owner must approve the privacy notice wording and retention (v2026-10 is approved; 24 months), and set the two variables in Vercel for Preview and Production.

## Rollback

Needs approval.

- **Restore plain forwarding:** in Cloudflare, Email Routing, Routing rules, edit `support@vitalos.co.uk`, set **Action: Send to an email** and **Destination: INBOX** (the value you noted in step 1). Mail flows as it did before; the Worker is then inert. To remove it entirely: `npx wrangler delete vitalos-inbound` from the Worker folder.
- **Stop sending mail:** set `EMAIL_TRANSPORT=log` (GitHub variable, then redeploy) and delete the `superadmin-notify` job: `az containerapp job delete -n superadmin-notify -g rg-vitalos-superadmin`.
- **DNS:** the records added in steps 3 and 4 can stay; they do not affect other mail. Revert the DMARC `rua` change only if the report mailbox is a problem.
- **Secrets:** rotate any key that may have been exposed (new Resend key, new `INBOUND_WEBHOOK_SECRET` in both the Worker and the app).

## Fallback: Resend Inbound

Use this only if the Worker is not wanted. Set `INBOUND_PROVIDER=resend`, add a receiving subdomain in Resend (for example `inbound.vitalos.co.uk`) with the MX record Resend displays, add `email.received` to the Resend webhook, and change the `support@` Cloudflare rule to forward to an address on that subdomain (and keep `INBOX` as a second destination if you need a copy). Microsoft Graph (`INBOUND_PROVIDER=graph`) is a later option once Microsoft 365 is live.
