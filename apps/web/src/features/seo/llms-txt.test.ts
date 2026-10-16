import { describe, expect, it } from "vitest";
import { buildLlmsTxt } from "./llms-txt";

describe("buildLlmsTxt", () => {
  const text = buildLlmsTxt({
    siteUrl: "https://www.example.invalid",
    sitemapPaths: new Set(["/what-we-do/a", "/about"]),
    sections: [
      {
        heading: "Practices",
        links: [
          { path: "/what-we-do/a", title: "Example A", summary: "One  line\nsummary." },
          { path: "/what-we-do/gated", title: "Gated", summary: "Not in the sitemap." },
        ],
      },
      { heading: "Empty", links: [{ path: "/nowhere", title: "Nowhere" }] },
      { heading: "Company", links: [{ path: "/about", title: "About" }] },
    ],
  });

  it("starts with the entity: name, proposition and descriptor", () => {
    expect(text.startsWith("# Vitalos\n\n> We help ambitious organisations")).toBe(true);
    expect(text).toContain("Technology Consulting, Engineering & Digital Transformation");
  });

  it("lists only sitemap pages, one line each, and skips empty sections", () => {
    expect(text).toContain(
      "- [Example A](https://www.example.invalid/what-we-do/a): One line summary.",
    );
    expect(text).toContain("- [About](https://www.example.invalid/about)\n");
    expect(text).not.toContain("Gated");
    expect(text).not.toContain("## Empty");
  });
});
