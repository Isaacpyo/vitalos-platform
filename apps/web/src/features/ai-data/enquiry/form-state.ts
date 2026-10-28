import type { AiDataEchoFieldName, AiDataFieldName } from "@vitalos/validation/ai-data-enquiry";

/**
 * State returned by `submitAiDataEnquiryAction` to `useActionState`. No "use server" directive
 * and no runtime imports, so the client form may import it without pulling in validation code.
 */

/** Values to put back in the form after a failed submission. Never the token or the honeypot. */
export type AiDataFormValues = Partial<Record<AiDataEchoFieldName, string>>;

/**
 * First message per field. `form` holds an error on something the visitor cannot see (the
 * recorded source, the security check); the form links it to itself.
 */
export type AiDataFormErrors = Partial<Record<AiDataFieldName | "form", string>>;

export type AiDataFormState =
  | { status: "idle" }
  | { status: "accepted"; reference: string }
  | { status: "invalid"; fieldErrors: AiDataFormErrors; values: AiDataFormValues; message: string }
  | { status: "rejected"; message: string; values: AiDataFormValues }
  | {
      status: "rate-limited";
      message: string;
      retryAfterSeconds: number;
      values: AiDataFormValues;
    }
  | { status: "unavailable"; message: string; values: AiDataFormValues };

export const initialAiDataFormState: AiDataFormState = { status: "idle" };
