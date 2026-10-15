import "server-only";
import { getEnv } from "@vitalos/config";
import { getRelay } from "@/src/features/relay/get-relay";
import { errorResponse } from "@/src/features/relay/http/common";
import { handleVisitorRequest } from "@/src/features/relay/http/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Visitor API (docs/relay, section 5.2). Answers 404 everywhere while Relay is off. */
async function handle(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  try {
    if (!getEnv().relay.enabled) return errorResponse("not_found", 404);
    const { path } = await ctx.params;
    return await handleVisitorRequest(request, path, getRelay());
  } catch {
    return errorResponse("unavailable", 503);
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
