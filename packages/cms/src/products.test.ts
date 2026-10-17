import { describe, expect, it } from "vitest";
import { productBySlug, productPath, products } from "./products";
import { isValidSlug } from "./routes";

describe("products", () => {
  it("each product has a valid slug, an https site and a description that names it once", () => {
    for (const product of products) {
      expect(isValidSlug(product.slug)).toBe(true);
      expect(new URL(product.url).protocol).toBe("https:");
      expect(product.description.split(product.name)).toHaveLength(2);
      // The site's description limits (content-seo.test.ts).
      expect(product.seo.description.length).toBeGreaterThanOrEqual(120);
      expect(product.seo.description.length).toBeLessThanOrEqual(155);
    }
  });

  it("Fauward is the one product, at /products/fauward", () => {
    const fauward = productBySlug("fauward");
    expect(products).toHaveLength(1);
    expect(fauward?.description).toBe(
      "Vitalos builds and operates Fauward, a logistics SaaS platform.",
    );
    expect(fauward?.navLabel).toBe("Fauward — logistics SaaS");
    expect(fauward && productPath(fauward)).toBe("/products/fauward");
  });
});
