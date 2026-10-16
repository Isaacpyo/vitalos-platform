import { navLabels, routes } from "@vitalos/cms";
import { loadChromeContent } from "../../src/components/site-chrome/load";
import { getSeoContext } from "../../src/features/seo/context";
import { buildLlmsTxt } from "../../src/features/seo/llms-txt";
import { loadSitemapSections } from "../../src/features/seo/sitemap-sections";
import { loadRoutePage } from "../../src/templates/commercial/load";
import { structuralLabels } from "../../src/lib/view-mapping/labels";

/**
 * `/llms.txt` (docs/seo/DECISIONS.md 24): the site's key pages for AI assistants, from the sitemap
 * and each page's own title and summary. Static per deploy, like the sitemap.
 */
export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const { siteUrl } = getSeoContext();
  const [sections, chrome, about, howWeWork, trust, contact] = await Promise.all([
    loadSitemapSections(),
    loadChromeContent(),
    loadRoutePage("about"),
    loadRoutePage("how-we-work"),
    loadRoutePage("trust"),
    loadRoutePage("contact"),
  ]);
  const sitemapPaths = new Set(
    Object.values(sections)
      .flat()
      .map((entry) => new URL(entry.url).pathname),
  );
  const body = buildLlmsTxt({
    siteUrl,
    sitemapPaths,
    sections: [
      {
        heading: structuralLabels.practices,
        links: chrome.practices.map((d) => ({ ...d, path: routes.practice(d.slug) })),
      },
      {
        heading: structuralLabels.solutions,
        links: chrome.solutions.map((d) => ({ ...d, path: routes.solution(d.slug) })),
      },
      {
        heading: structuralLabels.offers,
        links: chrome.offers.map((d) => ({ ...d, path: routes.offer(d.slug) })),
      },
      {
        heading: navLabels.industries,
        links: chrome.industries.map((d) => ({ ...d, path: routes.industry(d.slug) })),
      },
      {
        heading: navLabels.labs,
        links: chrome.labAssets.map((d) => ({ ...d, path: routes.labAsset(d.labType, d.slug) })),
      },
      {
        heading: "Company",
        links: [
          { path: routes.about(), title: navLabels.about, summary: about?.intro },
          { path: routes.howWeWork(), title: navLabels.howWeWork, summary: howWeWork?.intro },
          { path: routes.trust(), title: navLabels.trustCentre, summary: trust?.intro },
          { path: routes.faq(), title: structuralLabels.faq },
          { path: routes.contact(), title: navLabels.contact, summary: contact?.intro },
        ],
      },
    ],
  });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
