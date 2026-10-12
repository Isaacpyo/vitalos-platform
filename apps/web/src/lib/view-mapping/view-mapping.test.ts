import { describe, expect, it } from "vitest";
import type {
  CaseStudySummary,
  CtaView,
  InsightSummary,
  LabAssetSummary,
  OfferSummary,
  PersonSummary,
  ProofItemView,
  RichText,
  SolutionSummary,
  TrustTopicSummary,
} from "@vitalos/cms";
import { crumbsToJsonLd, crumbsToUi, trail } from "./breadcrumbs";
import { contactHref, ctaToLink, hrefForSummary } from "./hrefs";
import { durationLabel, engagementBasisLabel } from "./labels";
import { orderByLockedNames, pickByLockedNames } from "./ordering";
import {
  caseStudyMeta,
  labAssetPresentation,
  toArticleRow,
  toLinkCard,
  toOfferRow,
  toOutcomeStat,
  toPatternImage,
  toPersonCard,
  toProofStripItems,
  toRailItems,
  toRow,
  toRows,
} from "./patterns";
import { deriveStages } from "./stages";

const solution = (slug: string, title = `Solution ${slug}`): SolutionSummary => ({
  id: slug,
  slug,
  title,
  summary: `About ${slug}`,
});

describe("hrefForSummary", () => {
  it("builds URLs through routes.ts for every routed kind", () => {
    expect(hrefForSummary("practice", solution("consulting"))).toBe("/what-we-do/consulting");
    expect(hrefForSummary("solution", solution("ai"))).toBe("/solutions/ai");
    expect(hrefForSummary("offer", solution("assessment"))).toBe("/offers/assessment");
    expect(hrefForSummary("industry", solution("health"))).toBe("/industries/health");
    expect(
      hrefForSummary("caseStudy", { ...solution("one"), engagementBasis: "contracted-by-vitalos" }),
    ).toBe("/work/one");
    expect(hrefForSummary("person", solution("jo"))).toBe("/people/jo");
  });

  it("needs the lab type for a lab asset and the topic for a trust topic", () => {
    const lab: LabAssetSummary = {
      ...solution("tool"),
      labType: "open-source",
      maturity: "prototype",
    };
    expect(hrefForSummary("labAsset", lab)).toBe("/labs/open-source/tool");
    expect(hrefForSummary("labAsset", { ...lab, labType: undefined } as never)).toBeNull();
    const topic: TrustTopicSummary = { id: "t", topic: "security", title: "Security" };
    expect(hrefForSummary("trustItem", topic)).toBe("/trust/security");
    expect(hrefForSummary("trustItem", { id: "t", title: "x" } as never)).toBeNull();
  });

  it("encodes the slug and returns null without one", () => {
    expect(hrefForSummary("practice", solution("a b"))).toBe("/what-we-do/a%20b");
    expect(hrefForSummary("practice", { ...solution("x"), slug: "" })).toBeNull();
  });
});

describe("ctaToLink", () => {
  const cta = (href: string, label = "Talk"): CtaView => ({ label, href });

  it("keeps same-site paths and https URLs", () => {
    expect(ctaToLink(cta("/contact"))).toEqual({ label: "Talk", href: "/contact" });
    expect(ctaToLink(cta("https://example.invalid/x"))).toEqual({
      label: "Talk",
      href: "https://example.invalid/x",
    });
  });

  it("drops unsafe targets, empty labels and missing CTAs", () => {
    expect(ctaToLink(cta("javascript:alert(1)"))).toBeUndefined();
    expect(ctaToLink(cta("//evil.invalid"))).toBeUndefined();
    expect(ctaToLink(cta("http://example.invalid"))).toBeUndefined();
    expect(ctaToLink(cta("/contact", "  "))).toBeUndefined();
    expect(ctaToLink(undefined)).toBeUndefined();
  });
});

describe("contactHref", () => {
  it("carries the intent and the offer slug", () => {
    expect(contactHref()).toBe("/contact");
    expect(contactHref("ai")).toBe("/contact?intent=ai");
    expect(contactHref("offer", "ai-opportunity-assessment")).toBe(
      "/contact?intent=offer&offer=ai-opportunity-assessment",
    );
    expect(contactHref("offer", "a&b")).toBe("/contact?intent=offer&offer=a%26b");
  });
});

describe("ordering by locked names", () => {
  const titles = ["Vitalos Managed Services", "Vitalos AI & Data", "Something else", "Consulting"];
  const items = titles.map((title) => ({ title }));
  const names = ["Consulting", "Engineering", "AI & Data", "Experience", "Managed Services"];

  it("follows the locked order, accepts the Vitalos prefix, and keeps unknown items last", () => {
    expect(orderByLockedNames(items, names).map((i) => i.title)).toEqual([
      "Consulting",
      "Vitalos AI & Data",
      "Vitalos Managed Services",
      "Something else",
    ]);
  });

  it("is stable for items that match nothing and never drops any", () => {
    const unknown = [{ title: "b" }, { title: "a" }];
    expect(orderByLockedNames(unknown, names)).toEqual(unknown);
    expect(orderByLockedNames(items, names)).toHaveLength(items.length);
  });

  it("picks only the named items", () => {
    expect(pickByLockedNames(items, names).map((i) => i.title)).toEqual([
      "Consulting",
      "Vitalos AI & Data",
      "Vitalos Managed Services",
    ]);
    expect(pickByLockedNames([{ title: "Example Offer (fixture)" }], names)).toEqual([]);
  });
});

describe("rows and cards", () => {
  it("maps a summary to row props with its route", () => {
    expect(toRow("solution", solution("ai"))).toEqual({
      title: "Solution ai",
      href: "/solutions/ai",
      summary: "About ai",
    });
  });

  it("omits optional props rather than passing undefined", () => {
    const row = toRow("solution", { id: "x", slug: "x", title: "X" });
    expect(row).toEqual({ title: "X", href: "/solutions/x" });
    expect(Object.keys(row ?? {})).not.toContain("summary");
  });

  it("drops summaries that cannot be linked or have no title", () => {
    expect(
      toRows("solution", [solution("a"), { ...solution("b"), slug: "" }, solution("c")]),
    ).toHaveLength(2);
    expect(toRow("solution", { ...solution("a"), title: " " })).toBeNull();
  });

  it("shows the duration category of an offer as a labelled fact and never a price", () => {
    const offer: OfferSummary = { ...solution("o"), durationCategory: "short" };
    const row = toOfferRow(offer);
    expect(row?.meta).toEqual([{ label: "Typical duration", value: "Short engagement" }]);
    expect(JSON.stringify(row)).not.toMatch(/price|£|\$|€/i);
    expect(toOfferRow(solution("no-duration"))?.meta).toBeUndefined();
  });

  it("builds link cards only for the supported kinds", () => {
    expect(toLinkCard("solution", solution("ai"))?.kind).toBe("solution");
    expect(
      toLinkCard("caseStudy", { ...solution("c"), engagementBasis: "contracted-by-vitalos" })?.kind,
    ).toBe("case-study");
    expect(toLinkCard("offer", solution("o"))).toBeNull();
  });

  it("returns undefined for an empty rail so no empty module is rendered", () => {
    expect(toRailItems("solution", [])).toBeUndefined();
    expect(toRailItems("solution", [solution("a")])).toHaveLength(1);
  });
});

describe("labels", () => {
  it("labels known duration categories and shows unknown ones as authored", () => {
    expect(durationLabel("ongoing")).toBe("Ongoing");
    expect(durationLabel("medium")).toBe("Medium engagement");
    expect(durationLabel("quarterly")).toBe("quarterly");
    expect(durationLabel("  ")).toBeUndefined();
    expect(durationLabel(undefined)).toBeUndefined();
  });

  it("states the engagement basis plainly", () => {
    expect(engagementBasisLabel("contracted-by-vitalos")).toBe("Contracted by Vitalos");
    expect(engagementBasisLabel("prior-team-experience")).toBe("Prior team experience");
  });
});

describe("case studies, labs, insights, people", () => {
  const study: CaseStudySummary = {
    ...solution("cs"),
    engagementBasis: "prior-team-experience",
    clientLabel: "Example sector",
  };

  it("states the engagement basis beside the client label", () => {
    expect(caseStudyMeta(study)).toEqual([
      { label: "Client", value: "Example sector" },
      { label: "Basis", value: "Prior team experience" },
    ]);
    const withoutClient = { ...solution("cs2"), engagementBasis: "contracted-by-vitalos" as const };
    expect(caseStudyMeta(withoutClient)).toHaveLength(1);
  });

  it("states lab maturity in words with the locked labels", () => {
    const lab: LabAssetSummary = { ...solution("l"), labType: "demonstrators", maturity: "beta" };
    expect(labAssetPresentation(lab)).toEqual({
      eyebrow: "Demonstrators",
      maturity: "beta",
      maturityLabel: "Beta / Pilot",
    });
  });

  it("maps an insight to an article row with plain author names", () => {
    const author: PersonSummary = { ...solution("jo"), title: "Jo Example" };
    const insight: InsightSummary = {
      ...solution("in"),
      format: "executive-briefing",
      publishedAt: "2026-03-01",
      authors: [author],
    };
    const row = toArticleRow(insight);
    expect(row?.href).toBe("/insights/in");
    expect(row?.eyebrow).toBe("Executive briefing");
    expect(row?.authors).toEqual([{ name: "Jo Example" }]);
    expect(row?.publishedAt).toBe("2026-03-01");
  });

  it("maps a person to a card, with a portrait only when it can be shown", () => {
    const person: PersonSummary = { ...solution("jo"), title: "Jo Example", role: "Founder" };
    expect(toPersonCard(person)).toEqual({
      name: "Jo Example",
      href: "/people/jo",
      role: "Founder",
    });
    const withBad = {
      ...person,
      portrait: { url: "https://evil.invalid/a.jpg", alt: "x", width: 1, height: 1 },
    };
    expect(toPersonCard(withBad)?.portrait).toBeUndefined();
  });
});

describe("images", () => {
  const image = {
    url: "/images/a-800x600.jpg",
    alt: "Alt",
    width: 800,
    height: 600,
  };

  it("passes only images the CSP allows and that can be described", () => {
    expect(toPatternImage(image)?.url).toBe(image.url);
    expect(toPatternImage({ ...image, url: "https://evil.invalid/a.jpg" })).toBeUndefined();
    expect(toPatternImage({ ...image, alt: " " })).toBeUndefined();
    expect(toPatternImage({ ...image, alt: "", decorative: true })?.decorative).toBe(true);
    expect(toPatternImage({ ...image, width: 0 })).toBeUndefined();
    expect(toPatternImage(undefined)).toBeUndefined();
  });
});

describe("proof and outcomes", () => {
  const marker = (label: string, status: "verified" | "pending" | "n/a"): ProofItemView => ({
    label,
    evidence: { status },
  });

  it("keeps verified proof markers only and is undefined when none remain", () => {
    expect(toProofStripItems([marker("A", "verified"), marker("B", "pending")])).toEqual([
      { label: "A", evidence: { status: "verified" } },
    ]);
    expect(toProofStripItems([marker("B", "pending")])).toBeUndefined();
    expect(toProofStripItems([])).toBeUndefined();
  });

  it("passes a metric through with its source", () => {
    expect(
      toOutcomeStat({
        value: "3x",
        descriptor: "faster",
        source: "Fixture",
        evidence: { status: "verified" },
      }),
    ).toEqual({
      value: "3x",
      descriptor: "faster",
      source: "Fixture",
      evidence: { status: "verified" },
    });
  });
});

describe("breadcrumbs", () => {
  it("always starts at Home and gives every step a path", () => {
    const crumbs = trail({ label: "What We Do", path: "/what-we-do" });
    expect(crumbs[0]).toEqual({ label: "Home", path: "/" });
    expect(crumbsToUi(crumbs)).toEqual([
      { label: "Home", href: "/" },
      { label: "What We Do", href: "/what-we-do" },
    ]);
    expect(crumbsToJsonLd(crumbs)).toEqual([
      { name: "Home", path: "/" },
      { name: "What We Do", path: "/what-we-do" },
    ]);
  });
});

describe("deriveStages", () => {
  const names = ["Qualify", "Discover", "Define"];
  const heading = (text: string, style = "h2"): RichText[number] => ({
    _type: "block",
    _key: `h-${text}`,
    style,
    children: [{ _type: "span", _key: "s", text, marks: [] }],
    markDefs: [],
  });
  const para = (text: string): RichText[number] => ({
    _type: "block",
    _key: `p-${text}`,
    style: "normal",
    children: [{ _type: "span", _key: "s", text, marks: [] }],
    markDefs: [],
  });

  it("returns every locked stage in order even without a body", () => {
    expect(deriveStages(undefined, names).stages).toEqual([
      { title: "Qualify" },
      { title: "Discover" },
      { title: "Define" },
    ]);
  });

  it("takes each description from the blocks under the stage heading", () => {
    const { stages, lead } = deriveStages(
      [
        para("Intro text"),
        heading("Discover"),
        para("We look closely."),
        para("Then we ask."),
        heading("qualify", "h3"),
        para("Is it a fit?"),
      ],
      names,
    );
    expect(lead).toHaveLength(1);
    expect(stages).toEqual([
      { title: "Qualify", summary: "Is it a fit?" },
      { title: "Discover", summary: "We look closely.\n\nThen we ask." },
      { title: "Define" },
    ]);
  });

  it("keeps stage order from the locked list, not from the body", () => {
    const { stages } = deriveStages(
      [heading("Define"), para("D"), heading("Qualify"), para("Q")],
      names,
    );
    expect(stages.map((stage) => stage.title)).toEqual(names);
  });

  it("does not treat a normal paragraph that names a stage as a heading", () => {
    const { stages, lead } = deriveStages([para("Discover"), para("text")], names);
    expect(lead).toHaveLength(2);
    expect(stages.every((stage) => stage.summary === undefined)).toBe(true);
  });
});
