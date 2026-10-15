import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { stubMedia } from "./support/media";

test.beforeEach(async ({ page }) => stubMedia(page));

test.describe("Insights index", () => {
  test("hero, format tabs, featured row, grid and closing band", async ({ page }) => {
    const response = await page.goto("/insights");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Engineering clarity from complexity.",
    );
    await expect(page.getByRole("navigation", { name: "Formats" })).toBeVisible();
    await expect(page.locator('main a[href="/insights/example-post-1"]').first()).toBeVisible();
    await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Talk to Vitalos" })).toBeVisible();
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
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("INSIGHTS");
    await expect(
      page.getByText("PUBLISHED 12 OCT 2026 · UPDATED 14 OCT 2026 · 3 MIN READ"),
    ).toBeVisible();
    await expect(page.locator("#example-heading")).toHaveText("Example heading");
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
    await expect(page.getByRole("link", { name: "More from Example" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Share on LinkedIn" })).toHaveAttribute(
      "href",
      /^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=/,
    );
    const jsonLd = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).join("");
    expect(jsonLd).toContain('"@type":"Article"');
    expect(jsonLd).toContain('"@type":"BreadcrumbList"');
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
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

  test("the sitemap lists the admin's Insights URLs", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/insights/example-post-1</loc>");
    expect(xml).toContain("/insights/topics/example-topic</loc>");
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
