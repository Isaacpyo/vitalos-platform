import "server-only";
import { tickDeps, unavailable } from "@/src/features/content/http/composition";
import { handleTickRequest } from "@/src/features/content/http/handle-tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Content scheduler trigger (ADR-038): wakes the admin only when something is due. */
export async function GET(request: Request): Promise<Response> {
  try {
    return await handleTickRequest(request, tickDeps());
  } catch {
    return unavailable();
  }
}
