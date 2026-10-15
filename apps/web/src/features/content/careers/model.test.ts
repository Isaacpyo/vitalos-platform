import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CareersPage, RoleDetail } from "../schemas";
import type { CareersPageData } from "../schemas";
import {
  FILTER_THRESHOLD,
  applyLink,
  careersHref,
  closesLine,
  filterGroups,
  filterLabel,
  groupRoles,
  jobPostingJsonLd,
  privacyNoticeHref,
  roleFacts,
  roleFactsLine,
} from "./model";
import type { RoleDetail as RoleDetailType } from "./model";

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../../../contracts/content-api/v1/fixtures/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
const role = RoleDetail.parse(fixture("role-open"));
const page = CareersPage.parse(fixture("careers-page"));
const input = {
  siteUrl: "https://www.example.test",
  descriptionHtml: "<p>Example description.</p>",
  organization: { name: "Vitalos", url: "https://www.example.test/" },
};

describe("role presentation", () => {
  it("builds the mono facts line, level only when shown", () => {
    expect(roleFactsLine(role)).toBe("ENGINEERING · SENIOR · HYBRID · EXAMPLE CITY · PERMANENT");
    expect(roleFactsLine({ ...role, level: null })).toBe(
      "ENGINEERING · HYBRID · EXAMPLE CITY · PERMANENT",
    );
    expect(closesLine(role)).toBe("Closes 30 Nov 2026");
    expect(closesLine({ ...role, closesAt: null })).toBeNull();
  });

  it("lists the facts grid, each only when it has a value", () => {
    expect(roleFacts(role).map((fact) => fact.label)).toEqual([
      "PRACTICE",
      "LEVEL",
      "LOCATION",
      "WORK MODEL",
      "EMPLOYMENT",
      "SALARY",
      "CLOSES",
    ]);
    const bare = roleFacts({
      ...role,
      level: null,
      salary: null,
      closesAt: null,
      sponsorship: { key: "available", label: "Available" },
    });
    expect(bare.map((fact) => fact.label)).toEqual([
      "PRACTICE",
      "LOCATION",
      "WORK MODEL",
      "EMPLOYMENT",
      "VISA SPONSORSHIP",
    ]);
  });

  it("applies through the form anchor or an https external URL only", () => {
    expect(applyLink(role)).toEqual({ href: "#apply", external: false });
    const external = (url: string | null): RoleDetailType => ({
      ...role,
      apply: { mode: "external", externalUrl: url },
    });
    expect(applyLink(external("https://jobs.example.test/1"))).toEqual({
      href: "https://jobs.example.test/1",
      external: true,
    });
    expect(applyLink(external("http://jobs.example.test/1"))).toBeNull();
    expect(applyLink(external(null))).toBeNull();
  });

  it("accepts a privacy notice that is a site path or an https URL", () => {
    expect(privacyNoticeHref("/legal/privacy")).toBe("/legal/privacy");
    expect(privacyNoticeHref("https://www.example.test/privacy")).toBe(
      "https://www.example.test/privacy",
    );
    for (const bad of [null, "//evil.example", "javascript:alert(1)", "http://x.test"]) {
      expect(privacyNoticeHref(bad), String(bad)).toBeNull();
    }
  });
});

describe("careers page groups and filters", () => {
  const roleIn = (n: number, practice: string, workModel = "hybrid") => ({
    ...page.groups[0]!.roles[0]!,
    id: `00000000-0000-4000-8000-0000000003${String(n).padStart(2, "0")}`,
    slug: `role-${n}`,
    practice: { key: practice as "engineering", label: practice },
    workModel: { key: workModel, label: workModel },
  });
  const many: CareersPageData = {
    ...page,
    total: FILTER_THRESHOLD + 1,
    groups: [
      { practice: { key: "labs", label: "Labs" }, roles: [roleIn(1, "labs")] },
      {
        practice: { key: "consulting", label: "Consulting" },
        roles: [roleIn(2, "consulting", "remote"), roleIn(3, "consulting")],
      },
      {
        practice: { key: "engineering", label: "Engineering" },
        roles: [4, 5, 6, 7].map((n) => roleIn(n, "engineering")),
      },
    ],
  };

  it("orders groups by the fixed practice order", () => {
    expect(groupRoles(many).map((group) => group.practice.key)).toEqual([
      "consulting",
      "engineering",
      "labs",
    ]);
  });

  it("offers filters only above six open roles, as links", () => {
    expect(filterGroups(page)).toEqual([]);
    const groups = filterGroups(many, { dimension: "workModel", value: "remote" });
    expect(groups.map((group) => group.dimension)).toEqual(["practice", "workModel"]);
    const remote = groups[1]!.options.find((option) => option.current);
    expect(remote?.href).toBe("/careers?workModel=remote");
  });

  it("filters roles and leaves empty groups out", () => {
    const filtered = groupRoles(many, { dimension: "workModel", value: "remote" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.roles.map((r) => r.slug)).toEqual(["role-2"]);
    expect(filterLabel(many, { dimension: "practice", value: "labs" })).toBe("labs");
    expect(filterLabel(many, { dimension: "practice", value: "nothing" })).toBeNull();
    expect(careersHref()).toBe("/careers");
  });
});

describe("jobPostingJsonLd", () => {
  it("describes an open form role completely", () => {
    expect(jobPostingJsonLd(role, input)).toEqual({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Example role (fixture)",
      description: "<p>Example description.</p>",
      datePosted: "2026-10-12T09:00:00Z",
      validThrough: "2026-11-30T23:59:00Z",
      employmentType: "FULL_TIME",
      hiringOrganization: {
        "@type": "Organization",
        name: "Vitalos",
        sameAs: "https://www.example.test/",
      },
      jobLocation: {
        "@type": "Place",
        address: { "@type": "PostalAddress", addressLocality: "Example City" },
      },
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "GBP",
        value: { "@type": "QuantitativeValue", minValue: 10000, maxValue: 20000, unitText: "YEAR" },
      },
      directApply: true,
      url: "https://www.example.test/careers/example-role-fixture",
    });
  });

  it.each([
    ["title", { ...role, title: " " }, input],
    ["description", role, { ...input, descriptionHtml: "" }],
    ["datePosted", { ...role, datePosted: { ...role.datePosted, iso: "soon" } }, input],
    [
      "employment type",
      { ...role, employmentType: { key: "volunteer", label: "Volunteer" } },
      input,
    ],
    ["organisation name", role, { ...input, organization: { name: "", url: "https://x.test/" } }],
    ["organisation URL", role, { ...input, organization: { name: "Vitalos", url: "" } }],
    ["location (not remote)", { ...role, location: "" }, input],
  ])("omits the whole block without %s", (_label, value, options) => {
    expect(jobPostingJsonLd(value as RoleDetailType, options)).toBeNull();
  });

  it("marks remote roles as telecommute for the United Kingdom", () => {
    const remote = jobPostingJsonLd(
      { ...role, location: "", workModel: { key: "remote", label: "Remote" } },
      input,
    )!;
    expect(remote["jobLocationType"]).toBe("TELECOMMUTE");
    expect(remote["applicantLocationRequirements"]).toEqual({
      "@type": "Country",
      name: "United Kingdom",
    });
    expect(remote).not.toHaveProperty("jobLocation");
  });

  it("has no baseSalary when the salary is hidden, no validThrough without a closing date", () => {
    const node = jobPostingJsonLd({ ...role, salary: null, closesAt: null }, input)!;
    expect(node).not.toHaveProperty("baseSalary");
    expect(node).not.toHaveProperty("validThrough");
  });

  it("has no directApply for an external application", () => {
    const node = jobPostingJsonLd(
      { ...role, apply: { mode: "external", externalUrl: "https://jobs.example.test/1" } },
      input,
    )!;
    expect(node).not.toHaveProperty("directApply");
  });
});
