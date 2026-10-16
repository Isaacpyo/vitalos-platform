import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFixtureContentSource } from "@vitalos/cms/fixtures";
import { ContentNotFoundError, ContentUnavailableError } from "../client";
import { createReaders } from "../readers";
import { validateJsonLd } from "../../seo/json-ld-rules";

/**
 * Route-level behaviour of the Insights pages against a fake admin (the contract fixtures): closed
 * or unconfigured is 404, open renders, an old slug redirects, a failed read throws at runtime
 * (never cached) and reads as 404 during `next build`. The homepage loader is fail-soft.
 */

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../../../contracts/content-api/v1/fixtures/${name}.json`, import.meta.url),
      "utf8",
    ),
  );

const admin = vi.hoisted(() => ({
  configured: true,
  down: false,
  answers: {} as Record<string, unknown>,
  draft: false,
}));

vi.mock("../server", () => ({
  getContentReaders: () =>
    createReaders({
      client: admin.configured
        ? ({
            get: async (path: string, schema: { parse(v: unknown): unknown }) => {
              if (admin.down) throw new ContentUnavailableError("network");
              const answer = admin.answers[path.split("?")[0] ?? ""];
              if (answer === undefined) throw new ContentNotFoundError();
              return schema.parse(answer);
            },
            post: vi.fn(),
          } as never)
        : null,
      cache: (fn) => fn,
      ttlSeconds: 600,
    }),
}));
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: admin.draft }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("../../../lib/cms/get-content-source", () => ({
  getContentSource: async () => createFixtureContentSource("full"),
}));
vi.mock("../../seo/context", () => ({
  getSeoContext: () => ({ siteUrl: "https://www.example.test", indexable: true }),
}));

/** The page's JSON-LD blocks checked against the site's rules (features/seo/json-ld-rules.ts). */
function jsonLdIssues(markup: string, path: string): string[] {
  const origin = "https://www.example.test";
  const blocks = [...markup.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(
    (match) => JSON.parse(match[1] ?? "null") as unknown,
  );
  expect(blocks.length, "the page has structured data").toBeGreaterThan(0);
  const h1 = /<h1[^>]*>(.*?)<\/h1>/s
    .exec(markup)?.[1]
    ?.replace(/<[^>]+>/g, "")
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
  return validateJsonLd(blocks, { origin, canonical: `${origin}${path}`, h1 });
}

const pages = {
  index: () => import("../../../../app/(site)/insights/page"),
  article: () => import("../../../../app/(site)/insights/[slug]/page"),
  pageN: () => import("../../../../app/(site)/insights/page/[n]/page"),
  topic: () => import("../../../../app/(site)/insights/topics/[slug]/page"),
  author: () => import("../../../../app/(site)/insights/authors/[slug]/page"),
  format: () => import("../../../../app/(site)/insights/format/[format]/page"),
  feed: () => import("../../../../app/(site)/insights/feed.xml/route"),
};

beforeAll(async () => {
  await Promise.all(Object.values(pages).map((load) => load()));
}, 120_000);

const open = () => ({
  "/api/content/v1/site-state": fixture("site-state"),
  "/api/content/v1/insights/posts": fixture("post-page"),
  "/api/content/v1/insights/posts/example-post-1": fixture("post-detail"),
  "/api/content/v1/insights/posts/old-slug": fixture("redirect"),
  "/api/content/v1/insights/authors/example-author": fixture("author"),
  "/api/content/v1/insights/topics/example-topic": fixture("topic"),
  "/api/content/v1/insights/feed": fixture("feed"),
});

beforeEach(() => {
  admin.configured = true;
  admin.down = false;
  admin.draft = false;
  admin.answers = open();
  delete process.env["NEXT_PHASE"];
});

const params = <T,>(value: T) => ({ params: Promise.resolve(value) });
const is404 = { digest: expect.stringContaining("404") };
const html = (node: unknown) => renderToStaticMarkup(node as React.ReactElement);

describe("Insights pages when open", () => {
  it("renders the index with its hero, featured row and grid", async () => {
    const markup = html(await (await pages.index()).default());
    expect(jsonLdIssues(markup, "/insights")).toEqual([]);
    expect(markup).toContain('"@type":"CollectionPage"');
    expect(markup).toContain("Engineering clarity from complexity");
    expect(markup).toContain('href="/insights/example-post-1"');
    expect(markup).toContain('aria-label="Formats"');
    expect(markup).toContain("Talk to Vitalos");
  });

  it("titles and describes the index, with the feed advertised", async () => {
    const metadata = await (await pages.index()).generateMetadata();
    expect(metadata.title).toEqual({ absolute: "Vitalos Insights" });
    expect(metadata.alternates?.types).toEqual({ "application/rss+xml": "/insights/feed.xml" });
  });

  it("renders an article with its body, sources, editorial note, author and JSON-LD", async () => {
    const markup = html(await (await pages.article()).default(params({ slug: "example-post-1" })));
    expect(markup.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(markup).toContain("Example post 1 (fixture)</h1>");
    expect(markup).toContain('<h2 id="example-heading">Example heading</h2>');
    expect(markup).toContain(">Sources</h2>");
    expect(markup).toContain("Every substantive Vitalos Insight has a named human author");
    expect(markup).toContain("More from Example");
    expect(markup).toContain('"@type":"Article"');
    expect(markup).toContain('"@type":"BreadcrumbList"');
    expect(markup).toContain("PUBLISHED 12 OCT 2026 · UPDATED 14 OCT 2026 · 3 MIN READ");
    // One graph: WebPage, BreadcrumbList and Article, valid under the site's JSON-LD rules.
    expect(jsonLdIssues(markup, "/insights/example-post-1")).toEqual([]);
    expect(markup).toContain('"publisher":{"@id":"https://www.example.test/#organization"}');
  });

  it("gives an article '{SEO title} | Vitalos Insights', article Open Graph and the canonical", async () => {
    const metadata = await (
      await pages.article()
    ).generateMetadata(params({ slug: "example-post-1" }));
    expect(metadata.title).toEqual({ absolute: "Example post 1 (fixture) | Vitalos Insights" });
    expect(metadata.alternates?.canonical).toBe("https://www.example.test/insights/example-post-1");
    expect((metadata.openGraph as { type?: string }).type).toBe("article");
    expect(metadata.robots).toBeUndefined();
  });

  it("redirects an old slug (308) and 404s an unknown or malformed one", async () => {
    const page = await pages.article();
    await expect(page.default(params({ slug: "old-slug" }))).rejects.toMatchObject({
      digest: expect.stringContaining("/insights/example-post-1"),
    });
    await expect(page.default(params({ slug: "no-such-post" }))).rejects.toMatchObject(is404);
    await expect(page.default(params({ slug: "Bad Slug" }))).rejects.toMatchObject(is404);
  });

  it("renders topic and author pages", async () => {
    expect(html(await (await pages.topic()).default(params({ slug: "example-topic" })))).toContain(
      "Example topic",
    );
    const author = html(await (await pages.author()).default(params({ slug: "example-author" })));
    expect(author).toContain("Example Author");
    expect(author).toContain("Example biography (fixture).");
  });

  it("marks format views noindex, follow with the canonical on /insights", async () => {
    const metadata = await (
      await pages.format()
    ).generateMetadata(params({ format: "engineering-note" }));
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe("https://www.example.test/insights");
  });

  it("404s out-of-range pages and redirects page 1", async () => {
    const page = await pages.pageN();
    await expect(page.default(params({ n: "9" }))).rejects.toMatchObject(is404);
    await expect(page.default(params({ n: "1" }))).rejects.toMatchObject({
      digest: expect.stringContaining("/insights"),
    });
    await expect(page.default(params({ n: "x" }))).rejects.toMatchObject(is404);
  });

  it("serves the RSS feed", async () => {
    const response = await (await pages.feed()).GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
    expect(await response.text()).toContain("<title>Example post 1 (fixture)</title>");
  });
});

describe("Insights pages when closed or not configured", () => {
  it.each([
    ["closed", () => (admin.answers["/api/content/v1/site-state"] = fixture("site-state-closed"))],
    ["not configured", () => (admin.configured = false)],
  ])("every page is 404 and the feed is 404 when %s", async (_label, arrange) => {
    arrange();
    await expect((await pages.index()).default()).rejects.toMatchObject(is404);
    await expect(
      (await pages.article()).default(params({ slug: "example-post-1" })),
    ).rejects.toMatchObject(is404);
    await expect(
      (await pages.topic()).default(params({ slug: "example-topic" })),
    ).rejects.toMatchObject(is404);
    await expect(
      (await pages.author()).default(params({ slug: "example-author" })),
    ).rejects.toMatchObject(is404);
    expect((await (await pages.feed()).GET()).status).toBe(404);
  });

  it("still renders a closed section in Draft Mode (previews work while closed)", async () => {
    admin.answers["/api/content/v1/site-state"] = fixture("site-state-closed");
    admin.draft = true;
    const markup = html(await (await pages.article()).default(params({ slug: "example-post-1" })));
    expect(markup).toContain("Example post 1 (fixture)");
  });
});

describe("Insights pages when the admin is down", () => {
  it("throws at runtime (nothing is cached; ISR keeps the last good page)", async () => {
    admin.down = true;
    await expect((await pages.index()).default()).rejects.toBeInstanceOf(ContentUnavailableError);
  });

  it("reads as 404 during next build, so a deploy never fails on the admin", async () => {
    admin.down = true;
    process.env["NEXT_PHASE"] = "phase-production-build";
    await expect((await pages.index()).default()).rejects.toMatchObject(is404);
    await expect(
      (await pages.article()).default(params({ slug: "example-post-1" })),
    ).rejects.toMatchObject(is404);
  });
});

describe("homepage sections", () => {
  it("are fail-soft: a failed or missing home read leaves both sections out", async () => {
    const { loadHomeSections } = await import("../home");
    expect(
      await loadHomeSections({
        home: () => Promise.reject(new ContentUnavailableError("timeout")),
      }),
    ).toBeNull();
    expect(await loadHomeSections({ home: () => Promise.resolve({ kind: "missing" }) })).toBeNull();
    const home = { insights: null, careers: null };
    expect(
      await loadHomeSections({ home: () => Promise.resolve({ kind: "ok", data: home }) }),
    ).toEqual(home);
  });
});
