/**
 * Obviously artificial enquiry fixture for tests (`*.invalid` addresses only). Shaped like the
 * enquiry JSON body (`enquirySchemaV2`) without importing it, so this package stays free of
 * production dependencies.
 */
export const artificialEnquiryV2 = {
  name: "Example Person (fixture)",
  organisation: "Example Organisation (fixture)",
  workEmail: "person@example.invalid",
  role: "Fixture role",
  goal: "Clearly artificial non-production enquiry fixture used by automated tests.",
  timeframe: "within-3-months",
  intent: "project",
  sourcePath: "/contact",
  consent: true,
  privacyNoticeVersion: "fixture-1",
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
} as const;

/** A fresh copy with a unique idempotency key, so each test submits a distinct enquiry. */
export function artificialEnquiryBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...artificialEnquiryV2, idempotencyKey: crypto.randomUUID(), ...overrides };
}
