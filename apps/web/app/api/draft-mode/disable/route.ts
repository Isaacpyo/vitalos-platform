import { draftMode } from "next/headers";
import { createDisableDraftModeHandler } from "../../../../src/lib/cms/draft-mode";

/**
 * Leaves Draft Mode. POST is the primary method (the draft indicator posts a form here, which
 * also works without JavaScript) and redirects with 303; GET is accepted for the Studio
 * Presentation tool and redirects with 307. The optional `redirect` parameter is honoured only
 * for same-site paths.
 */
const handler = createDisableDraftModeHandler({
  disable: async () => (await draftMode()).disable(),
});

export const POST = handler.POST;
export const GET = handler.GET;
