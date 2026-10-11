import { expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { sitemapLocs } from "./crawl";
import { templateFor } from "./routes";

export interface SitemapCheck {
  /** Same-origin paths listed in the sitemap. */
  paths: string[];
  xml: string;
}

/**
 * Fetches /sitemap.xml and asserts what must hold for ANY fixture set: well-formed urlset, absolute
 * unique same-origin URLs without query or fragment, nothing from the API or draft surfaces, every
 * URL belongs to a known template family, and every listed URL answers 200 (a sitemap never lists
 * a 404, a redirect or a gated page).
 */
export async function fetchAndCheckSitemap(
  request: APIRequestContext,
  origin: string,
): Promise<SitemapCheck> {
  const response = await request.get("/sitemap.xml", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/xml/);
  const xml = await response.text();
  expect(xml).toMatch(/<urlset[^>]+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);

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
