import { describe, expect, it } from "vitest";
import { closedGates, evaluateGates } from "@vitalos/cms";
import type { ContentSource, RoutePageKey, SitemapEntry } from "@vitalos/cms";
import { EmptyContentSource } from "@vitalos/cms";
import { composeMetadata } from "./metadata";
import { robotsPolicy } from "./robots-policy";
import { buildSitemap, loadSitemap } from "./sitemap";

const production = { siteUrl: "https://www.example.invalid", indexable: true };
const preview = { siteUrl: "https://preview.example.invalid", indexable: false };

describe("composeMetadata", () => {
  it("builds canonical, Open Graph and Twitter metadata from the document SEO", () => {
    const metadata = composeMetadata(
      {
        path: "/what-we-do/consulting?utm_source=x#top",
        title: "Consulting",
        seo: { title: "Vitalos Consulting", description: "Advisory work." },
      },
      production,
    );
    expect(metadata.title).toBe("Vitalos Consulting");
    expect(metadata.description).toBe("Advisory work.");
    expect(metadata.alternates?.canonical).toBe(
      "https://www.example.invalid/what-we-do/consulting",
    );
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      url: "https://www.example.invalid/what-we-do/consulting",
      siteName: "Vitalos",
      locale: "en_GB",
      title: "Vitalos Consulting | Vitalos",
      description: "Advisory work.",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary",
      title: "Vitalos Consulting | Vitalos",
    });
    expect(metadata.robots).toBeUndefined();
  });

  it("falls back from document SEO to document fields to site defaults, then leaves unset", () => {
    const withDefaults = composeMetadata(
      { path: "/about", defaultSeo: { title: "Default", description: "Default description" } },
      production,
    );
    expect(withDefaults.title).toBe("Default");
    expect(withDefaults.description).toBe("Default description");

    const bare = composeMetadata({ path: "/about" }, production);
    expect(bare.title).toBeUndefined();
    expect(bare.description).toBeUndefined();
    expect(bare.openGraph).toMatchObject({ title: "Vitalos" });
  });

  it("never duplicates the brand name in the title or social titles", () => {
    const metadata = composeMetadata({ path: "/about", title: "Vitalos" }, production);
    expect(metadata.title).toEqual({ absolute: "Vitalos" });
    expect(metadata.openGraph).toMatchObject({ title: "Vitalos" });
    expect(metadata.twitter).toMatchObject({ title: "Vitalos" });
  });

  it("omits canonical and og:url for paths that would leave the site", () => {
    for (const path of ["//evil.invalid", "https://evil.invalid/x", "/\\evil", "about"]) {
      const metadata = composeMetadata({ path, title: "X" }, production);
      expect(metadata.alternates).toBeUndefined();
      expect(metadata.openGraph).not.toHaveProperty("url");
    }
  });

  it("uses an absolute title for the home page", () => {
    const metadata = composeMetadata(
      { path: "/", title: "Vitalos", absoluteTitle: true },
      production,
    );
    expect(metadata.title).toEqual({ absolute: "Vitalos" });
  });

  it("includes an Open Graph image only when approved and renderable", () => {
    const ogImage = {
      url: "https://cdn.sanity.io/images/p/d/og.png",
      alt: "Cover",
      width: 1200,
      height: 630,
    };
    const good = composeMetadata({ path: "/", seo: { ogImage } }, production);
    expect(good.openGraph?.images).toEqual([
      { url: ogImage.url, width: 1200, height: 630, alt: "Cover" },
    ]);
    expect(good.twitter).toMatchObject({ card: "summary_large_image" });

    for (const bad of [
      { ...ogImage, url: "https://evil.invalid/og.png" },
      { ...ogImage, alt: "" },
      { ...ogImage, decorative: true },
    ]) {
      const metadata = composeMetadata({ path: "/", seo: { ogImage: bad } }, production);
      expect(metadata.openGraph?.images).toBeUndefined();
      expect(metadata.twitter).toMatchObject({ card: "summary" });
    }
  });

  it("marks pages noindex when the document says so or a gate forces it", () => {
    expect(composeMetadata({ path: "/x", seo: { noindex: true } }, production).robots).toEqual({
      index: false,
      follow: false,
    });
    expect(composeMetadata({ path: "/x", noindex: true }, production).robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("marks every page noindex outside production", () => {
    expect(composeMetadata({ path: "/x", title: "X" }, preview).robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("adds article details only for articles and only when given", () => {
    const article = composeMetadata(
      {
        path: "/insights/a",
        type: "article",
        article: { publishedTime: "2026-01-02T00:00:00Z", authors: ["A. Person"] },
      },
      production,
    );
    expect(article.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-01-02T00:00:00Z",
      authors: ["A. Person"],
    });
    const website = composeMetadata(
      { path: "/", article: { publishedTime: "2026-01-02T00:00:00Z" } },
      production,
    );
    expect(website.openGraph).not.toHaveProperty("publishedTime");
  });
});

describe("robotsPolicy", () => {
  it("disallows everything outside production", () => {
    const robots = robotsPolicy({ indexable: false, siteUrl: preview.siteUrl });
    expect(robots.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
    expect(robots.sitemap).toBeUndefined();
  });

  it("allows crawling in production, keeps /api/ out and points at the sitemap", () => {
    const robots = robotsPolicy({ indexable: true, siteUrl: production.siteUrl });
    expect(robots.rules).toEqual([{ userAgent: "*", allow: "/", disallow: "/api/" }]);
    expect(robots.sitemap).toBe("https://www.example.invalid/sitemap.xml");
  });
});

describe("buildSitemap", () => {
  const siteUrl = production.siteUrl;
  const openGates = evaluateGates({ work: 2, insights: 6, labs: 1, industries: 1, careers: 1 });
  const all = new Set<RoutePageKey>([
    "what-we-do",
    "solutions",
    "offers",
    "industries",
    "work",
    "insights",
    "labs",
    "about",
    "leadership",
    "how-we-work",
    "trust",
    "careers",
    "contact",
  ]);
  const entries: SitemapEntry[] = [
    { path: "/what-we-do/consulting", kind: "practice", lastModified: "2026-02-01T00:00:00Z" },
    { path: "/work/example", kind: "caseStudy" },
    { path: "/insights/example", kind: "insight" },
    { path: "/labs/research/example", kind: "labAsset" },
    { path: "/labs/research", kind: "route", lastModified: "2026-03-01" },
    { path: "/industries/example", kind: "industry" },
    { path: "/careers/example", kind: "job" },
    { path: "/people/example", kind: "person" },
    { path: "/trust/security", kind: "trustItem" },
    { path: "/legal/privacy", kind: "legalPage" },
  ];
  const urls = (sitemap: ReturnType<typeof buildSitemap>) => sitemap.map((entry) => entry.url);

  it("lists everything when all gates are open", () => {
    const sitemap = buildSitemap({
      siteUrl,
      gates: openGates,
      hasHome: true,
      routePages: all,
      entries,
    });
    expect(urls(sitemap)).toContain("https://www.example.invalid/");
    expect(urls(sitemap)).toContain("https://www.example.invalid/work");
    expect(urls(sitemap)).toContain("https://www.example.invalid/work/example");
    expect(urls(sitemap)).toContain("https://www.example.invalid/about/leadership");
    expect(urls(sitemap)).toContain("https://www.example.invalid/legal/privacy");
    expect(urls(sitemap)).toContain("https://www.example.invalid/labs/research");
    expect(sitemap.find((e) => e.url.endsWith("/labs/research"))?.lastModified).toEqual(
      new Date("2026-03-01T00:00:00Z"),
    );
    expect(sitemap.find((e) => e.url.endsWith("/what-we-do/consulting"))?.lastModified).toEqual(
      new Date("2026-02-01T00:00:00Z"),
    );
  });

  it("leaves out gated sections and their documents while gates are closed", () => {
    const sitemap = buildSitemap({
      siteUrl,
      gates: closedGates,
      hasHome: true,
      routePages: all,
      entries,
    });
    const list = urls(sitemap);
    for (const gated of ["/work", "/insights", "/labs", "/industries", "/careers"]) {
      expect(list.some((url) => url.includes(`${gated}`))).toBe(false);
    }
    expect(list).toContain("https://www.example.invalid/what-we-do/consulting");
    expect(list).toContain("https://www.example.invalid/people/example");
    expect(list).toContain("https://www.example.invalid/trust/security");
  });

  it("opens each gate independently", () => {
    const gates = evaluateGates({ work: 2 });
    const list = urls(buildSitemap({ siteUrl, gates, hasHome: true, routePages: all, entries }));
    expect(list).toContain("https://www.example.invalid/work");
    expect(list).toContain("https://www.example.invalid/work/example");
    expect(list.some((url) => url.includes("/insights"))).toBe(false);
    expect(list.some((url) => url.includes("/labs"))).toBe(false);
  });

  it("lists /labs/<type> only while the Labs gate is open", () => {
    const labsOnly = evaluateGates({ labs: 1 });
    const open = urls(
      buildSitemap({ siteUrl, gates: labsOnly, hasHome: true, routePages: all, entries }),
    );
    expect(open).toContain("https://www.example.invalid/labs/research");
    const closed = urls(
      buildSitemap({ siteUrl, gates: closedGates, hasHome: true, routePages: all, entries }),
    );
    expect(closed.some((url) => url.includes("/labs"))).toBe(false);
  });

  it("does not list pages that have no document (empty content yields an empty sitemap)", () => {
    expect(
      buildSitemap({
        siteUrl,
        gates: closedGates,
        hasHome: false,
        routePages: new Set(),
        entries: [],
      }),
    ).toEqual([]);
    const onlyHome = buildSitemap({
      siteUrl,
      gates: closedGates,
      hasHome: true,
      routePages: new Set(),
      entries: [],
    });
    expect(urls(onlyHome)).toEqual(["https://www.example.invalid/"]);
  });

  it("drops unclean, unknown and duplicate paths", () => {
    const messy: SitemapEntry[] = [
      { path: "/what-we-do/a?x=1", kind: "practice" },
      { path: "/what-we-do/a#frag", kind: "practice" },
      { path: "//evil.invalid", kind: "route" },
      { path: "https://evil.invalid/", kind: "route" },
      { path: "/not-in-the-manifest", kind: "route" },
      { path: "/what-we-do/b", kind: "practice" },
      { path: "/what-we-do/b", kind: "practice" },
    ];
    const list = urls(
      buildSitemap({
        siteUrl,
        gates: closedGates,
        hasHome: false,
        routePages: new Set(),
        entries: messy,
      }),
    );
    expect(list).toEqual(["https://www.example.invalid/what-we-do/b"]);
  });
});

describe("loadSitemap", () => {
  it("is empty for the empty content source", async () => {
    expect(await loadSitemap(new EmptyContentSource(), production.siteUrl)).toEqual([]);
  });

  it("reads gates, home, route pages and entries from the source", async () => {
    const base = new EmptyContentSource();
    const source: ContentSource = Object.assign(Object.create(base) as ContentSource, {
      getHomePage: () => Promise.resolve({} as never),
      getRoutePage: (key: RoutePageKey) => Promise.resolve(key === "about" ? ({} as never) : null),
      getSitemapEntries: () =>
        Promise.resolve([{ path: "/what-we-do/a", kind: "practice" } as const]),
    });
    const urls = (await loadSitemap(source, production.siteUrl)).map((entry) => entry.url);
    expect(urls).toEqual([
      "https://www.example.invalid/",
      "https://www.example.invalid/about",
      "https://www.example.invalid/what-we-do/a",
    ]);
  });
});
