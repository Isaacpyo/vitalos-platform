import "server-only";
import { getEnv } from "@vitalos/config";
import { getRelay } from "@/src/features/relay/get-relay";
import { errorResponse } from "@/src/features/relay/http/common";
import { handleCronRequest } from "@/src/features/relay/http/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Scheduled jobs called by pg_cron (ADR-038) with `Authorization: Bearer $CRON_SECRET`. */
async function handle(
  request: Request,
  ctx: { params: Promise<{ job: string }> },
): Promise<Response> {
  try {
    const env = getEnv();
    if (!env.relay.enabled) return errorResponse("not_found", 404);
    const { job } = await ctx.params;
    return await handleCronRequest(request, job, getRelay(), env.enquiry.cronSecret);
  } catch {
    return errorResponse("unavailable", 503);
  }
}

export const GET = handle;
export const POST = handle;
