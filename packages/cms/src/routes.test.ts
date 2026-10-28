import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  aiDataSitemapPaths,
  hrefForDocument,
  hrefForRoutePage,
  isValidSlug,
  labTypes,
  routeManifest,
  routePageKeys,
  routes,
  trustTopics,
} from "./routes";

describe("hrefForDocument", () => {
  it("builds every detail route from the URL architecture (Stage 8 §7)", () => {
    expect(hrefForDocument({ kind: "practice", slug: "engineering" })).toBe(
      "/what-we-do/engineering",
    );
    expect(hrefForDocument({ kind: "solution", slug: "ai-transformation" })).toBe(
      "/solutions/ai-transformation",
    );
    expect(hrefForDocument({ kind: "offer", slug: "ai-opportunity-assessment" })).toBe(
      "/offers/ai-opportunity-assessment",
    );
    expect(hrefForDocument({ kind: "industry", slug: "health-care" })).toBe(
      "/industries/health-care",
    );
    expect(hrefForDocument({ kind: "caseStudy", slug: "example" })).toBe("/work/example");
    expect(hrefForDocument({ kind: "insight", slug: "example" })).toBe("/insights/example");
    expect(hrefForDocument({ kind: "person", slug: "example-person" })).toBe(
      "/people/example-person",
    );
    expect(
      hrefForDocument({ kind: "labAsset", labType: "reference-architectures", slug: "x" }),
    ).toBe("/labs/reference-architectures/x");
    expect(hrefForDocument({ kind: "trustItem", slug: "security" })).toBe("/trust/security");
    expect(hrefForDocument({ kind: "job", slug: "example-role" })).toBe("/careers/example-role");
    expect(hrefForDocument({ kind: "legalPage", slug: "privacy" })).toBe("/legal/privacy");
  });

  it("encodes unsafe slug characters instead of breaking out of the path", () => {
    expect(hrefForDocument({ kind: "insight", slug: "../x?y#z" })).toBe("/insights/..%2Fx%3Fy%23z");
  });
});

describe("route pages and contact", () => {
  it("resolves every route page key to a path", () => {
    for (const key of routePageKeys) {
      expect(hrefForRoutePage(key)).toMatch(/^\/[a-z-/]*$/);
    }
    expect(hrefForRoutePage("about")).toBe("/about");
    expect(routes.faq()).toBe("/faq");
  });

  it("adds a contact intent", () => {
    expect(routes.contact()).toBe("/contact");
    expect(routes.contact("procurement")).toBe("/contact?intent=procurement");
  });

  it("lists the Labs types and Trust topics from the plan", () => {
    expect(labTypes).toHaveLength(7);
    expect(trustTopics).toEqual([
      "security",
      "privacy",
      "responsible-ai",
      "accessibility",
      "resilience",
      "subprocessors",
      "certifications",
      "procurement",
    ]);
  });
});

describe("helpers", () => {
  it("builds absolute URLs", () => {
    expect(absoluteUrl("https://www.example.invalid", "/work")).toBe(
      "https://www.example.invalid/work",
    );
  });

  it("validates slugs", () => {
    expect(isValidSlug("ai-transformation")).toBe(true);
    expect(isValidSlug("Not A Slug")).toBe(false);
    expect(isValidSlug("-bad")).toBe(false);
  });

  it("builds the AI & Data routes and lists them in the manifest", () => {
    expect(routes.aiData.home()).toBe("/ai-data");
    expect(routes.aiData.contact()).toBe("/ai-data/contact");
    expect(routes.aiData.contact("ai-proof-of-value")).toBe(
      "/ai-data/contact?offer=ai-proof-of-value",
    );
    expect(routes.aiData.thankYou("VIT-0123456789AB")).toBe(
      "/ai-data/contact/thank-you?ref=VIT-0123456789AB",
    );
    const patterns = new Map(routeManifest.map((entry) => [entry.pattern, entry]));
    for (const path of aiDataSitemapPaths) {
      expect(patterns.get(path)?.sitemap, path).toBe(true);
      expect(patterns.get(path)?.gate, path).toBeUndefined();
    }
    expect(patterns.get("/ai-data/contact/thank-you")?.sitemap).toBe(false);
    expect(aiDataSitemapPaths).not.toContain("/ai-data/contact/thank-you");
  });

  it("has a unique manifest", () => {
    const patterns = routeManifest.map((entry) => entry.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });
});
