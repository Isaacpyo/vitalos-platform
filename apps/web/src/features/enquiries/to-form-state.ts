import { enquiryEchoFieldNames } from "@vitalos/validation/enquiry";
import type { ReceiveResult } from "./application/receive-enquiry";
import type { EnquiryFormState, EnquiryFormValues } from "./form-state";

export const enquiryFormMessages = {
  invalid: "Check the highlighted fields and send your enquiry again.",
  rejected: "We could not verify this request. Please try again.",
  unavailable: "We cannot receive enquiries online right now. Please contact us directly.",
} as const;

/** Reads the echo fields from a submission as plain strings. */
export function echoValues(reader: { get(name: string): unknown }): EnquiryFormValues {
  const values: EnquiryFormValues = {};
  for (const name of enquiryEchoFieldNames) {
    const value = reader.get(name);
    if (typeof value === "string" && value !== "") values[name] = value;
  }
  return values;
}

export function toFormState(result: ReceiveResult, values: EnquiryFormValues): EnquiryFormState {
  switch (result.kind) {
    case "accepted":
      return { status: "accepted", reference: result.reference };
    case "invalid":
      return {
        status: "invalid",
        fieldErrors: result.fieldErrors,
        values,
        message: enquiryFormMessages.invalid,
      };
    case "rejected":
      return { status: "rejected", message: enquiryFormMessages.rejected, values };
    case "rate-limited": {
      const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
      return {
        status: "rate-limited",
        message: `Too many enquiries have been sent from your connection. Please try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
        retryAfterSeconds: result.retryAfterSeconds,
        values,
      };
    }
    case "unavailable":
      return { status: "unavailable", message: enquiryFormMessages.unavailable, values };
  }
}
