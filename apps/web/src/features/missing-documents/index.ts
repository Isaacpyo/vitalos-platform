import "server-only";
import { getPublishedContentSource } from "../../lib/cms/get-content-source";
import { createMissingDocumentChecker } from "./checker";

/**
 * Path that no route matches. The proxy rewrites a certain 404 onto it, so Next.js answers with
 * its server-rendered not-found page (root `not-found.tsx`, inside the site shell) and a real 404.
 */
export const UNMATCHED_PATH = "/__vitalos-missing-document__";

const checker = createMissingDocumentChecker({
  listParams: async (kind) => (await getPublishedContentSource()).listParams(kind),
});

/** True when the published content has no document behind this detail URL (fails open). */
export const isMissingDetailPath = (pathname: string): Promise<boolean> =>
  checker.isMissing(pathname);

/** Drop cached lists, for example after a content revalidation. */
export const resetMissingDocumentIndex = (): void => checker.reset();
