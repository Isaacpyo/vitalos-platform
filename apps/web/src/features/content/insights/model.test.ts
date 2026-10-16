import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FeedResponse, PostDetail, PostPage } from "../schemas";
import type { PostPageData } from "../schemas";
import {
  articleDatesLine,
  articleJsonLd,
  buildIndexView,
  buildRss,
  formatTabs,
  gridHasCovers,
  indexHref,
  insightsTitle,
  linkedInShareHref,
  metaLine,
  pagination,
  safeCtaHref,
  showsToc,
  topicPageHref,
  xmlEscape,
} from "./model";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../../../contracts/content-api/v1/fixtures/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
const page = PostPage.parse(fixture("post-page"));
const detail = PostDetail.parse(fixture("post-detail"));
const cover = { url: "https://media.example.test/c.jpg", alt: "A", width: 1600, height: 900 };
const withId = (id: string, hasCover = false) => ({
  ...page.items[0]!,
  id: `00000000-0000-4000-8000-00000000${id}`,
  slug: `post-${id}`,
  cover: hasCover ? cover : null,
});

describe("lines and titles", () => {
  it("builds the mono meta and byline lines", () => {
    expect(metaLine(page.items[0]!)).toBe("EXAMPLE AUTHOR · 12 OCT 2026 · 3 MIN READ");
    expect(articleDatesLine(detail)).toBe(
      "PUBLISHED 12 OCT 2026 · UPDATED 14 OCT 2026 · 3 MIN READ",
    );
    expect(articleDatesLine({ ...detail, updatedAt: null })).toBe(
      "PUBLISHED 12 OCT 2026 · 3 MIN READ",
    );
  });

  it("titles pages '{SEO title} | Vitalos Insights'", () => {
    expect(insightsTitle("A post")).toBe("A post | Vitalos Insights");
    expect(insightsTitle("")).toBe("Vitalos Insights");
  });
});

describe("index view", () => {
  it("features the admin's featured post on page 1 only and never repeats it in the grid", () => {
    const view = buildIndexView(page);
    expect(view.featured?.id).toBe(page.featured?.id);
    expect(view.items.map((item) => item.id)).not.toContain(page.featured?.id);
    // A featured post repeated in items by mistake is still excluded.
    const repeated = buildIndexView({ ...page, items: [page.featured!, ...page.items] });
    expect(repeated.items.filter((item) => item.id === page.featured!.id)).toHaveLength(0);
  });

  it("falls back to the newest post when the admin features none, and features nothing when filtered or on later pages", () => {
    const noFeatured = buildIndexView({ ...page, featured: null });
    expect(noFeatured.featured?.id).toBe(page.items[0]!.id);
    expect(noFeatured.items).toHaveLength(page.items.length - 1);
    expect(buildIndexView(page, { format: "guide" }).featured).toBeNull();
    expect(buildIndexView({ ...page, page: 2, totalPages: 2, featured: null }).featured).toBeNull();
  });

  it("applies the even-covers rule", () => {
    expect(gridHasCovers([withId("0001", true), withId("0002", true)])).toBe(true);
    expect(gridHasCovers([withId("0001", true), withId("0002", false)])).toBe(false);
    expect(gridHasCovers([])).toBe(false);
  });

  it("states the empty state only when nothing is published", () => {
    const empty: PostPageData = { ...page, items: [], featured: null, total: 0, totalPages: 0 };
    expect(buildIndexView(empty).empty).toBe(true);
    expect(buildIndexView(page).empty).toBe(false);
  });
});

describe("pagination", () => {
  it("links previous and next, page 1 at /insights", () => {
    expect(pagination(1, 1, (n) => indexHref(n))).toBeNull();
    expect(pagination(1, 3, (n) => indexHref(n))).toEqual({
      page: 1,
      totalPages: 3,
      previous: null,
      next: "/insights/page/2",
    });
    expect(pagination(2, 3, (n) => indexHref(n))).toMatchObject({
      previous: "/insights",
      next: "/insights/page/3",
    });
    expect(pagination(3, 3, (n) => indexHref(n))?.next).toBeNull();
  });

  it("keeps the format filter in the query string and pages topics by path", () => {
    expect(indexHref(1, "engineering-note")).toBe("/insights?format=engineering-note");
    expect(indexHref(2, "engineering-note")).toBe("/insights?format=engineering-note&page=2");
    expect(topicPageHref("t", 1)).toBe("/insights/topics/t");
    expect(topicPageHref("t", 3)).toBe("/insights/topics/t/page/3");
  });
});

describe("format tabs", () => {
  it("lists All then each format, with the active one marked", () => {
    const tabs = formatTabs(page.formats, "engineering-note");
    expect(tabs[0]).toEqual({ label: "All", href: "/insights", current: false });
    expect(tabs.find((tab) => tab.current)?.href).toBe("/insights?format=engineering-note");
    expect(formatTabs(page.formats)[0]?.current).toBe(true);
  });
});

describe("links", () => {
  it("accepts only internal or vitalos.co.uk CTA links", () => {
    expect(safeCtaHref("/contact")).toBe("/contact");
    expect(safeCtaHref("https://www.vitalos.co.uk/contact")).toBe(
      "https://www.vitalos.co.uk/contact",
    );
    expect(safeCtaHref("https://vitalos.co.uk/")).toBe("https://vitalos.co.uk/");
    for (const bad of [
      "//evil.example",
      "https://evil.example",
      "http://www.vitalos.co.uk/",
      "javascript:alert(1)",
      "/\\evil.example",
      "https://user@vitalos.co.uk/",
    ]) {
      expect(safeCtaHref(bad), bad).toBeUndefined();
    }
  });

  it("builds a plain LinkedIn share link", () => {
    expect(linkedInShareHref("https://www.example.test/insights/a?b=1")).toBe(
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fwww.example.test%2Finsights%2Fa%3Fb%3D1",
    );
  });

  it("shows the contents list for three or more h2s", () => {
    expect(showsToc([{ depth: 2 }, { depth: 3 }, { depth: 2 }])).toBe(false);
    expect(showsToc([{ depth: 2 }, { depth: 2 }, { depth: 2 }])).toBe(true);
  });
});

describe("articleJsonLd", () => {
  const ctx = { siteUrl: "https://www.example.test" };
  const publisher = {
    "@type": "Organization",
    "@id": "https://www.example.test/#organization",
    name: "Vitalos",
  };

  it("describes a real article with its author pages and the publisher", () => {
    const node = articleJsonLd(detail, ctx, publisher)!;
    expect(node).toMatchObject({
      "@type": "Article",
      headline: detail.title,
      datePublished: "2026-10-12T09:00:00Z",
      dateModified: "2026-10-14T10:30:00Z",
      url: "https://www.example.test/insights/example-post-1",
      author: [
        {
          "@type": "Person",
          name: "Example Author",
          url: "https://www.example.test/insights/authors/example-author",
        },
      ],
      publisher,
      image: { "@type": "ImageObject", url: detail.cover!.url, width: 1600, height: 900 },
    });
  });

  it("never fabricates: no authors or no date means no Article; no cover means no image", () => {
    expect(articleJsonLd({ ...detail, authors: [] }, ctx, publisher)).toBeNull();
    expect(
      articleJsonLd(
        { ...detail, publishedAt: { ...detail.publishedAt, iso: "soon" } },
        ctx,
        publisher,
      ),
    ).toBeNull();
    const plain = articleJsonLd({ ...detail, cover: null, updatedAt: null }, ctx, publisher)!;
    expect(plain).not.toHaveProperty("image");
    expect(plain["dateModified"]).toBe(detail.lastModified);
    expect(JSON.stringify(plain)).not.toMatch(/logo|rating|address/);
  });
});

describe("RSS", () => {
  const feed = FeedResponse.parse(fixture("feed"));

  it("is RSS 2.0 with title, link, guid = id, pubDate, excerpt and author", () => {
    const xml = buildRss(feed, { siteUrl: "https://www.example.test", description: "Intro" });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<link>https://www.example.test/insights</link>");
    expect(xml).toContain(`<guid isPermaLink="false">${feed.items[0]!.id}</guid>`);
    expect(xml).toContain("<pubDate>Mon, 12 Oct 2026 09:00:00 GMT</pubDate>");
    expect(xml).toContain("<dc:creator>Example Author</dc:creator>");
    expect(xml).toContain(
      '<atom:link href="https://www.example.test/insights/feed.xml" rel="self" type="application/rss+xml"/>',
    );
  });

  it("escapes markup and drops characters XML cannot carry", () => {
    const hostile = {
      items: [
        {
          ...feed.items[0]!,
          title: 'Tom & "Jerry" <script>alert(1)</script>',
          excerpt: "a\u0001b ]]> 'c'",
        },
      ],
    };
    const xml = buildRss(hostile, { siteUrl: "https://www.example.test", description: "" });
    expect(xml).toContain(
      "<title>Tom &amp; &quot;Jerry&quot; &lt;script&gt;alert(1)&lt;/script&gt;</title>",
    );
    expect(xml).toContain("<description>ab ]]&gt; &apos;c&apos;</description>");
    expect(xml).not.toContain("<script");
    expect(xmlEscape("\u0000x￾")).toBe("x");
  });

  it("lists at most 20 items", () => {
    const many = { items: Array.from({ length: 25 }, () => feed.items[0]!) };
    const xml = buildRss(many, { siteUrl: "https://www.example.test", description: "" });
    expect(xml.match(/<item>/g)).toHaveLength(20);
  });
});
