/**
 * Query parameters of `/pay` and `/pay/thank-you` (AID-018). The Super Admin owns invoices and
 * Stripe; this site only shows the form and the outcome it is redirected back with. Every value is
 * untrusted: anything outside the expected shape is dropped, never echoed.
 */

/** Invoice numbers look like `INV-2026-0001` (prefix, year, sequence). */
const invoicePattern = /^[A-Z]{2,8}-\d{4}-\d{3,6}$/;
/** Payment codes are 8 characters from an unambiguous alphabet, optionally split with a hyphen. */
const codePattern = /^[A-Z2-9]{4}-?[A-Z2-9]{4}$/;

/** Error codes the Super Admin's checkout endpoint redirects back with. */
export const payErrors = [
  "not-found",
  "paid",
  "verification",
  "rate-limited",
  "unavailable",
] as const;
export type PayError = (typeof payErrors)[number];

export interface PayParams {
  invoice: string;
  code: string;
  error: PayError | undefined;
  cancelled: boolean;
}

type Raw = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

export function normaliseInvoice(value: string | string[] | undefined): string {
  const invoice = first(value).toUpperCase();
  return invoicePattern.test(invoice) ? invoice : "";
}

export function parsePayParams(raw: Raw): PayParams {
  const code = first(raw.code).toUpperCase().replace(/\s+/g, "");
  const error = first(raw.error);
  return {
    invoice: normaliseInvoice(raw.invoice),
    code: codePattern.test(code) ? code : "",
    error: (payErrors as readonly string[]).includes(error) ? (error as PayError) : undefined,
    cancelled: first(raw.cancelled) === "1",
  };
}

/** What each outcome tells the payer. No message confirms whether an invoice exists. */
export const payErrorMessages: Record<PayError, { title: string; body: string }> = {
  "not-found": {
    title: "We could not find an invoice to pay",
    body: "Check the invoice number and payment code exactly as they appear on your invoice.",
  },
  paid: {
    title: "This invoice has already been paid",
    body: "There is nothing left to pay. Contact us if you think this is wrong.",
  },
  verification: {
    title: "The security check did not complete",
    body: "Please complete the check and try again. It needs JavaScript in your browser.",
  },
  "rate-limited": {
    title: "Please wait before trying again",
    body: "There have been several attempts in a short time. Try again in a few minutes.",
  },
  unavailable: {
    title: "Online payment is unavailable right now",
    body: "Nothing has been charged. Please try again later or contact us to pay another way.",
  },
};

/** The Super Admin endpoint the form posts to, derived from its origin. */
export const payCheckoutUrl = (superAdminOrigin: string): string =>
  new URL("/pay/checkout/", superAdminOrigin).toString();
