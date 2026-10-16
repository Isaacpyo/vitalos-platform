import "server-only";
import { lookupDeps, unavailable } from "@/src/features/content/http/composition";
import { handleLookupRequest } from "@/src/features/content/http/handle-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Internal: the proxy's verdict for an Insights or Careers path (ADR-040). */
export async function GET(request: Request): Promise<Response> {
  try {
    return await handleLookupRequest(request, lookupDeps());
  } catch {
    return unavailable();
  }
}
