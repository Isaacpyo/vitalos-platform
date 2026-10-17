import {
  absoluteUrl,
  brandName,
  descriptor,
  productPath,
  products,
  propositionLong,
  routes,
} from "@vitalos/cms";

/**
 * `/llms.txt` (llmstxt.org): a plain Markdown map of the site for AI assistants. Low priority:
 * Google does not use it (docs/seo/DECISIONS.md 24). Built from the sitemap, so it lists only
 * live, indexable pages, with each page's own title and one line from its visible summary.
 */
export interface LlmsLink {
  path: string;
  title: string;
  summary?: string | undefined;
}

export interface LlmsSection {
  heading: string;
  links: readonly LlmsLink[];
}

const oneLine = (value: string | undefined) => value?.replace(/\s+/g, " ").trim() ?? "";

export function buildLlmsTxt(input: {
  siteUrl: string;
  /** Paths listed in the sitemap; links outside it are dropped. */
  sitemapPaths: ReadonlySet<string>;
  sections: readonly LlmsSection[];
}): string {
  const lines = [
    `# ${brandName}`,
    "",
    `> ${propositionLong}`,
    "",
    `${brandName}: ${descriptor}. UK first, international by design. Five practices (Consulting, Engineering, AI & Data, Experience and Managed Services) share one delivery lifecycle, from strategy to production. Contact: ${absoluteUrl(input.siteUrl, routes.contact())}`,
    // The About sentence for each product, with its page (owner direction, 17 Oct 2026).
    ...products
      .filter((product) => input.sitemapPaths.has(productPath(product)))
      .map(
        (product) => `${product.description} ${absoluteUrl(input.siteUrl, productPath(product))}`,
      ),
  ];
  for (const section of input.sections) {
    const links = section.links.filter((link) => input.sitemapPaths.has(link.path));
    if (links.length === 0) continue;
    lines.push("", `## ${section.heading}`, "");
    for (const link of links) {
      const summary = oneLine(link.summary);
      lines.push(
        `- [${oneLine(link.title)}](${absoluteUrl(input.siteUrl, link.path)})${summary ? `: ${summary}` : ""}`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
