import "server-only";
import { getEnv } from "@vitalos/config";
import { getRelay } from "@/src/features/relay/get-relay";
import { handleAdminRequest } from "@/src/features/relay/http/admin";
import { errorResponse } from "@/src/features/relay/http/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Signed admin API for the Super Admin (docs/relay/API.md). 404 while Relay is off. */
async function handle(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  try {
    const env = getEnv();
    if (!env.relay.enabled) return errorResponse("not_found", 404);
    const { path } = await ctx.params;
    return await handleAdminRequest(request, path, getRelay(), env.relay.adminApiSecrets);
  } catch {
    return errorResponse("unavailable", 503);
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
