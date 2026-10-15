import "server-only";
import { renderDeps, unavailable } from "@/src/features/content/http/composition";
import { handleRenderRequest } from "@/src/features/content/http/handle-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The admin's signed preview render with the site's one Markdown renderer (ADR-035). */
export async function POST(request: Request): Promise<Response> {
  try {
    return await handleRenderRequest(request, renderDeps());
  } catch {
    return unavailable();
  }
}
