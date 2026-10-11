import { revalidateTag } from "next/cache";
import { getEnv } from "@vitalos/config";
import { createLogger } from "@vitalos/observability";
import { resetMissingDocumentIndex } from "../../../src/features/missing-documents";
import { createRevalidateHandler } from "../../../src/lib/cms/revalidate-handler";

/**
 * Sanity webhook receiver (ADR-018). Configure the webhook in Sanity (a later, owner-approved
 * step) as POST to /api/revalidate with the shared secret in `SANITY_REVALIDATE_SECRET` and the
 * projection `{ _type, "slug": slug.current }`. Unsigned or stale requests are refused.
 */
export async function POST(request: Request): Promise<Response> {
  const env = getEnv();
  const logger = createLogger({ service: "vitalos-web", env: env.deployEnv });
  return createRevalidateHandler({
    secret: env.sanity.revalidateSecret,
    revalidateTag: (tag, profile) => {
      revalidateTag(tag, profile);
      // The proxy caches the published document lists (ADR-027); a content change drops them.
      resetMissingDocumentIndex();
    },
    log: (event, attributes) => logger.info(event, attributes),
  })(request);
}
