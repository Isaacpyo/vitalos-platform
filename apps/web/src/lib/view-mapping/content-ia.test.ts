import { describe, expect, it } from "vitest";
import { closedGates, evaluateGates } from "@vitalos/cms";
import type { CtaView, LabAssetSummary, OfferView } from "@vitalos/cms";
import { repoContent } from "@vitalos/cms/repo";
import { aboutLinks, companyFacts, splitAtPracticesSection } from "../../templates/about/map";
import { offerNextSteps } from "../../templates/offer/OfferTemplate";
import { anchorSlug } from "../../features/faq/faq-groups";
import { ctaToLink } from "./hrefs";
import { proofApproachItems } from "./proof-approach";
import { labsPracticeItem, sixPracticeShowcaseItems } from "./showcase";
import { firstSentence } from "./text";

const routePage = (key: keyof typeof repoContent.routePages) => repoContent.routePages[key];
const labs = (maturity: LabAssetSummary["maturity"]): LabAssetSummary =>
  ({
    id: "a",
    slug: "a",
    title: "Asset (fixture)",
    labType: "research",
    maturity,
  }) as LabAssetSummary;

describe("Vitalos Labs as the sixth practice (decision 1)", () => {
  const open = evaluateGates({ labs: 1 });

  it("links to /labs with the first sentence of the Labs page introduction", () => {
    const item = labsPracticeItem(open, routePage("labs")?.intro);
    expect(item).toMatchObject({ title: "Vitalos Labs", href: "/labs", icon: "flask" });
    expect(item?.summary).toBe(
      "Vitalos Labs explores emerging technology, builds reference architectures and tests ideas before they become client capabilities or products.",
    );
    // No illustration until the Labs artwork exists (WS1): the stage shows the icon.
    expect(item?.image).toBeUndefined();
  });

  it("is left out while the Labs gate is closed and when there are no other practices", () => {
    expect(labsPracticeItem(closedGates, "x")).toBeNull();
    expect(sixPracticeShowcaseItems([], { gates: open, intro: "x" })).toEqual([]);
    const six = sixPracticeShowcaseItems([{ id: "c", slug: "c", title: "Vitalos Consulting" }], {
      gates: open,
      intro: "x",
    });
    expect(six.map((item) => item.href)).toEqual(["/what-we-do/c", "/labs"]);
  });
});

describe("How we prove it (finding B3)", () => {
  const input = {
    gates: evaluateGates({ labs: 1 }),
    howWeWorkBody: routePage("how-we-work")?.body,
    labsBody: routePage("labs")?.body,
    labAssets: [labs("concept"), labs("concept")],
    trustBody: routePage("trust")?.body,
    insightsIntro: routePage("insights")?.intro,
  };

  it("quotes the quality gates, Labs and the Trust Centre from their own pages", () => {
    const items = proofApproachItems(input);
    expect(items.map((item) => [item.key, item.href])).toEqual([
      ["quality-gates", "/how-we-work"],
      ["labs", "/labs"],
      ["trust", "/trust"],
    ]);
    expect(items[0]?.text).toMatch(/^Before production or acceptance, work passes gates/);
    expect(items[1]?.text).toBe(
      "Each asset states what it is, what it is not and its known limitations.",
    );
    expect(items[1]?.meta).toBe("Maturity: Concept");
    expect(items[2]?.text).toBe(
      "Each topic shows its public summary, and only verified certifications will ever be listed.",
    );
  });

  it("adds Insights only while that section is open, and never mentions clients or Work", () => {
    const open = proofApproachItems({
      ...input,
      gates: evaluateGates({ labs: 1, insights: 6 }),
    });
    expect(open.at(-1)?.href).toBe("/insights");
    const all = JSON.stringify(open);
    expect(all).not.toMatch(/case stud|client logo|\/work/i);
  });

  it("leaves out an item whose source text is missing", () => {
    expect(proofApproachItems({ gates: closedGates })).toEqual([]);
  });
});

describe("calls to action open the form on their topic (finding B13)", () => {
  const cta = (intent: CtaView["intent"]): CtaView => ({
    label: "Discuss",
    href: "/contact",
    intent,
  });

  it("adds the content's intent to contact links", () => {
    expect(ctaToLink(cta("engineering"))?.href).toBe("/contact?intent=engineering");
    expect(ctaToLink(cta(undefined))?.href).toBe("/contact");
  });

  it("opens an offer page's form on that offer", () => {
    expect(ctaToLink(cta("ai"), { offerSlug: "ai-opportunity-assessment" })?.href).toBe(
      "/contact?intent=offer&offer=ai-opportunity-assessment",
    );
  });

  it("leaves other destinations alone", () => {
    expect(ctaToLink({ label: "Labs", href: "/labs", intent: "explore" })?.href).toBe("/labs");
  });
});

describe("offer: what happens next (finding B9)", () => {
  it("steps from the enquiry to the offer's scope and its next phase, from existing copy", () => {
    const offer = repoContent.documents.offer[0] as OfferView;
    const steps = offerNextSteps(offer);
    expect(steps.map((step) => step.title)).toEqual(["Talk to Vitalos", offer.title, "Next phase"]);
    expect(steps[1]?.summary).toBe(offer.scope);
    expect(steps[2]?.summary).toBe(offer.nextStep);
    expect(JSON.stringify(steps)).not.toMatch(/£|\bweeks?\b|\bdays\b/);
  });
});

describe("About (finding B4)", () => {
  it("splits the body around its six-practices section", () => {
    const { before, intro, after } = splitAtPracticesSection(routePage("about")?.body);
    expect(before.length).toBeGreaterThan(0);
    expect(intro).toMatch(/^Our six practices share one delivery lifecycle/);
    expect(after.length).toBeGreaterThan(0);
  });

  it("states the company facts without the registered address", () => {
    const facts = companyFacts(repoContent.settings);
    expect(facts.map((fact) => fact.term)).toEqual([
      "Legal name",
      "Company number",
      "Based in",
      "Contact",
    ]);
    expect(JSON.stringify(facts)).not.toMatch(/DN5|Doncaster|High Street/);
  });

  it("gives each onward card the first sentence of its page's introduction", () => {
    const links = aboutLinks(closedGates, {
      "how-we-work": routePage("how-we-work")?.intro,
      trust: routePage("trust")?.intro,
    });
    expect(links[0]?.description).toBe("Start with consulting or come straight to engineering.");
    expect(links.map((link) => link.key)).toEqual(["how-we-work", "trust"]);
  });
});

describe("helpers", () => {
  it("takes the first sentence", () => {
    expect(firstSentence("One. Two.")).toBe("One.");
    expect(firstSentence("One only")).toBe("One only");
    expect(firstSentence("  ")).toBeUndefined();
  });

  it("makes stable FAQ anchors", () => {
    expect(anchorSlug("What does an AI Opportunity Assessment cost & include?")).toBe(
      "what-does-an-ai-opportunity-assessment-cost-and-include",
    );
    expect(anchorSlug("???")).toBe("question");
  });
});
