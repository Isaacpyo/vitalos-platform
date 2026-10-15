import { describe, expect, it } from "vitest";
import { closedGates, evaluateGates } from "@vitalos/cms";
import type { OfferSummary, PracticeSummary, SolutionSummary } from "@vitalos/cms";
import {
  buildFooterModel,
  buildHeaderModel,
  buildWhatWeDoColumns,
  colourLogo,
  whiteLogo,
} from "./nav-model";
import type { ChromeContent } from "./nav-model";
import { activeSectionForPath } from "./section-for-path";

const summary = (slug: string, title: string): SolutionSummary => ({ id: slug, slug, title });
const offer = (slug: string, title: string): OfferSummary => ({ id: slug, slug, title });

const base: ChromeContent = {
  gates: closedGates,
  settings: {},
  practices: [],
  solutions: [],
  offers: [],
  trustTopics: [],
  legalPages: [],
};

describe("header model", () => {
  it("shows only ungated sections while every gate is closed", () => {
    const { items } = buildHeaderModel(base);
    expect(items.map((item) => item.key)).toEqual(["what-we-do", "about"]);
  });

  it("adds each gated section when its gate opens, in navigation order", () => {
    const gates = evaluateGates({ industries: 1, work: 2, insights: 6, labs: 1, careers: 1 });
    const { items } = buildHeaderModel({ ...base, gates });
    expect(items.map((item) => item.key)).toEqual([
      "what-we-do",
      "industries",
      "work",
      "insights",
      "labs",
      "about",
    ]);
  });

  it("keeps a gated section out while below its threshold", () => {
    const { items } = buildHeaderModel({ ...base, gates: evaluateGates({ work: 1, insights: 5 }) });
    expect(items.map((item) => item.key)).not.toContain("work");
    expect(items.map((item) => item.key)).not.toContain("insights");
  });

  it("has the Trust Centre utility link and the Talk to Vitalos action to /contact", () => {
    const { utility, cta } = buildHeaderModel(base);
    expect(utility).toEqual([{ key: "trust", label: "Trust Centre", href: "/trust" }]);
    expect(cta).toEqual({ label: "Talk to Vitalos", href: "/contact" });
  });

  it("puts the colour lockup in the header unless site settings carry a logo", () => {
    expect(buildHeaderModel(base).logo).toEqual(colourLogo);
    expect(buildHeaderModel(base).logoOnDark).toEqual(whiteLogo);
    const logo = { src: "/images/logo.svg", width: 10, height: 10 };
    expect(buildHeaderModel({ ...base, settings: { logo } }).logo).toEqual(logo);
  });

  it("puts the white monochrome lockup in the footer", () => {
    expect(buildFooterModel(base).brand?.logo).toEqual(whiteLogo);
  });
});

describe("What We Do mega-menu", () => {
  const practice = (title: string): PracticeSummary =>
    summary(title.toLowerCase().replace(/\W+/g, "-"), title);

  it("orders practices and solutions as the specs fix them, not alphabetically", () => {
    const columns = buildWhatWeDoColumns({
      ...base,
      practices: [
        practice("Vitalos Managed Services"),
        practice("Vitalos AI & Data"),
        practice("Vitalos Consulting"),
      ],
      solutions: [summary("a", "Application Modernisation"), summary("b", "AI Transformation")],
    });
    expect(columns.find((c) => c.key === "practices")?.links.map((l) => l.label)).toEqual([
      "Vitalos Consulting",
      "Vitalos AI & Data",
      "Vitalos Managed Services",
    ]);
    expect(columns.find((c) => c.key === "solutions")?.links.map((l) => l.label)).toEqual([
      "AI Transformation",
      "Application Modernisation",
    ]);
  });

  it("lists as popular offers only the priority offers by their locked names", () => {
    const columns = buildWhatWeDoColumns({
      ...base,
      offers: [
        offer("a", "Systems Integration"),
        offer("b", "AI Opportunity Assessment"),
        offer("c", "Technology Health Assessment"),
      ],
    });
    expect(columns.find((c) => c.key === "popular-offers")?.links.map((l) => l.label)).toEqual([
      "AI Opportunity Assessment",
      "Technology Health Assessment",
    ]);
  });

  it("omits empty columns and always keeps Explore (How We Work, All What We Do)", () => {
    const columns = buildWhatWeDoColumns(base);
    expect(columns.map((c) => c.key)).toEqual(["explore"]);
    expect(columns[0]?.links).toEqual([
      { key: "how-we-work", label: "How We Work", href: "/how-we-work" },
      { key: "all-what-we-do", label: "All What We Do", href: "/what-we-do" },
    ]);
  });

  it("attaches the menu to What We Do only", () => {
    const { items } = buildHeaderModel(base);
    expect(items.find((item) => item.key === "what-we-do")?.menu).toBeDefined();
    expect(items.find((item) => item.key === "about")?.menu).toBeUndefined();
  });

  it("links each column heading to its index", () => {
    const columns = buildWhatWeDoColumns({
      ...base,
      practices: [summary("p", "Vitalos Consulting")],
      solutions: [summary("s", "AI Transformation")],
      offers: [offer("o", "AI Opportunity Assessment")],
    });
    expect(columns.map((c) => c.href)).toEqual(["/what-we-do", "/solutions", "/offers", undefined]);
  });
});

describe("footer model", () => {
  it("has no gated link and no empty column while everything is closed and empty", () => {
    const { columns, contact, legalIdentity } = buildFooterModel(base);
    const hrefs = columns.flatMap((column) => column.links.map((link) => link.href));
    for (const gated of ["/industries", "/work", "/insights", "/labs", "/careers"]) {
      expect(hrefs).not.toContain(gated);
    }
    expect(columns.every((column) => column.links.length > 0)).toBe(true);
    expect(contact).toEqual({ heading: "Contact" });
    expect(legalIdentity).toBeUndefined();
  });

  it("lists Careers only once there is an open role", () => {
    const closed = buildFooterModel(base).columns.flatMap((c) => c.links.map((l) => l.href));
    const open = buildFooterModel({
      ...base,
      gates: evaluateGates({ careers: 1 }),
    }).columns.flatMap((c) => c.links.map((l) => l.href));
    expect(closed).not.toContain("/careers");
    expect(open).toContain("/careers");
  });

  it("takes the legal identity from site settings only, line by line, without the address", () => {
    const { legalIdentity } = buildFooterModel({
      ...base,
      settings: { legalName: "Example Ltd", companyNumber: "123", registeredAddress: "1 Street" },
    });
    expect(legalIdentity?.lines).toEqual(["Example Ltd", "Company number 123"]);
    const partial = buildFooterModel({ ...base, settings: { legalName: "Example Ltd" } });
    expect(partial.legalIdentity?.lines).toEqual(["Example Ltd"]);
  });

  it("carries the contact email and verified social links from settings", () => {
    const { contact } = buildFooterModel({
      ...base,
      settings: {
        contactEmail: "hello@example.invalid",
        social: [{ label: "Profile", href: "https://example.invalid/p" }],
      },
    });
    expect(contact?.email).toBe("hello@example.invalid");
    expect(contact?.social).toEqual([{ label: "Profile", href: "https://example.invalid/p" }]);
  });

  it("builds trust and legal columns from published summaries", () => {
    const { columns } = buildFooterModel({
      ...base,
      trustTopics: [{ id: "t", topic: "security", title: "Security" }],
      legalPages: [{ id: "l", slug: "privacy", title: "Privacy" }],
    });
    expect(columns.find((c) => c.key === "trust")?.links.map((l) => l.href)).toEqual([
      "/trust",
      "/trust/security",
    ]);
    expect(columns.find((c) => c.key === "legal")?.links).toEqual([
      { label: "Privacy", href: "/legal/privacy" },
    ]);
  });
});

describe("activeSectionForPath", () => {
  it("maps the commercial layers to What We Do", () => {
    for (const path of [
      "/what-we-do",
      "/what-we-do/consulting",
      "/solutions",
      "/solutions/x",
      "/offers/y",
      "/how-we-work",
    ]) {
      expect(activeSectionForPath(path), path).toBe("what-we-do");
    }
  });

  it("maps the other sections and Leadership to About", () => {
    expect(activeSectionForPath("/industries/x")).toBe("industries");
    expect(activeSectionForPath("/work")).toBe("work");
    expect(activeSectionForPath("/insights/x")).toBe("insights");
    expect(activeSectionForPath("/labs/research/x")).toBe("labs");
    expect(activeSectionForPath("/about/leadership")).toBe("about");
  });

  it("has no active section elsewhere, and respects path boundaries", () => {
    expect(activeSectionForPath("/")).toBeUndefined();
    expect(activeSectionForPath("/contact")).toBeUndefined();
    expect(activeSectionForPath("/trust")).toBeUndefined();
    expect(activeSectionForPath("/worksheets")).toBeUndefined();
    expect(activeSectionForPath("/what-we-do/")).toBe("what-we-do");
    expect(activeSectionForPath(null)).toBeUndefined();
  });
});
