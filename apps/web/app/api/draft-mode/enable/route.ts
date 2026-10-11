import { getEnv } from "@vitalos/config";
import { createPreviewClient } from "../../../../src/lib/cms/client";
import { createEnableDraftModeHandler } from "../../../../src/lib/cms/draft-mode";

/**
 * Enables Draft Mode for a Studio editor. The `sanity-preview-secret` query parameter is
 * validated by next-sanity against the dataset; a bad or missing secret answers 401.
 */
export async function GET(request: Request): Promise<Response> {
  return createEnableDraftModeHandler({
    getConfig: () => {
      const { sanity } = getEnv();
      return {
        projectId: sanity.projectId,
        dataset: sanity.dataset,
        apiVersion: sanity.apiVersion,
        readToken: sanity.readToken,
      };
    },
    createClient: createPreviewClient,
  })(request);
}
