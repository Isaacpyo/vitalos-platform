import { routes, solutionNames } from "@vitalos/cms";
import type { ContentSource, SolutionView } from "@vitalos/cms";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";

export interface FaqEntry {
  question: string;
  answer: string;
  /** Stable anchor, `{group id}--{question slug}` (finding B10): the same question, the same link. */
  id: string;
}

export interface FaqGroup {
  /** The solution the questions belong to. */
  title: string;
  href: string;
  /** Stable anchor of the group: the solution slug. */
  id: string;
  entries: readonly FaqEntry[];
}

/** A URL fragment from text: lower case, letters and digits joined by single hyphens, 80 at most. */
export function anchorSlug(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "question"
  );
}

/** Entry anchors for one group, unique within the page (a repeated question gets `-2`, `-3`). */
function withAnchors(
  groupId: string,
  entries: readonly { question: string; answer: string }[],
): FaqEntry[] {
  const seen = new Map<string, number>();
  return entries.map((entry) => {
    const base = `${groupId}--${anchorSlug(entry.question)}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { ...entry, id: count === 1 ? base : `${base}-${count}` };
  });
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
      ? [
          {
            title: view.title,
            href: routes.solution(view.slug),
            id: view.slug,
            entries: withAnchors(view.slug, view.faq),
          },
        ]
      : [],
  );
}
