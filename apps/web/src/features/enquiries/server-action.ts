"use server";

import { clientIpFromHeaders } from "@vitalos/security/rate-limit";
import { enquiryInputFromForm } from "@vitalos/validation/enquiry";
import { headers } from "next/headers";
import { after } from "next/server";
import { scheduleDispatch } from "./http/handle-enquiry-request";
import { correlationIdFrom } from "./http/request-guards";
import type { EnquiryFormState } from "./form-state";
import { getEnquiryService } from "./get-enquiry-service";
import { echoValues, toFormState } from "./to-form-state";

/**
 * Form action for the contact page: `useActionState(submitEnquiryAction, initialEnquiryFormState)`.
 * Works as a native form POST without JavaScript. Next.js compares the Origin header with the
 * Host (or `serverActions.allowedOrigins`) before invoking a Server Action; that is a framework
 * guard this code relies on but does not replace: input validation, rate limiting and the human
 * check below all run regardless.
 *
 * Only this async function may be exported from a "use server" file; types and constants live in
 * `./form-state`.
 */
export async function submitEnquiryAction(
  _previousState: EnquiryFormState,
  formData: FormData,
): Promise<EnquiryFormState> {
  const values = echoValues(formData);
  try {
    const requestHeaders = await headers();
    const service = getEnquiryService();
    const result = await service.receive({
      body: enquiryInputFromForm(formData),
      ip: clientIpFromHeaders(requestHeaders),
      correlationId: correlationIdFrom(requestHeaders),
    });
    if (result.kind === "accepted") {
      scheduleDispatch({ service, after });
    }
    return toFormState(result, values);
  } catch {
    return toFormState({ kind: "unavailable" }, values);
  }
}
