import { describe, expect, it } from "vitest";
import { createFixtureContentSource, fixtureSets, fullFixtureSet, sparseFixtureSet } from "./index";

function walk(value: unknown, visit: (entry: string, key: string) => void, key = ""): void {
  if (typeof value === "string") visit(value, key);
  else if (Array.isArray(value)) value.forEach((entry) => walk(entry, visit, key));
  else if (typeof value === "object" && value !== null) {
    for (const [k, entry] of Object.entries(value)) walk(entry, visit, k);
  }
}

describe.each(Object.values(fixtureSets))("$name fixture set is obviously artificial", (set) => {
  it("uses only .invalid addresses", () => {
    walk(set, (entry) => {
      for (const url of entry.match(/https?:\/\/[^\s"')]+/g) ?? []) {
        expect(url, url).toMatch(/^https:\/\/example\.invalid(\/|$)/);
      }
      for (const email of entry.match(/[\w.+-]+@[\w.-]+/g) ?? []) {
        expect(email, email).toMatch(/@example\.invalid$/);
      }
    });
  });

  it("labels every title, name, heading and metric as a fixture", () => {
    const labelled = ["title", "name", "heading", "value", "descriptor", "legalName"];
    let checked = 0;
    walk({ ...set, name: undefined }, (entry, key) => {
      if (labelled.includes(key)) {
        checked += 1;
        expect(entry, `${key}: ${entry}`).toContain("(fixture)");
      }
    });
    expect(checked).toBeGreaterThan(0);
  });

  it("gives every metric a fixture source", () => {
    for (const study of set.documents.caseStudy) {
      for (const metric of study.metrics) expect(metric.source).toContain("fixture");
    }
  });

  it("carries no pricing and no real organisation", () => {
    const text = JSON.stringify(set).toLowerCase().replaceAll("contracted-by-vitalos", "");
    expect(text).not.toMatch(/£|\$\d|\bprice\b|\bpricing\b/);
    expect(text).not.toMatch(/vitalos/);
  });
});

describe("fixture set contents", () => {
  it("full holds the pieces the gates and templates need", () => {
    const docs = fullFixtureSet.documents;
    expect(docs.caseStudy.some((study) => study.clientDisplay === "named")).toBe(true);
    expect(docs.caseStudy.some((study) => study.evidence.status === "pending")).toBe(true);
    expect(docs.labAsset.some((lab) => lab.repoUrl !== undefined)).toBe(true);
    expect(docs.job.some((job) => job.status === "closed")).toBe(true);
    expect(docs.trustItem).toHaveLength(8);
    expect(docs.legalPage).toHaveLength(4);
    expect(Object.keys(fullFixtureSet.routePages)).toHaveLength(13);
  });

  it("sparse leaves optional content out", () => {
    expect(sparseFixtureSet.settings).toEqual({});
    expect(sparseFixtureSet.home?.proof).toEqual([]);
    expect(sparseFixtureSet.routePages.contact).not.toHaveProperty("expectations");
    expect(sparseFixtureSet.documents.labAsset).toEqual([]);
  });
});

describe("fixture sitemap", () => {
  it("lists only case studies with verified evidence (the others have no public page)", async () => {
    const source = createFixtureContentSource("full");
    const paths = (await source.getSitemapEntries()).map((entry) => entry.path);
    expect(paths).toContain("/work/example-case-study");
    expect(paths).not.toContain("/work/example-case-study-pending");
  });

  it("uses a privacy notice version the enquiry contract accepts", () => {
    for (const set of Object.values(fixtureSets)) {
      const privacy = set.documents.legalPage.find((page) => page.slug === "privacy");
      expect(privacy?.version).toMatch(/^[A-Za-z0-9._-]{1,40}$/);
    }
  });
});
