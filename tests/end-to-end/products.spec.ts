import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "../support/axe";
import { isDraftRun } from "../support/content-source";
import { expectNoHorizontalOverflowAt320 } from "../support/overflow";

// The Products section (owner direction, 17 Oct 2026; ADR-031 amendment). Products live in
// @vitalos/cms, not the content source, so these run under every source.
test.use({ reducedMotion: "reduce" });

const isDesktop = (width: number | undefined) => (width ?? 0) >= 1024;

test.describe("Products", () => {
  test("Who We Are lists Products: the heading to /products, Fauward to its page", async ({
    page,
  }) => {
    await page.goto("/");
    if (isDesktop(page.viewportSize()?.width)) {
      await page.getByRole("button", { name: "Who We Are menu" }).click();
      const panel = page.getByRole("group", { name: "Who We Are" });
      await expect(panel.getByRole("link", { name: "Products", exact: true })).toHaveAttribute(
        "href",
        "/products",
      );
      const fauward = panel.getByRole("link", { name: /^Fauward — logistics SaaS/ });
      await expect(fauward).toHaveAttribute("href", "/products/fauward");
      await expectNoA11yViolations(page);
    } else {
      // The mobile sheet renders the same columns; collapsed disclosures hide them from roles.
      await expect(page.locator('header a[href="/products/fauward"]').first()).toBeAttached();
      await expect(page.locator('header a[href="/products"]').first()).toBeAttached();
    }
  });

  test("the footer's Explore column links to /products", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('footer a[href="/products"]')).toHaveCount(1);
    await expect(page.locator('footer a[href="/products"]')).toHaveText("Products");
  });

  test("/products shows one Fauward card with its snapshot and a link to its page", async ({
    page,
  }) => {
    const response = await page.goto("/products");
    expect(response?.status()).toBe(200);
    // The route page's heading: "Products" in the repo copy, "Products (fixture)" in the fixtures.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Products/);
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 2, name: "Fauward" })).toHaveCount(1);
    await expect(
      main.getByRole("img", { name: "Fauward dashboard showing shipment operations" }),
    ).toBeVisible();
    await expect(main.getByRole("link", { name: "View Fauward" })).toHaveAttribute(
      "href",
      "/products/fauward",
    );
    await expectNoA11yViolations(page);
    await expectNoHorizontalOverflowAt320(page);
  });

  test("/products/fauward: the sentence, the snapshot, and fauward.com in the same tab", async ({
    page,
  }) => {
    const response = await page.goto("/products/fauward");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fauward");
    await expect(page.locator("main")).toContainText(
      "Vitalos builds and operates Fauward, a logistics SaaS platform.",
    );
    const cta = page.getByRole("link", { name: "Open fauward.com" });
    await expect(cta).toHaveAttribute("href", "https://fauward.com");
    await expect(cta).toHaveAttribute("rel", "noopener");
    await expect(cta).not.toHaveAttribute("target", /.+/);
    const graph = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "{}",
    ) as { "@graph": { "@type": string; url?: string }[] };
    const software = graph["@graph"].find((node) => node["@type"] === "SoftwareApplication");
    expect(software?.url).toBe("https://fauward.com");
    await expectNoA11yViolations(page);
    await expectNoHorizontalOverflowAt320(page);
  });

  test("an unknown product is a 404", async ({ page }) => {
    const response = await page.goto("/products/not-a-product");
    expect(response?.status()).toBe(404);
  });

  test("About says once that Vitalos builds and operates Fauward, linked to its page", async ({
    page,
  }) => {
    test.skip(!isDraftRun, "the fixture About body is generic; the sentence is repo copy");
    await page.goto("/about");
    const text = ((await page.locator("main").textContent()) ?? "").replace(/\s+/g, " ");
    expect(
      text.split("Vitalos builds and operates Fauward, a logistics SaaS platform."),
    ).toHaveLength(2);
    await expect(
      page.locator("main").getByRole("link", { name: "Fauward", exact: true }),
    ).toHaveAttribute("href", "/products/fauward");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });
});
