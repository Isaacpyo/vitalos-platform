import "server-only";
import { getEnv } from "@vitalos/config";
import { getEnquiryService } from "@/src/features/enquiries/get-enquiry-service";
import { handleRetentionRequest } from "@/src/features/enquiries/http/handle-retention-request";

async function handle(request: Request): Promise<Response> {
  try {
    return await handleRetentionRequest(request, {
      service: getEnquiryService(),
      secrets: [getEnv().enquiry.outboxDispatchSecret, getEnv().enquiry.cronSecret],
    });
  } catch {
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

// POST for manual runs; GET because schedulers such as Vercel Cron issue GET. Both require the
// bearer secret.
export const POST = handle;
export const GET = handle;
