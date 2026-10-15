import "server-only";
import { exitPreviewDeps, unavailable } from "@/src/features/content/http/composition";
import { handleExitPreview } from "@/src/features/content/http/handle-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Leaves Draft Mode and returns to a relative path. */
export async function GET(request: Request): Promise<Response> {
  try {
    return await handleExitPreview(request, exitPreviewDeps());
  } catch {
    return unavailable();
  }
}
