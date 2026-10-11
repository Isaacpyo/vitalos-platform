import { describe, expect, it } from "vitest";
import { evaluateGates } from "./gates";
import { isJobOpenOn, labTypeSitemapEntries } from "./sitemap-rules";

describe("isJobOpenOn", () => {
  const today = "2026-10-10";
  it("requires status open", () => {
    expect(isJobOpenOn({ status: "open" }, today)).toBe(true);
    expect(isJobOpenOn({ status: "closed" }, today)).toBe(false);
    expect(isJobOpenOn({ status: "draft" }, today)).toBe(false);
    expect(isJobOpenOn({}, today)).toBe(false);
  });

  it("treats the closing date as inclusive and compares calendar days only", () => {
    expect(isJobOpenOn({ status: "open", validThrough: "2026-10-11" }, today)).toBe(true);
    expect(isJobOpenOn({ status: "open", validThrough: "2026-10-10" }, today)).toBe(true);
    expect(isJobOpenOn({ status: "open", validThrough: "2026-10-10T00:00:00Z" }, today)).toBe(true);
    expect(isJobOpenOn({ status: "open", validThrough: "2026-10-09" }, today)).toBe(false);
    expect(isJobOpenOn({ status: "open", validThrough: null }, today)).toBe(true);
    expect(isJobOpenOn({ status: "open", validThrough: "" }, today)).toBe(true);
  });
});

describe("labTypeSitemapEntries", () => {
  const assets = [
    { labType: "experiments", updatedAt: "2026-02-01" },
    { labType: "experiments", updatedAt: "2026-03-01" },
    { labType: "research" },
    { labType: "bogus", updatedAt: "2026-01-01" },
    { labType: null },
  ];
  it("lists known types with assets in canonical order while the gate is open", () => {
    expect(labTypeSitemapEntries(assets, evaluateGates({ labs: 1 }))).toEqual([
      { path: "/labs/research", kind: "route" },
      { path: "/labs/experiments", kind: "route", lastModified: "2026-03-01" },
    ]);
  });
  it("lists nothing when the gate is closed or there are no assets", () => {
    expect(labTypeSitemapEntries(assets, evaluateGates())).toEqual([]);
    expect(labTypeSitemapEntries([], evaluateGates({ labs: 1 }))).toEqual([]);
  });
});
