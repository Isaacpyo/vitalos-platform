import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { stubMedia } from "./support/media";

test.beforeEach(async ({ page }) => stubMedia(page));

test.describe("Insights index", () => {
  test("hero, format tabs, featured card, grid and closing card", async ({ page }) => {
    const response = await page.goto("/insights");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Engineering clarity from complexity.",
    );
    await expect(page.getByRole("navigation", { name: "Formats" })).toBeVisible();
    await expect(page.locator('main a[href="/insights/example-post-1"]').first()).toBeVisible();
    await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveCount(1);
    // More than one post: the topic links and a visible feed link sit beside the format tabs.
    await expect(page.locator("main").getByRole("link", { name: "RSS feed" })).toHaveAttribute(
      "href",
      "/insights/feed.xml",
    );
    await expect(page.locator("main summary", { hasText: "Topics" })).toBeVisible();
    // The site's closing card (pages redesign): the locked closing heading and Talk to Vitalos.
    await expect(
      page.locator("main").getByRole("heading", { name: "Have a problem worth solving?" }),
    ).toBeVisible();
    await expect(
      page.locator("main").getByRole("link", { name: "Talk to Vitalos" }),
    ).toHaveAttribute("href", "/contact");
  });

  test("format views are noindex, follow with the canonical on /insights", async ({ page }) => {
    await page.goto("/insights?format=engineering-note");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/insights$/);
    await expect(
      page.getByRole("navigation", { name: "Formats" }).locator('[aria-current="page"]'),
    ).toHaveText("Engineering notes");
  });
});

test.describe("Insights article", () => {
  test("renders the article from the admin", async ({ page }) => {
    const response = await page.goto("/insights/example-post-1");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Example post 1 (fixture)");
    // The site's dark hero: the format as the eyebrow, no visible breadcrumb trail (owner
    // decision 2026-10-12); the BreadcrumbList stays in the structured data.
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);
    await expect(
      page
        .getByRole("article", { name: "Example post 1 (fixture)" })
        .getByText("Engineering note")
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText("PUBLISHED 12 OCT 2026 · UPDATED 14 OCT 2026 · 3 MIN READ"),
    ).toBeVisible();
    await expect(page.locator("#example-heading")).toHaveText("Example heading");
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
    await expect(page.getByRole("link", { name: "More from Example" })).toBeVisible();
    // The author's name in the author block links to their page too.
    await expect(
      page.getByRole("region", { name: "Author" }).getByRole("link", { name: "Example Author" }),
    ).toHaveAttribute("href", "/insights/authors/example-author");
    // The closing card pre-selects the enquiry intent from the post's practice (Engineering).
    await expect(
      page.locator("main").getByRole("link", { name: "Talk to Vitalos" }).last(),
    ).toHaveAttribute("href", "/contact?intent=engineering");
    // Related posts by shared topic (from the admin), at most three.
    await expect(page.getByRole("heading", { name: "Related insights" })).toBeVisible();
    // No excerpt under the title (owner decision, 16 Oct 2026); related cards may still show theirs.
    await expect(
      page.locator("h1 ~ p", { hasText: "Example excerpt for a fixture post." }),
    ).toHaveCount(0);
    // The author block has the avatar (initials when there is no photo) beside the name.
    await expect(
      page.getByRole("region", { name: "Author" }).getByText("EA", { exact: true }),
    ).toBeVisible();
    // One Share button opens a modal of icon links (plain share URLs); Escape closes it and
    // returns focus to the button (owner direction, 17 Oct 2026).
    const share = page.getByRole("button", { name: "Share" });
    await share.click();
    const menu = page.getByRole("dialog", { name: "Share this article" });
    await expect(menu).toBeVisible();
    for (const network of ["LinkedIn", "X", "Facebook", "WhatsApp", "Reddit", "Bluesky"]) {
      await expect(
        menu.getByRole("link", { name: new RegExp(`^Share on ${network}\\b`) }),
      ).toBeVisible();
    }
    await expect(menu.getByRole("link", { name: "Share by email" })).toHaveAttribute(
      "href",
      /^mailto:/,
    );
    const linkedin = menu.getByRole("link", { name: /^Share on LinkedIn/ });
    await expect(linkedin).toHaveAttribute(
      "href",
      /^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=/,
    );
    await expect(linkedin).toHaveAttribute("rel", "noopener noreferrer");
    // Icons only: no visible network names.
    await expect(linkedin).toHaveText("");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(share).toBeFocused();
    await expect(share).toBeFocused();
    const jsonLd = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).join("");
    expect(jsonLd).toContain('"@type":"Article"');
    expect(jsonLd).toContain('"@type":"BreadcrumbList"');
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    // The shared OG template (ADR-043) renders the article's image.
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    const image = await page.request.get(new URL(og ?? "", page.url()).pathname);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
  });

  test("an old slug answers 308 and an unknown slug a server-rendered 404", async ({ request }) => {
    const moved = await request.get("/insights/old-slug", { maxRedirects: 0 });
    expect(moved.status()).toBe(308);
    expect(moved.headers()["location"]).toMatch(/\/insights\/example-post-1$/);
    const missing = await request.get("/insights/no-such-post");
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain("<main");
  });
});

test.describe("Topic, author, feed, sitemap and redirects", () => {
  test("topic and author pages list their posts", async ({ page }) => {
    await page.goto("/insights/topics/example-topic");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Example topic");
    await page.goto("/insights/authors/example-author");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Example Author");
    await expect(page.getByText("Example biography (fixture).")).toBeVisible();
  });

  test("the feed is RSS 2.0", async ({ request }) => {
    const response = await request.get("/insights/feed.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/rss+xml");
    const xml = await response.text();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<title>Example post 1 (fixture)</title>");
  });

  test("/blog moves to /insights", async ({ request }) => {
    const root = await request.get("/blog", { maxRedirects: 0 });
    expect(root.status()).toBe(308);
    expect(root.headers()["location"]).toMatch(/\/insights$/);
    const deep = await request.get("/blog/example-post-1", { maxRedirects: 0 });
    expect(deep.headers()["location"]).toMatch(/\/insights\/example-post-1$/);
  });

  test("the sitemap index lists the Insights and Careers children with the admin's URLs", async ({
    request,
  }) => {
    // ADR-043: /sitemap.xml is an index of /sitemaps/{pages,insights,careers}.xml.
    const index = await (await request.get("/sitemap.xml")).text();
    expect(index).toContain("<sitemapindex");
    expect(index).toContain("/sitemaps/insights.xml</loc>");
    expect(index).toContain("/sitemaps/careers.xml</loc>");
    const insights = await (await request.get("/sitemaps/insights.xml")).text();
    expect(insights).toContain("/insights/example-post-1</loc>");
    expect(insights).toContain("/insights/topics/example-topic</loc>");
    const careers = await (await request.get("/sitemaps/careers.xml")).text();
    expect(careers).toContain("/careers/example-role-fixture</loc>");
    const pages = await (await request.get("/sitemaps/pages.xml")).text();
    expect(pages).not.toMatch(/\/(insights|careers)[/<]/);
  });
});

test.describe("Homepage and navigation", () => {
  test("the homepage shows the Insights section and the navigation links Insights", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "All insights" })).toBeVisible();
    await expect(page.locator('main a[href="/insights/example-post-1"]')).toHaveCount(1);
    await expect(page.locator('header a[href="/insights"]').first()).toBeAttached();
  });
});

test.describe("Preview (Draft Mode)", () => {
  test("a preview token opens the working copy with the preview bar, never cached", async ({
    page,
  }) => {
    // Signed like the admin signs it (contract: base64url(payload).base64url(HMAC)); test key.
    const payload = Buffer.from(
      JSON.stringify({
        v: 1,
        kid: "e2e-preview",
        entity: "post",
        id: "00000000-0000-4000-8000-000000000101",
        rev: "e2e",
        exp: Math.floor(Date.now() / 1000) + 600,
      }),
    ).toString("base64url");
    const mac = createHmac("sha256", "e2e-preview-secret-not-a-secret-00000000")
      .update(payload)
      .digest("base64url");
    const response = await page.goto(`/api/content/preview?token=${payload}.${mac}`);
    expect(page.url()).toMatch(/\/insights\/example-post-1$/);
    expect(response?.status()).toBe(200);
    const bar = page.getByRole("complementary", { name: "Preview" });
    await expect(bar).toContainText("PREVIEW · NOT PUBLISHED · DRAFT");
    await bar.getByRole("link", { name: "Exit preview" }).click();
    await expect(page.getByRole("complementary", { name: "Preview" })).toHaveCount(0);
  });
});
