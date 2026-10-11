import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isLegalSlug, legalFacts } from "./map";

describe("legal mapping", () => {
  it("accepts exactly the known legal slugs", () => {
    for (const slug of ["privacy", "cookies", "terms", "acceptable-use"]) {
      expect(isLegalSlug(slug)).toBe(true);
    }
    expect(isLegalSlug("imprint")).toBe(false);
  });

  it("shows version and effective date, and omits what is absent", () => {
    const facts = legalFacts({ version: "1.2", effectiveDate: "2026-01-01" });
    expect(facts.map((fact) => fact.label)).toEqual(["Version", "Effective date"]);
    expect(renderToStaticMarkup(<>{facts[1]!.value}</>)).toContain('dateTime="2026-01-01"');
    expect(legalFacts({ version: " ", effectiveDate: "nope" })).toEqual([]);
  });
});
