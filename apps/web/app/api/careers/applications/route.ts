import "server-only";
import { handleApplicationRequest } from "@/src/features/content/careers/http";
import { careersDeps, unavailable } from "@/src/features/content/http/composition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sends a completed application to the Super Admin (brief A9). All behaviour lives in the feature. */
export async function POST(request: Request): Promise<Response> {
  try {
    return await handleApplicationRequest(request, careersDeps());
  } catch {
    return unavailable();
  }
}
