# Vitalos inbound mail Worker

A Cloudflare Email Worker for `support@vitalos.co.uk`. It does two things for every message, in this order:

1. Forwards the original message to the existing inbox (`FORWARD_TO`), so nothing is lost.
2. Posts the raw MIME, signed with HMAC-SHA256, to the Super Admin at `https://admin.vitalos.co.uk/api/inbound/email`, where it appears in the Enquiries tab.

It is **prepared, not deployed**. Deploying and binding it are owner steps in [superadmin/docs/email-setup.md](../../superadmin/docs/email-setup.md). Design: [ADR-028](../../docs/adr/ADR-028-superadmin-enquiries-mail-console.md).

## Behaviour

- The raw stream is read once into memory, then `message.forward()` runs, then the signed POST. Cloudflare's runtime documentation does not state that `forward()` still works after `raw` has been read (reading then forwarding is the usual parse-then-forward pattern). The test plan in the runbook checks this on the real route. If the test shows the forward failing after the read, the fallback is to forward first and read `message.raw` afterwards; change the order in `src/index.js` and re-test.
- Messages over 25 MiB (the app's limit) are forwarded but not posted.
- Forwarding adds one header, `X-Vitalos-Inbound: worker`. Cloudflare only allows `X-` headers to be added.
- Once the forward has succeeded the Worker never throws, because a throw makes Cloudflare bounce the sender. A failed or slow POST (10 second timeout), a non-2xx answer or a read failure is logged with `console.error` (status or error name only, never message content) and the Worker returns.
- If the forward itself fails (for example `FORWARD_TO` is unset or not a verified destination), the POST is still attempted so the app keeps the message, then the error is rethrown so the sender is told. The app de-duplicates a resend by Message-ID.
- It does no parsing. The app parses the MIME, so the Worker stays within the Workers Free CPU limit.

## Request contract

`POST {INBOUND_WEBHOOK_URL}` with the raw MIME as the body and:

| Header                    | Value                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Content-Type`            | `message/rfc822`                                                                                          |
| `X-Vitalos-Timestamp`     | Unix seconds. The app rejects anything more than 5 minutes off (401)                                      |
| `X-Vitalos-Signature`     | Lowercase hex HMAC-SHA256 of `INBOUND_WEBHOOK_SECRET` over `${timestamp}.` followed by the raw body bytes |
| `X-Vitalos-Envelope-From` | `message.from` (envelope MAIL FROM)                                                                       |
| `X-Vitalos-Envelope-To`   | `message.to` (envelope RCPT TO)                                                                           |

The app answers 200 `{"status": "stored" | "duplicate"}`, 401 for a bad signature or stale timestamp, or 413 over 25 MiB.

## Configuration

No secrets in the repository. From this folder, once:

```sh
npx wrangler secret put INBOUND_WEBHOOK_URL      # https://admin.vitalos.co.uk/api/inbound/email
npx wrangler secret put INBOUND_WEBHOOK_SECRET   # the same value as the app's INBOUND_WEBHOOK_SECRET
npx wrangler secret put FORWARD_TO               # the existing inbox, a verified Email Routing destination
```

`FORWARD_TO` must already be listed under Email Routing, Destination addresses, as verified.

## Test

No dependencies and no install step:

```sh
node --test "infra/cloudflare-email-worker/test/*.test.js"
```

The tests mock the message and `fetch`, and check that the forward happens (also when the POST fails), that the signature equals a Node `crypto.createHmac` computation, the headers, and that nothing throws after a successful forward.

## Rollback

Unbind the Worker from the `support@` route in the Cloudflare dashboard and restore the plain forward rule (runbook, rollback). Mail then flows as before and the Worker is inert.
