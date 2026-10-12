import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { closedGates, evaluateGates, homeSections } from "@vitalos/cms";
import type { HomePageView, PublicationGates } from "@vitalos/cms";
import { fullFixtureSet, sparseFixtureSet } from "@vitalos/cms/fixtures";
import { HowWeWorkTemplate } from "./how-we-work/HowWeWorkTemplate";
import { HomeTemplate } from "./home/HomeTemplate";
import { homeBands } from "./home/sections";
import { IndustryTemplate } from "./industry/IndustryTemplate";
import { OfferTemplate, engagementSummary } from "./offer/OfferTemplate";
import { PracticeTemplate } from "./practice/PracticeTemplate";
import { SolutionTemplate } from "./solution/SolutionTemplate";

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);
const count = (markup: string, pattern: RegExp) => (markup.match(pattern) ?? []).length;

const openGates = evaluateGates({ work: 3, insights: 7, labs: 2, industries: 2, careers: 1 });
const fullHome = fullFixtureSet.home as HomePageView;
const sparseHome = sparseFixtureSet.home as HomePageView;

const emptyHome: HomePageView = {
  seo: {},
  headings: {},
  proof: [],
  solutions: [],
  practices: [],
  selectedWork: [],
  industries: [],
  labs: [],
  insights: [],
  leadership: [],
  trustHighlights: [],
};

const context = (home: HomePageView, gates: PublicationGates, howWeWorkIntro?: string) => ({
  home,
  gates,
  howWeWorkIntro,
});

describe("homepage sections", () => {
  it("has the thirteen Stage 8 sections: hero, eleven bands, final conversion", () => {
    expect(homeBands).toHaveLength(homeSections.length - 2);
  });

  it("returns null from every band when the home page has no data", () => {
    for (const band of homeBands) {
      expect(band(context(emptyHome, openGates, "intro"), "light")).toBeNull();
    }
  });

  it("renders every band from the full fixtures when the gates are open", () => {
    const ctx = context(fullHome, openGates, "Example how-we-work intro");
    const rendered = homeBands.map((band) => band(ctx, "light"));
    expect(rendered.every((node) => node !== null)).toBe(true);
  });

  it("drops work, industries, labs and insights while their gates are closed, even with data", () => {
    const markup = html(
      <HomeTemplate home={fullHome} gates={closedGates} howWeWorkIntro="intro" />,
    );
    for (const heading of ["Selected work", "Industries", "Labs", "Insights"]) {
      expect(markup).not.toContain(`${heading} (fixture)`);
    }
    expect(markup).not.toContain("/work/");
    expect(markup).not.toContain("/labs/");
    expect(markup).not.toContain("/insights/");
    // Ungated sections still render.
    expect(markup).toContain("Problems (fixture)");
    expect(markup).toContain("Practices (fixture)");
  });

  it("renders no heading for a section whose heading is not authored", () => {
    const markup = html(<HomeTemplate home={sparseHome} gates={closedGates} />);
    expect(count(markup, /<section/g)).toBe(0);
    expect(markup).not.toMatch(/Problems we solve|Five practices, one firm/);
  });

  it("renders only the locked hero when there is no home document", () => {
    const markup = html(<HomeTemplate home={null} gates={closedGates} />);
    expect(count(markup, /<h1/g)).toBe(1);
    expect(count(markup, /<h2/g)).toBe(0);
    // The h1 is exactly the locked proposition (its words are settle spans, ADR-024); only the
    // closing clause, "Adopt AI.", is in the colour of a link.
    const h1 = /<h1[^>]*>(.*?)<\/h1>/.exec(markup)?.[1] ?? "";
    expect(h1.split(/<[^>]*>/).join("")).toBe("Modernise. Build. Adopt AI.");
    const accented = [...h1.matchAll(/<span[^>]*text-tone-link[^>]*>([^<]*)<\/span>/g)].map(
      (match) => match[1],
    );
    expect(accented).toEqual(["Adopt", "AI."]);
    expect(h1).not.toMatch(/opacity/);
    expect(markup).toContain("From strategy to production.");
    expect(markup).not.toContain("Technology Consulting, Engineering");
    expect(markup).not.toMatch(/aria-label="Breadcrumb"/);
    expect(markup).toContain('href="/contact"');
    expect(markup).toContain('href="/what-we-do"');
  });

  it("uses the locked proposition as the only h1 and the brand line as supporting text", () => {
    const markup = html(<HomeTemplate home={fullHome} gates={openGates} howWeWorkIntro="x" />);
    expect(count(markup, /<h1/g)).toBe(1);
    const h1 = /<h1[^>]*>(.*?)<\/h1>/.exec(markup)?.[1] ?? "";
    expect(h1.split(/<[^>]*>/).join("")).toBe("Modernise. Build. Adopt AI.");
    expect(markup).not.toMatch(/<h1[^>]*>From strategy to production/);
  });

  it("shows a credibility strip only for verified proof", () => {
    const pending = {
      ...fullHome,
      proof: [{ label: "Pending", evidence: { status: "pending" as const } }],
    };
    const markup = html(<HomeTemplate home={pending} gates={openGates} />);
    expect(markup).not.toContain("Pending");
  });

  it("needs both the authored heading and the How We Work intro for 'from strategy to production'", () => {
    const withHeading = { ...emptyHome, headings: { strategyToProduction: "Heading" } };
    expect(homeBands[2]?.(context(withHeading, openGates), "light")).toBeNull();
    expect(homeBands[2]?.(context(withHeading, openGates, "Intro"), "light")).not.toBeNull();
    expect(homeBands[2]?.(context(emptyHome, openGates, "Intro"), "light")).toBeNull();
  });

  it("closes with the CMS call to action, falling back to the locked one", () => {
    const withHeading = { ...emptyHome, headings: { finalConversion: "Final" } };
    const fallback = html(<HomeTemplate home={withHeading} gates={closedGates} />);
    expect(fallback).toContain("Talk to Vitalos");
    const custom = html(
      <HomeTemplate
        home={{ ...withHeading, finalCta: { label: "Custom action", href: "/contact?intent=ai" } }}
        gates={closedGates}
      />,
    );
    expect(custom).toContain("Custom action");
    const none = html(<HomeTemplate home={emptyHome} gates={closedGates} />);
    expect(none).not.toContain("Final");
  });
});

describe("practice template", () => {
  const [practice] = fullFixtureSet.documents.practice;
  const [sparsePractice] = sparseFixtureSet.documents.practice;

  it("renders one h1, one main and the sections the content has", () => {
    const markup = html(<PracticeTemplate practice={practice!} gates={openGates} />);
    expect(count(markup, /<h1/g)).toBe(1);
    expect(count(markup, /<main/g)).toBe(1);
    for (const heading of [
      "Problems",
      "Capabilities",
      "Related offers",
      "Industries",
      "Selected work",
    ]) {
      expect(markup).toContain(`>${heading}</h2>`);
    }
  });

  it("hides industries and work while their gates are closed", () => {
    const markup = html(<PracticeTemplate practice={practice!} gates={closedGates} />);
    expect(markup).not.toContain(">Industries</h2>");
    expect(markup).not.toContain(">Selected work</h2>");
    expect(markup).not.toContain("/industries/");
    expect(markup).not.toContain("/work/");
  });

  it("omits empty sections", () => {
    const visitor = html(<PracticeTemplate practice={sparsePractice!} gates={closedGates} />);
    expect(visitor).not.toContain(">Problems</h2>");
    expect(visitor).not.toContain("data-content-gap");
  });

  it("falls back to the locked call to action when the CMS has none", () => {
    const markup = html(<PracticeTemplate practice={sparsePractice!} gates={closedGates} />);
    expect(markup).toContain("Talk to Vitalos");
  });
});

describe("solution template", () => {
  it("renders the journey, offers and questions from the full fixture", () => {
    const [solution] = fullFixtureSet.documents.solution;
    const markup = html(<SolutionTemplate solution={solution!} gates={openGates} />);
    expect(count(markup, /<h1/g)).toBe(1);
    expect(markup).toContain(">Typical journey</h2>");
    expect(markup).toContain(">Related offers</h2>");
    expect(markup).toContain(">Common questions</h2>");
    expect(markup).toContain("Example question (fixture)?");
  });

  it("keeps only what the sparse fixture has: the statement and its required offer", () => {
    const [solution] = sparseFixtureSet.documents.solution;
    const markup = html(<SolutionTemplate solution={solution!} gates={closedGates} />);
    expect(markup).toContain("Example problem statement (fixture)");
    expect(markup).toContain(">Related offers</h2>");
    expect(markup).not.toContain(">Typical journey</h2>");
    expect(markup).not.toContain(">Common questions</h2>");
  });
});

describe("offer template", () => {
  const [offer] = fullFixtureSet.documents.offer;

  it("shows the engagement summary as a definition list and carries no price", () => {
    const markup = html(<OfferTemplate offer={offer!} />);
    expect(markup).toContain("<dl");
    expect(markup).toContain("Who this is for");
    expect(markup).toContain("Short engagement");
    expect(markup).not.toMatch(/[£$€]|\bprice\b|\bpricing\b/i);
  });

  it("pre-selects the offer in the enquiry form through the call to action", () => {
    const markup = html(<OfferTemplate offer={offer!} />);
    expect(markup).toContain("/contact?intent=offer&amp;offer=example-offer");
  });

  it("leaves out summary rows the offer does not have", () => {
    const summary = engagementSummary({ ...offer!, trigger: " ", durationCategory: "" });
    expect(summary.map((item) => item.term)).toEqual([
      "Who this is for",
      "What Vitalos does",
      "How this connects to the next phase",
    ]);
  });
});

describe("industry template", () => {
  const [industry] = fullFixtureSet.documents.industry;

  it("shows work and insights only through open gates", () => {
    const open = html(<IndustryTemplate industry={industry!} gates={openGates} />);
    expect(open).toContain(">Selected work</h2>");
    expect(open).toContain(">Insights</h2>");
    const closed = html(<IndustryTemplate industry={industry!} gates={closedGates} />);
    expect(closed).not.toContain(">Selected work</h2>");
    expect(closed).not.toContain(">Insights</h2>");
    expect(closed).toContain(">Sector realities</h2>");
  });
});

describe("how we work template", () => {
  it("lists the nine locked stages with or without a CMS page", () => {
    const without = html(<HowWeWorkTemplate page={null} />);
    for (const stage of [
      "Qualify",
      "Discover",
      "Define",
      "Design",
      "Engineer",
      "Validate",
      "Release",
      "Operate",
      "Improve",
    ]) {
      expect(without).toContain(`>${stage}</h2>`);
    }
    expect(without).toContain("<h1");
    expect(without).toContain(">How We Work</h1>");
  });

  it("shows a stage description only when the CMS wrote one", () => {
    const page = {
      key: "how-we-work" as const,
      heading: "Heading",
      seo: {},
      body: [
        {
          _type: "block",
          _key: "a",
          style: "h2",
          markDefs: [],
          children: [{ _type: "span", _key: "s", text: "Discover", marks: [] }],
        },
        {
          _type: "block",
          _key: "b",
          style: "normal",
          markDefs: [],
          children: [{ _type: "span", _key: "s2", text: "We look closely.", marks: [] }],
        },
      ],
    };
    const markup = html(<HowWeWorkTemplate page={page} />);
    expect(markup).toContain("We look closely.");
    expect(count(markup, /We look closely\./g)).toBe(1);
  });

  it("shows no editor notice for missing stage descriptions", () => {
    expect(html(<HowWeWorkTemplate page={null} />)).not.toContain("data-content-gap");
  });
});
