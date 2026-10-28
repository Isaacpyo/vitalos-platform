# Billing: invoices and payments

Vitalos's own invoices and the payments against them, in the Super Admin at `/billing/`. **SuperAdmin only**
(financial data): anonymous users go to sign-in, every other role gets 403. Every change is a POST with a
CSRF token and writes an audit event (`billing.*`); summaries name invoice numbers, never customer names or
amounts.

Nothing here emails a customer. The owner opens the invoice document, saves it as a PDF and sends it
from their own mailbox, using the plain-text summary on the invoice page.

## Pages

| URL | What |
| --- | --- |
| `/billing/invoices/` | Invoices: status tabs, overdue filter, search by number, name, organisation or email; outstanding and overdue totals |
| `/billing/invoices/new/` | New draft: bill-to details, line editor (description, quantity, unit price in £), notes. Save, or save and issue |
| `/billing/invoices/<number>/` | Invoice (`draft-<id>` before issue): status, lines and totals, payment link with copy button and QR, payment code, payments, record a bank transfer, void, plain-text summary |
| `/billing/invoices/<number>/document/` | The print-ready A4 invoice. "Print / Save as PDF" in the browser. DRAFT watermark, PAID and VOID stamps |
| `/billing/invoices/<number>/summary.txt` | The plain-text summary for pasting into an email |
| `/billing/invoices/from-opportunity/OPP-0001/` | POST: the "Create invoice" button on an AI & Data opportunity (a draft billed to its contact; the price is left for a person) |
| `/billing/payments/` | Payments: matched and unmatched, method filter, link or unlink, Sync from Stripe, record a manual payment |
| `/billing/settings/` | Issuer details, VAT, numbering prefix, payment terms, optional bank transfer details, footer; Stripe status |
| `POST /pay/checkout/` | Public: the vitalos.co.uk/pay form target (contract below) |
| `POST /api/webhooks/stripe/` | Public: Stripe webhook (signed) |

## Rules

- **Money** is integer pence. A line total is quantity × unit price rounded half up to the penny; VAT is
  the subtotal × rate rounded half up, once per invoice (`money.compute_totals`, the only place totals are worked out).
- **VAT** appears only when Billing settings say Vitalos is VAT registered (with a VAT number). Otherwise
  no VAT line and no VAT number is printed. The default is not registered.
- **Numbers** are `PREFIX-YEAR-SEQUENCE` (`INV-2026-0001`), allocated when an invoice is issued, under a
  row lock on the settings, unique per year. Drafts show "Draft".
- **Status**: `draft` → `issued` → `partially_paid` / `paid`, recomputed from the payments after every
  payment change (`services.recompute`: paid when the balance is £0.00 or less). `void` only from draft
  or issued with no payments, and needs a reason. Lines are editable only in draft. Issue snapshots the
  totals, VAT rate and VAT number, so later settings changes never rewrite an issued invoice.
- **Payment code**: 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O, 1/I/L), shown as `XXXX-XXXX`.
- **Payment link**: on issue, when `BILLING_STRIPE_SECRET_KEY` is set, a Stripe Price
  (`product_data[name]="Invoice INV-…"`, the balance in GBP) and a Payment Link (single use:
  `restrictions[completed_sessions][limit]=1`, `metadata[vitalos_invoice]`,
  `payment_intent_data[metadata][vitalos_invoice]`, redirect to `{BILLING_PUBLIC_SITE_URL}/pay/thank-you?invoice=<number>`).
  If Stripe is not configured or fails, the invoice is still issued and the page offers **Create payment link**.
  When the balance changes (a part payment) or reaches zero, the link is deactivated (`active=false`);
  create a new one for the new balance.
- **Payments** from Stripe arrive by webhook and by reconciliation (`sync_from_stripe`), both idempotent by
  Checkout Session id. A payment that names no known open invoice is kept **unmatched** for a person to link.
  `charge.refunded` stores the refunded amount on the matching payment (status `refunded` when fully refunded)
  and recomputes the invoice. Bank transfers are recorded by hand.

## The /pay contract (website ↔ Super Admin)

The website's `/pay` page posts a plain HTML form, cross-origin, to `https://admin.vitalos.co.uk/pay/checkout/`.
No JavaScript or CSRF token is needed; the endpoint is `csrf_exempt` and POST only (GET → 405).

Fields:

| Field | Meaning |
| --- | --- |
| `invoice` | Invoice number, case-insensitive (`inv-2026-0001` works) |
| `code` | Payment code, case-, space- and hyphen-insensitive (`abcd efgh`, `ABCD-EFGH`) |
| `cf-turnstile-response` (or `turnstileToken`) | Cloudflare Turnstile token. Verified when `TURNSTILE_SECRET_KEY` is set |
| `website` | Honeypot. Leave empty; a filled value is treated as `not-found` and nothing is stored |

Answers are always **303 See Other**:

- Success → the Stripe Checkout Session URL (`https://checkout.stripe.com/…`) for the current balance in GBP,
  named "Invoice INV-…", with `metadata[vitalos_invoice]`, `payment_intent_data[metadata][vitalos_invoice]`,
  `client_reference_id`, `customer_email` (the bill-to email), `success_url={site}/pay/thank-you?invoice=<number>`,
  `cancel_url={site}/pay?invoice=<number>&cancelled=1` and an `Idempotency-Key` (a double submit within 10
  minutes reuses one session).
- Failure → `{site}/pay?invoice=<number>&error=<code>` (`invoice` is omitted when the input was not a valid
  number shape). Codes, exactly:

| `error` | When |
| --- | --- |
| `not-found` | Unknown invoice, wrong code, draft or void (one generic code: nothing about which invoices exist leaks), or the honeypot was filled |
| `paid` | The balance is zero |
| `verification` | Turnstile failed |
| `rate-limited` | More than 10 attempts in 10 minutes from one IP, or 20 in 10 minutes naming one invoice from any IP |
| `unavailable` | Stripe is not configured, Stripe failed, or Stripe returned a URL that is not on `checkout.stripe.com` |

`{site}` is `BILLING_PUBLIC_SITE_URL`. The endpoint redirects only there or to `checkout.stripe.com` (no open
redirect) and never echoes the code. The website must allow the post: its CSP `form-action` needs
`https://admin.vitalos.co.uk` and `https://checkout.stripe.com`. The website also needs `/pay` (form with
the error messages above, `?invoice=` pre-filled, `?cancelled=1` notice) and `/pay/thank-you`. Payment is
confirmed only by the webhook or the sync, never by the thank-you page.

## Stripe setup (owner)

Use Vitalos's own Stripe account. Never reuse another product's key.

1. Stripe Dashboard → Developers → API keys → **Create restricted key** named `vitalos-superadmin-billing`
   with exactly: **Checkout Sessions: Write** (create; includes read), **Payment Links: Write**,
   **Prices: Write** (and Products: Write if Stripe asks, for `product_data`), **Checkout Sessions: Read**.
   Everything else None. Start in test mode (`rk_test_…`) and switch to the live key once a test payment
   has gone end to end.
2. Developers → Webhooks → **Add endpoint** `https://admin.vitalos.co.uk/api/webhooks/stripe/` with the events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `charge.refunded`. Copy its
   signing secret (`whsec_…`).
3. GitHub → repository Settings → Secrets and variables → Actions:
   secret `BILLING_STRIPE_SECRET_KEY` (the restricted key), secret `BILLING_STRIPE_WEBHOOK_SECRET` (the
   signing secret), variable `BILLING_PUBLIC_SITE_URL` (`https://vitalos.co.uk`; optional, that is the default).
   The next Super Admin deploy passes them to the Container App as secrets (`deploy.sh`, same rules as the
   other optional settings: an empty value never overwrites a stored one).
4. Billing → Settings: confirm the issuer details; tick VAT registered and enter the VAT number only if
   Vitalos is registered; add bank transfer details only if you want them printed.
5. Issue a test invoice, open its payment link, pay with a Stripe test card, and check the payment appears
   (webhook) or press **Sync from Stripe**.

Without a key everything except Stripe calls works, and the pages say "Stripe is not configured".
Without a webhook secret the webhook answers 503; payments still arrive through the sync.

## Reconciliation

`services.sync_from_stripe()` lists completed Checkout Sessions created in the lookback window
(`GET /v1/checkout/sessions?status=complete&created[gte]=…`, at most 5 pages of 100) and records each one
that carries `metadata.vitalos_invoice`. It runs:

- from **Sync from Stripe** on the Payments page (14 days),
- as `python manage.py billing_sync_stripe [--days N]`,
- inside the content tick at most every 10 minutes when a key is set (3 days; a failure is logged and never
  stops the tick). The Billing pages also start the opportunistic tick.

## Code

`models.py` (BillingSettings singleton, Invoice, InvoiceLine, Payment), `money.py` (arithmetic),
`services.py` (writes, Stripe orchestration, webhook handling, sync, public checkout), `selectors.py`
(reads, SuperAdmin-only access), `stripe_client.py` (stdlib HTTPS client: form encoding with bracket keys,
pinned `Stripe-Version`, `Idempotency-Key` on creates, timeouts, no redirects, the key never logged or put in
an exception; webhook signature verification with a 5-minute tolerance), `public.py` (`/pay/checkout/`,
webhook), `views.py` and `templates/billing/`. Tests: `tests/test_billing_*.py` run against a local fake
Stripe server (`tests/billing_helpers.py`); they prove our requests, not that Stripe accepts them.
