import type { KnowledgeEntry } from "@vitalos/relay-core/knowledge";
import { cmsEntries, listPublicPaths } from "./cms";
import { faqEntriesFromSnapshot } from "./faq";
import { repoEntries } from "./repo";

export { cmsEntries, listPublicPaths, richTextToMarkdown } from "./cms";
export {
  FAQ_DATABASE_ID,
  FAQ_DATABASE_URL,
  FAQ_DATA_SOURCE_ID,
  FAQ_HUB_PAGE_ID,
  faqEntriesFromSnapshot,
  faqSnapshot,
} from "./faq";
export type { FaqSnapshot } from "./faq";
export { parseFrontmatter, repoEntries } from "./repo";
export type { RepoEntriesOptions } from "./repo";

export interface AllEntriesOptions {
  /** Production with RELAY_FAQ_REQUIRE_HUB_ACTIVE: FAQ entries stay draft until the hub is Active. */
  requireHubActive: boolean;
  /** Skip the FAQ snapshot (when the live Notion sync owns the FAQ source). */
  includeFaqSnapshot?: boolean;
  /** Evals only: repo entries awaiting confirmation count as published (see repoEntries). */
  approvePending?: boolean;
}

/** Every bundled knowledge entry: repo seed, website content and the Master FAQ snapshot. */
export async function allBundledEntries(
  options: AllEntriesOptions,
): Promise<{ entries: KnowledgeEntry[]; publicPaths: Set<string> }> {
  const publicPaths = await listPublicPaths();
  const routeExists = (path: string) => publicPaths.has(path);
  const entries = [
    ...repoEntries(routeExists, { approvePending: options.approvePending ?? false }),
    ...(await cmsEntries()),
    ...(options.includeFaqSnapshot === false
      ? []
      : faqEntriesFromSnapshot({ routeExists, requireHubActive: options.requireHubActive })
          .entries),
  ];
  return { entries, publicPaths };
}
