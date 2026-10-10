import { contactIntents } from "@vitalos/cms";
import type { ContactIntent } from "@vitalos/cms";
import { createEnquirySchemaV2, utmKeys } from "@vitalos/validation/enquiry";
import type { UtmKey } from "@vitalos/validation/enquiry";

/** Query-string shape Next.js passes to a page (`await searchParams`). */
export type ContactSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export interface ContactPrefill {
  /** A valid `?intent=` value, or `offer` when only `?offer=` is present. */
  intent?: ContactIntent;
  offerSlug?: string;
  utm: Partial<Record<UtmKey, string>>;
}

// The schema is the single description of what the enquiry boundary accepts, so the prefill is
// checked against its own field rules instead of a second copy of the limits.
const schema = createEnquirySchemaV2();

const first = (value: string | string[] | undefined): string | undefined => {
  const picked = Array.isArray(value) ? value[0] : value;
  const trimmed = picked?.trim();
  return trimmed ? trimmed : undefined;
};

const isIntent = (value: string | undefined): value is ContactIntent =>
  value !== undefined && (contactIntents as readonly string[]).includes(value);

/**
 * Reads the pre-fill values a visitor can arrive with: `?intent=`, `?offer=` and `utm_*`.
 * Everything is untrusted: anything that would fail enquiry validation is dropped rather than
 * carried into hidden inputs, so a bad link can never make a valid form fail on fields the
 * visitor cannot see.
 */
export function parseContactSearchParams(params: ContactSearchParams): ContactPrefill {
  const rawIntent = first(params.intent);
  const rawOffer = first(params.offer);

  const offerSlug =
    rawOffer !== undefined && schema.shape.offerSlug.safeParse(rawOffer).success
      ? rawOffer
      : undefined;

  const utm: Partial<Record<UtmKey, string>> = {};
  for (const key of utmKeys) {
    const value = first(params[`utm_${key}`]);
    if (value === undefined) continue;
    // Validate one key at a time so one bad value does not discard the others.
    if (schema.shape.utm.safeParse({ [key]: value }).success) utm[key] = value;
  }
  // The combined size is bounded too (UTF-8 bytes of the JSON): drop the lot if it overflows.
  const boundedUtm = schema.shape.utm.safeParse(utm).success ? utm : {};

  const intent = isIntent(rawIntent) ? rawIntent : offerSlug ? "offer" : undefined;
  return {
    ...(intent ? { intent } : {}),
    ...(offerSlug ? { offerSlug } : {}),
    utm: boundedUtm,
  };
}
