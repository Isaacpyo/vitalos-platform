import { legalSlugs } from "@vitalos/cms";
import type { LegalPageView, LegalSlug } from "@vitalos/cms";
import type { MetaItem } from "@vitalos/ui";
import { formatDate } from "../institutional/format";

/** Legal page view model to display data. Pure and framework-free. */

/** Structural labels. The legal text itself is entirely CMS content. */
export const legalLabels = { version: "Version", effective: "Effective date" } as const;

export const isLegalSlug = (value: string): value is LegalSlug =>
  (legalSlugs as readonly string[]).includes(value);

/** Version and effective date, as the page's labelled facts. Absent values are omitted. */
export function legalFacts(page: Pick<LegalPageView, "version" | "effectiveDate">): MetaItem[] {
  const facts: MetaItem[] = [];
  if (page.version.trim() !== "") facts.push({ label: legalLabels.version, value: page.version });
  const date = formatDate(page.effectiveDate);
  if (date) {
    facts.push({
      label: legalLabels.effective,
      value: <time dateTime={page.effectiveDate}>{date}</time>,
    });
  }
  return facts;
}
