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

  it("lists Fauward, then SOB Autofix", () => {
    expect(products.map((product) => product.slug)).toEqual(["fauward", "sob-autofix"]);
  });

  it("Fauward is at /products/fauward", () => {
    const fauward = productBySlug("fauward");
    expect(fauward?.description).toBe(
      "Vitalos builds and operates Fauward, a logistics SaaS platform.",
    );
    expect(fauward?.navLabel).toBe("Fauward — logistics SaaS");
    expect(fauward && productPath(fauward)).toBe("/products/fauward");
  });
});

describe("SOB Autofix", () => {
  const sob = productBySlug("sob-autofix")!;

  it("is at /products/sob-autofix, with its menu label and site", () => {
    expect(productPath(sob)).toBe("/products/sob-autofix");
    expect(sob.navLabel).toBe("SOB Autofix — workshop platform");
    expect(sob.url).toBe("https://sobautofix.com");
    expect(sob.applicationCategory).toBe("BusinessApplication");
  });

  it("states only the verified claims (docs/content/DISCOVERY-sob-autofix.md)", () => {
    const text = JSON.stringify(sob);
    // The seven steps, as the booking wizard names them.
    expect(text).toContain("vehicle, service, problem, location, details, appointment and review");
    // Claims the evidence does not support stay out: no mobile eligibility check, no email in
    // Manage Booking, one area page, no outcome figures.
    expect(text).not.toMatch(/eligib|postcode|radius/i);
    expect(text).not.toMatch(/reference, registration and email/i);
    expect(text).not.toMatch(/area pages/i);
    expect(text).not.toMatch(/\d+\s?%|uplift|increase/i);
  });

  it("has its facts and sections in the brief's order", () => {
    expect(sob.facts?.map((fact) => fact.label)).toEqual([
      "Live at",
      "Sector",
      "Scope",
      "Stack",
      "Live since",
    ]);
    expect(sob.sections?.map((section) => section.heading)).toEqual([
      "The problem",
      "What it does",
      "Engineering decisions",
      "Outcome",
    ]);
  });
});

describe("section layouts", () => {
  const words = (value: string) => value.trim().split(/\s+/).length;

  it("keeps cards, steps and tiles short: titles of four words or fewer, lines of ten", () => {
    for (const product of products) {
      for (const section of product.sections ?? []) {
        if ((section.layout ?? "points") === "points") continue;
        for (const point of section.points ?? []) {
          expect(words(point.title), point.title).toBeLessThanOrEqual(4);
          expect(words(point.text), point.text).toBeLessThanOrEqual(10);
        }
        const keys = (section.points ?? []).flatMap((point) => (point.key ? [point.key] : []));
        expect(new Set(keys).size, section.heading).toBe(keys.length);
      }
    }
  });

  it("gives Fauward what it does, how it works and who it is for, without figures", () => {
    const fauward = productBySlug("fauward")!;
    expect(fauward.sector).toBe("Logistics");
    expect(fauward.sections?.map((section) => [section.heading, section.layout])).toEqual([
      ["What it does", "cards"],
      ["How it works", "steps"],
      ["Built for", "tiles"],
    ]);
    // fauward.com publishes prices and uptime figures; this page repeats none of them.
    expect(JSON.stringify(fauward.sections)).not.toMatch(/£|\d+\s?%|\d+\s?min/);
  });
});
