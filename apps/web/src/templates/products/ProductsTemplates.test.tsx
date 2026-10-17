import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { productBySlug, products } from "@vitalos/cms";
import { ProductTemplate, ProductsIndexTemplate } from "./ProductsTemplates";

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);
const sob = productBySlug("sob-autofix")!;
const fauward = productBySlug("fauward")!;

describe("product template", () => {
  it("adds the sector to the eyebrow, and the facts, sections and screens a product has", () => {
    const markup = html(<ProductTemplate product={sob} />);
    expect(markup).toContain("Products · Automotive services");
    expect(markup.match(/<h1[\s>]/g)).toHaveLength(1);
    // At a glance as a definition list, in the brief's order.
    expect(markup).toContain(">At a glance</h2>");
    expect(markup).toContain("<dl");
    expect(markup.indexOf(">Live at<")).toBeLessThan(markup.indexOf(">Live since<"));
    for (const heading of ["The problem", "What it does", "Engineering decisions", "Outcome"]) {
      expect(markup).toContain(`>${heading}</h2>`);
    }
    expect(markup).toContain(">Registrations stay private</h3>");
    // The snapshot and both further screens, each with its own alt and caption.
    expect(markup).toContain("SOB Autofix booking flow, step 1 of 7");
    expect(markup).toContain("The sobautofix.com homepage, with the registration lookup");
    expect(markup).toContain("The SOB Autofix quote request");
    expect(markup).toContain(">More of the site</h2>");
    // Its own site, in the same tab.
    expect(markup).toMatch(/href="https:\/\/sobautofix\.com"[^>]*rel="noopener"/);
    expect(markup).not.toContain('target="_blank"');
  });

  it("leaves a product without them as it was", () => {
    const markup = html(<ProductTemplate product={fauward} />);
    expect(markup).not.toContain(">At a glance</h2>");
    expect(markup).not.toContain(">More of the site</h2>");
    expect(markup).not.toContain("Products ·");
  });

  it("keeps the page within 700 words of body copy", () => {
    const words = [
      sob.description,
      sob.snapshotCaption,
      ...(sob.facts ?? []).flatMap((fact) => [fact.label, fact.value]),
      ...(sob.sections ?? []).flatMap((section) => [
        section.heading,
        section.intro ?? "",
        ...(section.points ?? []).flatMap((point) => [point.title, point.text]),
      ]),
      ...(sob.screens ?? []).map((screen) => screen.caption),
    ]
      .join(" ")
      .split(/\s+/)
      .filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(700);
  });
});

describe("products index", () => {
  it("shows Fauward, then SOB Autofix", () => {
    const markup = html(<ProductsIndexTemplate page={null} products={products} />);
    expect(markup.indexOf("View Fauward")).toBeGreaterThan(-1);
    expect(markup.indexOf("View Fauward")).toBeLessThan(markup.indexOf("View SOB Autofix"));
    expect(markup).toContain('href="/products/sob-autofix"');
  });
});
