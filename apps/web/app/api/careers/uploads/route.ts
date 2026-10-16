import "server-only";
import { handleUploadRequest } from "@/src/features/content/careers/http";
import { careersDeps, unavailable } from "@/src/features/content/http/composition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Issues a CV upload ticket for the application form (brief A9). All behaviour lives in the feature. */
export async function POST(request: Request): Promise<Response> {
  try {
    return await handleUploadRequest(request, careersDeps());
  } catch {
    return unavailable();
  }
}
