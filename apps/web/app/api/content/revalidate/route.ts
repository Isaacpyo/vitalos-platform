import "server-only";
import { revalidateDeps, unavailable } from "@/src/features/content/http/composition";
import { handleRevalidateRequest } from "@/src/features/content/http/handle-revalidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signed sync event from the Super Admin (ADR-040). All behaviour lives in the feature. */
export async function POST(request: Request): Promise<Response> {
  try {
    return await handleRevalidateRequest(request, revalidateDeps());
  } catch {
    return unavailable();
  }
}
