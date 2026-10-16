import "server-only";
import { enterPreviewDeps, unavailable } from "@/src/features/content/http/composition";
import { handleEnterPreview } from "@/src/features/content/http/handle-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Enters Draft Mode for an admin-issued preview token and redirects to the item (brief 3.6). */
export async function GET(request: Request): Promise<Response> {
  try {
    return await handleEnterPreview(request, enterPreviewDeps());
  } catch {
    return unavailable();
  }
}
