import { describe, expect, it } from "vitest";
import { brandName } from "@vitalos/cms";
import { repoContent, structuralSeo } from "@vitalos/cms/repo";
import { seoSite } from "./site";

/**
 * Titles and descriptions of the published (repo) content against the limits in
 * docs/seo/KEYWORD-MAP.md: a title of at most 60 characters with the brand last, a description of
 * 120 to 155 characters, both unique. `pnpm seo:check` checks the rendered pages too; this gives
 * the same answer in a second, while the copy is being edited.
 *
 * Work, Insights and Careers are left out: their index pages are gated, and Insights and Careers
 * are written in the Super Admin (PR #46), which has its own counters.
 */
const { titleMax, descriptionMin, descriptionMax } = seoSite.limits;
const suffix = ` | ${brandName}`;

interface Page {
  id: string;
  title: string;
  description: string;
}

function pages(): Page[] {
  const out: Page[] = [];
  const add = (id: string, seo: { title?: string; description?: string }, fallback: string) =>
    out.push({
      id,
      title: `${seo.title ?? fallback}${suffix}`,
      description: seo.description ?? "",
    });
  out.push({
    id: "home",
    title: repoContent.home?.seo.title ?? "",
    description: repoContent.home?.seo.description ?? "",
  });
  for (const [key, page] of Object.entries(repoContent.routePages)) {
    if (!page || ["work", "insights", "careers"].includes(key)) continue;
    add(`route:${key}`, page.seo, page.heading);
  }
  const docs = repoContent.documents;
  for (const kind of [
    "practice",
    "solution",
    "offer",
    "industry",
    "labAsset",
    "legalPage",
  ] as const) {
    for (const doc of docs[kind]) add(`${kind}:${doc.slug}`, doc.seo, doc.title);
  }
  for (const item of docs.trustItem) add(`trust:${item.topic}`, item.seo, item.title);
  out.push({
    id: "faq",
    title: `Frequently asked questions${suffix}`,
    description: structuralSeo.faq.description ?? "",
  });
  return out;
}

describe("published titles and descriptions", () => {
  const all = pages();

  it("covers every published page type", () => {
    expect(all.length).toBeGreaterThanOrEqual(50);
  });

  it.each(all.map((page) => [page.id, page] as const))("%s is within the limits", (_, page) => {
    expect(page.title.length, page.title).toBeLessThanOrEqual(titleMax);
    expect(page.title.endsWith(suffix), page.title).toBe(true);
    expect(page.title.slice(0, -suffix.length), page.title).not.toContain(suffix);
    expect(page.description.length, page.description).toBeGreaterThanOrEqual(descriptionMin);
    expect(page.description.length, page.description).toBeLessThanOrEqual(descriptionMax);
  });

  it("has no duplicate titles or descriptions", () => {
    const dupes = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);
    expect(dupes(all.map((page) => page.title))).toEqual([]);
    expect(dupes(all.map((page) => page.description))).toEqual([]);
  });
});
