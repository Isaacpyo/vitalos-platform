import "server-only";
import { getEnv } from "@vitalos/config";
import { after } from "next/server";
import { getEnquiryService } from "@/src/features/enquiries/get-enquiry-service";
import { handleEnquiryRequest } from "@/src/features/enquiries/http/handle-enquiry-request";

/** Thin adapter: all behaviour lives in `src/features/enquiries`. */
export async function POST(request: Request): Promise<Response> {
  try {
    return await handleEnquiryRequest(request, {
      service: getEnquiryService(),
      siteOrigin: getEnv().siteUrl,
      after,
    });
  } catch {
    // Invalid configuration or an unexpected failure: honest 503, nothing about why.
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
