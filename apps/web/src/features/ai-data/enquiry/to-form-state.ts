import { aiDataEchoFieldNames } from "@vitalos/validation/ai-data-enquiry";
import type { AiDataFieldName } from "@vitalos/validation/ai-data-enquiry";
import type { EnquiryFieldErrors, EnquiryFieldName } from "@vitalos/validation/enquiry";
import type { ReceiveResult } from "../../enquiries/application/receive-enquiry";
import { toFormState } from "../../enquiries/to-form-state";
import type { AiDataFormErrors, AiDataFormState, AiDataFormValues } from "./form-state";

/** Reads the echo fields from a submission as plain strings (never the token or honeypot). */
export function echoAiDataValues(reader: { get(name: string): unknown }): AiDataFormValues {
  const values: AiDataFormValues = {};
  for (const name of aiDataEchoFieldNames) {
    const value = reader.get(name);
    if (typeof value === "string" && value !== "") values[name] = value;
  }
  return values;
}

/**
 * Where an error the enquiry service reports on the composed v2 body belongs in the AI & Data
 * form. Shared fields keep their name; `goal` is composed mostly from the problem description;
 * `offerSlug` comes from the offer select. Anything else (intent, source path) is not a field the
 * visitor can change and is reported against the form.
 */
const v2ToAiData: Partial<Record<EnquiryFieldName, AiDataFieldName>> = {
  name: "name",
  workEmail: "workEmail",
  organisation: "organisation",
  role: "role",
  goal: "problem",
  timeframe: "timeframe",
  offerSlug: "offer",
  utm: "utm",
  consent: "consent",
  privacyNoticeVersion: "privacyNoticeVersion",
  idempotencyKey: "idempotencyKey",
  turnstileToken: "turnstileToken",
};

export function mapEnquiryFieldErrors(errors: EnquiryFieldErrors): AiDataFormErrors {
  const mapped: AiDataFormErrors = {};
  for (const [name, message] of Object.entries(errors) as [EnquiryFieldName, string][]) {
    if (!message) continue;
    const target = v2ToAiData[name] ?? "form";
    mapped[target] ??= message;
  }
  return mapped;
}

/**
 * The enquiry service's result as AI & Data form state. The messages are the main contact form's
 * own (`toFormState`), so both forms say the same thing in the same situation; only the field
 * names and the echoed values differ.
 */
export function toAiDataFormState(
  result: ReceiveResult,
  values: AiDataFormValues,
): AiDataFormState {
  const state = toFormState(result, {});
  switch (state.status) {
    case "idle":
    case "accepted":
      return state;
    case "invalid":
      return {
        status: "invalid",
        fieldErrors: mapEnquiryFieldErrors(state.fieldErrors),
        values,
        message: state.message,
      };
    case "rejected":
    case "unavailable":
      return { status: state.status, message: state.message, values };
    case "rate-limited":
      return {
        status: "rate-limited",
        message: state.message,
        retryAfterSeconds: state.retryAfterSeconds,
        values,
      };
  }
}
