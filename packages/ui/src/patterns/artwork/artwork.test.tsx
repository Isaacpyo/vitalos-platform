import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { convergence, hashSeed, seeded } from "./geometry";
import { HeroArtwork, artworkFamilies } from "./HeroArtwork";
import { LineDiagram, lineDiagramNames } from "./LineDiagram";

afterEach(cleanup);

const markup = (family: (typeof artworkFamilies)[number], seed?: string) =>
  renderToStaticMarkup(<HeroArtwork family={family} {...(seed ? { seed } : {})} />);

describe("HeroArtwork (ADR-044)", () => {
  it("draws every family as decorative SVG with no text, images or raw colours", () => {
    for (const family of artworkFamilies) {
      const html = markup(family);
      expect(html).toMatch(/^<svg[^>]*aria-hidden="true"/);
      expect(html).toContain(`data-artwork="${family}"`);
      expect(html).not.toMatch(/<text|<image|<img|#[0-9a-f]{3,8}\b|rgb\(|opacity|gradient|filter/i);
    }
  });

  it("gives each family its own composition", () => {
    const drawings = artworkFamilies.map((family) =>
      markup(family).replace(/data-artwork="[^"]+"/, ""),
    );
    expect(new Set(drawings).size).toBe(artworkFamilies.length);
  });

  it("is deterministic per seed, and items of one family differ", () => {
    expect(markup("what-we-do", "consulting")).toBe(markup("what-we-do", "consulting"));
    const practices = ["consulting", "engineering", "ai-data", "experience", "managed-services"];
    expect(new Set(practices.map((seed) => markup("what-we-do", seed))).size).toBe(5);
    const industries = [
      "health-care",
      "retail-commerce-consumer",
      "operations-industry-logistics",
      "growth-technology",
    ];
    expect(new Set(industries.map((seed) => markup("industries", seed))).size).toBe(4);
  });

  it("animates only when asked, and only behind motion-safe", () => {
    expect(markup("home")).not.toContain("animate-");
    const animated = renderToStaticMarkup(<HeroArtwork family="home" animate />);
    expect(animated).toContain("motion-safe:animate-");
  });

  it("crops to the centre strip for compact screens", () => {
    const { container } = render(<HeroArtwork family="home" crop="strip" />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("560 140 640 320");
  });
});

describe("Convergence geometry", () => {
  it("starts both bands on the same vertical cut and runs them to the end line", () => {
    const { strategy, engineering } = convergence({
      startX: 600,
      mergeX: 840,
      axisY: 330,
      upper: 120,
      lower: 74,
      gap: 8,
      endX: 1260,
    });
    const xs = (points: string) => points.split(" ").map((p) => Number(p.split(",")[0]));
    expect(Math.min(...xs(strategy))).toBe(600);
    expect(Math.min(...xs(engineering))).toBe(600);
    expect(Math.max(...xs(strategy))).toBe(1260);
  });

  it("hashes and seeds deterministically", () => {
    expect(hashSeed("vitalos")).toBe(hashSeed("vitalos"));
    const a = seeded("x");
    const b = seeded("x");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("LineDiagram", () => {
  it("draws every solution diagram as decorative line art, never a raster image", () => {
    for (const name of lineDiagramNames) {
      const html = renderToStaticMarkup(<LineDiagram name={name} />);
      expect(html).toMatch(/^<svg[^>]*aria-hidden="true"/);
      expect(html).toContain('stroke-linecap="square"');
      expect(html).not.toMatch(/<text|<image|<img|#[0-9a-f]{3,8}\b/i);
    }
  });
});
