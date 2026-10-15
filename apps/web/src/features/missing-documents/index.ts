import "server-only";
import { getContentSource } from "../../lib/cms/get-content-source";
import { createMissingDocumentChecker } from "./checker";
import { legacyContentFamilies } from "./detail-routes";

/**
 * Path that no route matches. The proxy rewrites a certain 404 onto it, so Next.js answers with
 * its server-rendered not-found page (root `not-found.tsx`, inside the site shell) and a real 404.
 */
export const UNMATCHED_PATH = "/__vitalos-missing-document__";

const checker = createMissingDocumentChecker({
  listParams: async (kind) => (await getContentSource()).listParams(kind),
});

/** True when the published content has no document behind this detail URL (fails open). */
export const isMissingDetailPath = (pathname: string): Promise<boolean> =>
  checker.isMissing(pathname);

const legacyContentChecker = createMissingDocumentChecker({
  listParams: async (kind) => (await getContentSource()).listParams(kind),
  routes: legacyContentFamilies,
});

/**
 * TRANSITIONAL (see `legacyContentFamilies`): a role URL with no
 * `@vitalos/cms` document behind it, used by the proxy only while the content API is not
 * configured. Fails open.
 */
export const isMissingLegacyContentPath = (pathname: string): Promise<boolean> =>
  legacyContentChecker.isMissing(pathname);
