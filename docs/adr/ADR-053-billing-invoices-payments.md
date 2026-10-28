# ADR 053 Billing: invoices and payments in the Super Admin, with Stripe

- **Status:** Accepted (engineering), 28 Oct 2026. Stripe stays off until the owner creates a Vitalos restricted key and the webhook (`superadmin/apps/billing/README.md`).
- **Owner request:** invoicing and payments in the Super Admin; customers pay by card from a link or QR code on the invoice, or at vitalos.co.uk/pay.

## Context

Vitalos has no invoicing. Offers are priced in the AI & Data pipeline (`apps.aidata`) and paid work will need invoices with the company's legal details, a payment route and a record of what has been paid. The Super Admin is the system of record for operational data (PostgreSQL); the website is public and holds no customer records.

## Decision

1. **A new Django app `apps.billing`** in the Super Admin: `BillingSettings` (singleton, seeded with the public company details from `packages/cms/src/repo/legal.ts`), `Invoice`, `InvoiceLine` and `Payment`. SuperAdmin only. Money is integer pence; totals are computed in one function and snapshotted at issue (with the VAT rate and VAT number). Not VAT registered by default: no VAT line, no VAT claim. Numbers `PREFIX-YEAR-SEQUENCE` are allocated at issue under a row lock.
2. **Stripe through a small stdlib client**, not the SDK (no new runtime dependency): form-encoded requests, pinned `Stripe-Version`, `Idempotency-Key` on creates, timeouts, no redirects, the key never logged. Settings `BILLING_STRIPE_SECRET_KEY`, `BILLING_STRIPE_WEBHOOK_SECRET` (secrets) and `BILLING_PUBLIC_SITE_URL`. A Vitalos restricted key only; no other product's key.
3. **Two payment routes, both Stripe-hosted:** a single-use Payment Link per issued invoice (link and QR on the invoice), and Checkout Sessions opened by `POST /pay/checkout/` from the website's `/pay` form (invoice number + an 8-character payment code). Card details never touch Vitalos systems.
4. **Payments are recorded only from Stripe's side:** the signed webhook (`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`) and a bounded, idempotent reconciliation (`sync_from_stripe`) run from the Payments page, a management command and the content tick (ADR-042) at most every 10 minutes. The thank-you page never marks anything paid. Bank transfers are recorded by a person.
5. **No email to customers.** The invoice is a print-ready A4 HTML document saved as PDF from the browser; the owner sends it with the plain-text summary. Sending external messages stays the owner's decision (AGENTS.md).

## Consequences

- One more public endpoint (`/pay/checkout/`): POST only, Turnstile when configured, honeypot, per-IP and per-invoice rate limits (Django cache, per process), one generic `not-found` code, redirects only to `BILLING_PUBLIC_SITE_URL` or `checkout.stripe.com`.
- The website must add `/pay` and `/pay/thank-you` and allow the cross-origin form post in its CSP `form-action`.
- Stripe fees apply per card payment once live; creating the account and keys is the owner's step.
- Tests use a local fake Stripe server; they prove our requests, not Stripe's acceptance. A test-mode payment end to end is the first live check.
