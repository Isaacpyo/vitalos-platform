import { routes, solutionNames } from "@vitalos/cms";
import type { ContentSource, SolutionView } from "@vitalos/cms";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";

export interface FaqGroup {
  /** The solution the questions belong to. */
  title: string;
  href: string;
  entries: readonly { question: string; answer: string }[];
}

/**
 * The FAQ: the common questions each published solution already answers on its own page, grouped
 * by solution in the locked order. Nothing is written for the FAQ page; a solution without
 * questions is left out, and so is invented placeholder content (ADR-025). The FAQ page and the
 * sitemap both read it, so the page is listed exactly when it has questions.
 */
export async function faqGroups(source: ContentSource): Promise<FaqGroup[]> {
  const summaries = orderByLockedNames(await source.listSummaries("solution"), solutionNames);
  const views = await Promise.all(
    summaries.map((summary) => source.getDocument("solution", summary.slug)),
  );
  return views.flatMap((view: SolutionView | null) =>
    view && view.placeholder !== true && view.faq.length > 0
      ? [{ title: view.title, href: routes.solution(view.slug), entries: view.faq }]
      : [],
  );
}
