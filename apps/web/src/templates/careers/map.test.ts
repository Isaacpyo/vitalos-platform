import { describe, expect, it } from "vitest";
import type { JobView } from "@vitalos/cms";
import { fullFixtureSet } from "@vitalos/cms/fixtures";
import { applyLink, employmentTypeLabel, isOpenRole, summaryFacts } from "./map";

const [open, closed] = fullFixtureSet.documents.job as [JobView, JobView];
const now = new Date("2026-06-01T12:00:00Z");

describe("isOpenRole", () => {
  it("is open for an open role before its closing date", () => {
    expect(isOpenRole(open, now)).toBe(true);
    expect(isOpenRole({ status: "open" }, now)).toBe(true);
  });

  it("is closed for a closed role, or an open role past its closing date", () => {
    expect(isOpenRole(closed, now)).toBe(false);
    expect(isOpenRole({ status: "open", validThrough: "2026-05-31" }, now)).toBe(false);
  });

  it("is still open on the closing day itself", () => {
    expect(isOpenRole({ status: "open", validThrough: "2026-06-01" }, now)).toBe(true);
  });
});

describe("job display", () => {
  it("labels employment types readably", () => {
    expect(employmentTypeLabel("full-time")).toBe("Full time");
    expect(employmentTypeLabel(undefined)).toBeUndefined();
    expect(employmentTypeLabel(" ")).toBeUndefined();
  });

  it("lists location and type as facts when present", () => {
    expect(
      summaryFacts({
        id: "j",
        slug: "j",
        title: "J",
        location: "Example",
        employmentType: "contract",
      }).map((fact) => fact.label),
    ).toEqual(["Location", "Employment type"]);
    expect(summaryFacts({ id: "j", slug: "j", title: "J" })).toEqual([]);
  });

  it("applies through the role's https URL, else through the careers contact route", () => {
    expect(applyLink(open)).toMatchObject({ href: open.applicationUrl, external: true });
    const noUrl = applyLink({ ...open, applicationUrl: undefined } as unknown as JobView);
    expect(noUrl).toMatchObject({ href: "/contact?intent=careers", external: false });
    const unsafe = applyLink({ ...open, applicationUrl: "javascript:alert(1)" } as JobView);
    expect(unsafe.external).toBe(false);
  });
});
