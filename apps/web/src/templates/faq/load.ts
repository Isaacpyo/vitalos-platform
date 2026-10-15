import "server-only";
import { cache } from "react";
import { faqGroups } from "../../features/faq/faq-groups";
import type { FaqGroup } from "../../features/faq/faq-groups";
import { getContentSource } from "../../lib/cms/get-content-source";

export type { FaqGroup };

/** The FAQ groups for the page, read once per request. */
export const loadFaq = cache(async (): Promise<FaqGroup[]> => faqGroups(await getContentSource()));
