"use server";

import { routes } from "@vitalos/cms";
import { clientIpFromHeaders } from "@vitalos/security/rate-limit";
import {
  aiDataEnquiryInputFromForm,
  aiDataEnquirySchema,
  summariseAiDataIssues,
  toEnquiryInputV2,
} from "@vitalos/validation/ai-data-enquiry";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getEnquiryService } from "../../enquiries/get-enquiry-service";
import { scheduleDispatch } from "../../enquiries/http/handle-enquiry-request";
import { correlationIdFrom } from "../../enquiries/http/request-guards";
import { enquiryFormMessages } from "../../enquiries/to-form-state";
import type { AiDataFormState } from "./form-state";
import { echoAiDataValues, toAiDataFormState } from "./to-form-state";

/**
 * Form action for /ai-data/contact (AID-004): `useActionState(submitAiDataEnquiryAction, ...)`,
 * and a native form POST without JavaScript.
 *
 * 1. Validate the AI & Data fields (`aiDataEnquirySchema`); field errors come back on the AI &
 *    Data field names with the visitor's values (never the token or the honeypot).
 * 2. Compose the existing enquiry contract v2 body (`intent: "ai"`, source `/ai-data/contact`,
 *    labelled sections in `goal`, `offerSlug` when an offer was chosen).
 * 3. Hand it to the SAME enquiry service as the main contact form: rate limits, idempotent replay,
 *    the human check and persistence (record first). Notification follows from the outbox after
 *    the response (`scheduleDispatch`), exactly as for the main form.
 *
 * A filled honeypot is passed to the service as the honeypot alone, so it is rejected and logged
 * the same way as on the main form, without the visitor's details. Next.js checks the Origin
 * header before invoking a Server Action; validation, rate limiting and the human check run
 * regardless.
 */
export async function submitAiDataEnquiryAction(
  _previousState: AiDataFormState,
  formData: FormData,
): Promise<AiDataFormState> {
  const values = echoAiDataValues(formData);
  let state: AiDataFormState;
  try {
    const parsed = aiDataEnquirySchema.safeParse(aiDataEnquiryInputFromForm(formData));
    let body: unknown;
    if (parsed.success) {
      body = toEnquiryInputV2(parsed.data);
    } else {
      const summary = summariseAiDataIssues(parsed.error);
      if (!summary.honeypotTripped && !summary.unknownKeys) {
        return {
          status: "invalid",
          fieldErrors: summary.fieldErrors,
          values,
          message: enquiryFormMessages.invalid,
        };
      }
      body = { website: String(formData.get("website") ?? "") || "automation" };
    }

    const requestHeaders = await headers();
    const service = getEnquiryService();
    const result = await service.receive({
      body,
      ip: clientIpFromHeaders(requestHeaders),
      correlationId: correlationIdFrom(requestHeaders),
    });
    if (result.kind === "accepted") scheduleDispatch({ service, after });
    state = toAiDataFormState(result, values);
  } catch {
    return toAiDataFormState({ kind: "unavailable" }, values);
  }
  // `redirect` throws, so it runs outside the try. With JavaScript the client navigates; without
  // it the POST answers with a 303 to the receipt.
  if (state.status === "accepted") redirect(routes.aiData.thankYou(state.reference));
  return state;
}
