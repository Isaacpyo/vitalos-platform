import type { EnquiryEchoFieldName, EnquiryFieldErrors } from "@vitalos/validation/enquiry";

/**
 * State returned by `submitEnquiryAction` to `useActionState`. This file has no "use server"
 * directive and no runtime imports, so client components may import it without pulling in
 * validation code.
 */

/** Values to put back in the form after a failed submission. Never includes the Turnstile token. */
export type EnquiryFormValues = Partial<Record<EnquiryEchoFieldName, string>>;

export type EnquiryFormState =
  | { status: "idle" }
  | { status: "accepted"; reference: string }
  | {
      status: "invalid";
      /** First message per field; keys are the form field names. */
      fieldErrors: EnquiryFieldErrors;
      values: EnquiryFormValues;
      /** Summary line for the error summary heading. */
      message: string;
    }
  | { status: "rejected"; message: string; values: EnquiryFormValues }
  | {
      status: "rate-limited";
      message: string;
      retryAfterSeconds: number;
      values: EnquiryFormValues;
    }
  | { status: "unavailable"; message: string; values: EnquiryFormValues };

export const initialEnquiryFormState: EnquiryFormState = { status: "idle" };
