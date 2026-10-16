import { expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { sitemapLocs } from "./crawl";
import { templateFor } from "./routes";

export interface SitemapCheck {
  /** Same-origin paths listed in the sitemap. */
  paths: string[];
  xml: string;
}

/** Fetches one sitemap document and asserts it is well-formed XML of the given root element. */
async function fetchSitemapDocument(
  request: APIRequestContext,
  path: string,
  root: "urlset" | "sitemapindex",
): Promise<string> {
  const response = await request.get(path, { maxRedirects: 0 });
  expect(response.status(), `${path} answers 200`).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/xml/);
  const xml = await response.text();
  expect(xml).toContain(`<${root} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`);
  expect(xml.trimEnd().endsWith(`</${root}>`)).toBe(true);
  return xml;
}

/**
 * Fetches the /sitemap.xml index and every child it lists (docs/seo/DECISIONS.md 12), and asserts
 * what must hold for ANY fixture set: a well-formed index whose children are same-origin
 * `/sitemaps/{section}.xml` files; well-formed urlsets; absolute unique same-origin URLs without
 * query or fragment; nothing from the API or draft surfaces; every URL belongs to a known template
 * family; and every listed URL answers 200 (a sitemap never lists a 404, a redirect or a gated
 * page).
 */
export async function fetchAndCheckSitemap(
  request: APIRequestContext,
  origin: string,
): Promise<SitemapCheck> {
  const index = await fetchSitemapDocument(request, "/sitemap.xml", "sitemapindex");
  const children = sitemapLocs(index);
  expect(children.length, "the index lists at least the pages sitemap").toBeGreaterThan(0);
  const parts: string[] = [];
  for (const child of children) {
    const url = new URL(child);
    expect(url.origin, `${child} uses the canonical origin`).toBe(origin);
    expect(url.pathname).toMatch(/^\/sitemaps\/(pages|insights|careers)\.xml$/);
    parts.push(await fetchSitemapDocument(request, url.pathname, "urlset"));
  }
  const xml = parts.join("\n");

  const locs = sitemapLocs(xml);
  expect(locs.length, "sitemap lists at least the home page").toBeGreaterThan(0);
  expect(new Set(locs).size, "sitemap URLs are unique").toBe(locs.length);

  const paths: string[] = [];
  for (const loc of locs) {
    const url = new URL(loc);
    expect(url.origin, `${loc} uses the canonical origin`).toBe(origin);
    expect(url.search + url.hash, `${loc} has no query or fragment`).toBe("");
    expect(url.pathname, `${loc} is not an API or draft route`).not.toMatch(/^\/(api|_next)\b/);
    expect(
      templateFor(url.pathname),
      `${url.pathname} matches no template in tests/support/routes.ts`,
    ).toBeDefined();
    paths.push(url.pathname);
  }

  const statuses = await Promise.all(
    paths.map(
      async (path) => [path, (await request.get(path, { maxRedirects: 0 })).status()] as const,
    ),
  );
  expect(
    statuses.filter(([, status]) => status !== 200),
    "every sitemap URL answers 200",
  ).toEqual([]);
  return { paths, xml };
}
