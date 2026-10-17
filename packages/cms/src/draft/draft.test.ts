import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createFixtureSource } from "../content/fixture-source";
import { describeContentSourceContract, docKinds } from "../content/testing/contract";
import type { DocKind, ViewFor } from "../content/types";
import {
  homeSections,
  industryNames,
  offerNames,
  practiceDisplayName,
  practiceNames,
  solutionNames,
} from "../locked-copy";
import { routePageKeys, trustTopics } from "../routes";
import { createDraftContentSource, draftContent, DRAFT_LEGAL_MARK, DRAFT_STATUS } from "./index";
import { omittedTrustTopics } from "./content/trust";
import { singletonProvenanceKeys } from "./provenance";

const NOW = () => new Date("2026-10-10T12:00:00Z");
const { set, provenance } = draftContent;
const draftSource = () => createDraftContentSource({ now: NOW });
describeContentSourceContract("Draft content", draftSource, {
  countsPlaceholderCaseStudies: true,
});

const allDocuments = (): { kind: DocKind; doc: ViewFor<DocKind> }[] =>
  docKinds.flatMap((kind) =>
    (set.documents[kind] as readonly ViewFor<DocKind>[]).map((doc) => ({ kind, doc })),
  );

describe("publication gates in the draft source", () => {
  it("opens every gate: the placeholder content opens Work, Insights and Careers", async () => {
    const gates = await draftSource().getPublicationGates();
    expect(gates.open).toEqual({
      work: true,
      insights: true,
      labs: true,
      industries: true,
      careers: true,
    });
    expect(gates.counts).toMatchObject({ work: 2, insights: 6, careers: 1 });
  });

  it("opens Work only through the draft source: other sources ignore placeholder status", async () => {
    // The same set served without the draft-only option (as fixtures or sparse would be).
    const plain = await createFixtureSource(set, { now: NOW }).getPublicationGates();
    expect(plain.open.work).toBe(false);
    expect(plain.counts.work).toBe(0);
  });

  it("drafts only placeholder case studies, insights, people and roles", () => {
    for (const kind of ["caseStudy", "insight", "person", "job"] as const) {
      const list = set.documents[kind] as readonly { placeholder?: true }[];
      expect(list.length, kind).toBeGreaterThan(0);
      expect(
        list.every((doc) => doc.placeholder === true),
        kind,
      ).toBe(true);
    }
    expect(set.documents.person).toHaveLength(3);
    expect(set.documents.insight).toHaveLength(6);
    expect(set.documents.caseStudy).toHaveLength(2);
    expect(set.documents.job).toHaveLength(1);
    // The home page stays free of placeholder content.
    expect(set.home?.selectedWork).toEqual([]);
    expect(set.home?.insights).toEqual([]);
    expect(set.home?.proof).toEqual([]);
  });

  it("keeps draft legal pages out of the sitemap and lists no placeholder page", async () => {
    const entries = await draftSource().getSitemapEntries();
    const kinds = new Set(entries.map((entry) => entry.kind));
    expect(kinds.has("legalPage")).toBe(false);
    expect(kinds.has("practice")).toBe(true);
    expect(kinds.has("labAsset")).toBe(true);
    for (const kind of ["caseStudy", "insight", "person", "job"]) {
      expect(kinds.has(kind as never), kind).toBe(false);
    }
  });
});

describe("placeholder content guardrails", () => {
  const placeholders = (): { kind: DocKind; doc: ViewFor<DocKind> }[] =>
    allDocuments().filter(({ doc }) => (doc as { placeholder?: true }).placeholder === true);

  it("flags exactly the personas, insights, case studies and role", () => {
    expect(new Set(placeholders().map(({ kind }) => kind))).toEqual(
      new Set(["person", "insight", "caseStudy", "job"]),
    );
    expect(placeholders()).toHaveLength(12);
    for (const { doc } of placeholders())
      expect(provenance[doc.id]?.placeholder, doc.id).toBe(true);
  });

  it("is always noindex, on the document and on the sections it opens", () => {
    for (const { doc } of placeholders()) expect(doc.seo.noindex, doc.id).toBe(true);
    for (const key of ["work", "insights", "careers"] as const) {
      expect(set.routePages[key]?.seo.noindex, key).toBe(true);
    }
  });

  it("personas carry no credentials, links, portraits or employers", () => {
    for (const person of set.documents.person) {
      expect(person.credentials).toEqual([]);
      expect(person.sameAs).toEqual([]);
      expect(person.portrait).toBeUndefined();
      expect(JSON.stringify(person)).not.toMatch(/https?:|@|linkedin|university|degree|certif/i);
    }
    expect(set.documents.person.filter((person) => person.isLeadership)).toHaveLength(1);
  });

  it("insights are 900 to 1400 words, authored by a persona, with no figures", () => {
    const people = new Set(set.documents.person.map((person) => person.id));
    const words = (value: unknown): number => {
      const text: string[] = [];
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) node.forEach(walk);
        else if (typeof node === "object" && node !== null) {
          const record = node as Record<string, unknown>;
          if (record["_type"] === "span") text.push(String(record["text"]));
          else Object.values(record).forEach(walk);
        }
      };
      walk(value);
      return text.join(" ").split(/\s+/).filter(Boolean).length;
    };
    for (const insight of set.documents.insight) {
      const count = words(insight.body);
      expect(count, insight.slug).toBeGreaterThanOrEqual(900);
      expect(count, insight.slug).toBeLessThanOrEqual(1400);
      expect(insight.authors.length, insight.slug).toBeGreaterThan(0);
      for (const author of insight.authors) expect(people.has(author.id)).toBe(true);
      expect(JSON.stringify(insight.body), insight.slug).not.toMatch(
        /\d+(\.\d+)?\s?(x|times|per cent|million|billion)\b/i,
      );
    }
  });

  it("case studies are anonymised scenarios with no outcome, metrics or testimonial", () => {
    for (const study of set.documents.caseStudy) {
      expect(study.clientDisplay).toBe("anonymised");
      expect(study.clientName).toBeUndefined();
      expect(study.metrics).toEqual([]);
      expect(study.testimonial).toBeUndefined();
      expect(study.outcome).toBeUndefined();
      expect(study.evidence.status).toBe("pending");
      expect(study.summary).toMatch(/^Illustrative scenario/);
    }
  });

  it("the role has no salary and no application URL, and the page falls back to careers contact", () => {
    for (const job of set.documents.job) {
      expect(job.applicationUrl).toBeUndefined();
      expect(JSON.stringify(job)).not.toMatch(/salary|£|benefits/i);
    }
  });
});

// The strategy library is kept privately and gitignored (ADR-025): provenance is checked only where a
// local copy exists.
const strategyDir = new URL("../../../../docs/strategy/", import.meta.url);
const hasStrategyLibrary = existsSync(strategyDir);

describe.skipIf(!hasStrategyLibrary)("provenance", () => {
  const stageFiles = hasStrategyLibrary ? readdirSync(strategyDir) : [];
  const normalise = (text: string) =>
    text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
  const headingsByStage = new Map<number, Set<string>>();
  const headingsOf = (stage: number): Set<string> => {
    const cached = headingsByStage.get(stage);
    if (cached) return cached;
    const file = stageFiles.find((name) =>
      name.startsWith(`stage-${String(stage).padStart(2, "0")}-`),
    );
    if (!file) throw new Error(`No strategy file for stage ${stage}`);
    const text = readFileSync(
      new URL(`../../../../docs/strategy/${file}`, import.meta.url),
      "utf8",
    );
    const headings = new Set(
      text
        .split("\n")
        .filter((line) => /^#{1,4} /.test(line))
        .map((line) => normalise(line.replace(/^#+ /, ""))),
    );
    headingsByStage.set(stage, headings);
    return headings;
  };

  const expectedKeys = [
    singletonProvenanceKeys.siteSettings,
    singletonProvenanceKeys.homePage,
    ...Object.keys(set.routePages).map(singletonProvenanceKeys.routePage),
    ...allDocuments().map(({ doc }) => doc.id),
  ];

  it("is recorded for every document and for nothing else", () => {
    expect(Object.keys(provenance).sort()).toEqual([...expectedKeys].sort());
  });

  it("marks every document draft-pending-approval with at least one citation", () => {
    for (const key of expectedKeys) {
      const entry = provenance[key];
      expect(entry?.status, key).toBe(DRAFT_STATUS);
      expect(entry?.sources.length, key).toBeGreaterThan(0);
    }
  });

  it("cites sections that exist in the cited stage file", () => {
    for (const [key, entry] of Object.entries(provenance)) {
      for (const source of entry.sources) {
        expect(
          headingsOf(source.stage).has(normalise(source.section)),
          `${key}: Stage ${source.stage} "${source.section}"`,
        ).toBe(true);
      }
    }
  });
});

describe("content hygiene", () => {
  const text = JSON.stringify(set);

  it.each([
    ["lorem", /lorem/i],
    ["TODO", /TODO/],
    ["(fixture)", /\(fixture\)/i],
    ["example.invalid", /example\.invalid/],
    ["a price", /£|\$|€|\bGBP\b/],
    ["a percentage", /\d\s?%/],
    [
      "unsupported superlatives",
      /world-class|industry-leading|best-in-class|cutting[- ]edge|future-proof|seamless/i,
    ],
  ])("contains no %s anywhere in draft content", (_, pattern) => {
    expect(text).not.toMatch(pattern);
  });

  it("states trust controls as standards or targets, never as controls that already exist", () => {
    const trust = JSON.stringify(set.documents.trustItem);
    for (const claim of [
      /Evidence is held/i,
      /supporting evidence, it is shared/i,
      /Vitalos keeps a register/i,
      /Personal data is kept out/i,
      /we will tell you/i,
    ]) {
      expect(trust).not.toMatch(claim);
    }
    expect(trust).toContain("putting in place");
  });

  it("does not repeat a locked string with different wording", () => {
    expect(set.documents.practice.map((p) => p.title)).toEqual(
      practiceNames.map(practiceDisplayName),
    );
    expect(set.documents.solution.map((s) => s.title)).toEqual([...solutionNames]);
    expect(set.documents.industry.map((i) => i.title)).toEqual([...industryNames]);
    const offerTitles = set.documents.offer.map((o) => o.title);
    for (const name of offerNames) expect(offerTitles).toContain(name);
    for (const section of homeSections) {
      if ("visibleHeading" in section) {
        expect(set.home?.headings[section.key], section.key).toBe(section.visibleHeading);
      }
    }
  });

  it("keeps SEO within the schema limits", () => {
    const seos = [
      ...allDocuments().map(({ doc }) => doc.seo),
      ...Object.values(set.routePages).map((page) => page?.seo),
    ];
    for (const seo of seos) {
      expect(seo?.title?.length ?? 0).toBeLessThanOrEqual(60);
      expect(seo?.description?.length ?? 0).toBeLessThanOrEqual(160);
    }
  });
});

describe("document shapes", () => {
  it("five practice pages (Labs, the sixth practice, is /labs) with 4-6 problems, 6-10 capabilities, a body and solutions", () => {
    expect(set.documents.practice).toHaveLength(5);
    for (const practice of set.documents.practice) {
      expect(practice.problems.length).toBeGreaterThanOrEqual(4);
      expect(practice.problems.length).toBeLessThanOrEqual(6);
      expect(practice.capabilities.length).toBeGreaterThanOrEqual(6);
      expect(practice.capabilities.length).toBeLessThanOrEqual(10);
      expect(practice.body?.length).toBeGreaterThan(0);
      expect(practice.solutions.length).toBeGreaterThan(0);
    }
  });

  it("six solutions with signals, impact, approach, 4-6 phases, an FAQ and at least one offer", () => {
    expect(set.documents.solution).toHaveLength(6);
    for (const solution of set.documents.solution) {
      expect(solution.signals.length).toBeGreaterThan(0);
      expect(solution.impact).toBeTruthy();
      expect(solution.approach?.length).toBeGreaterThan(0);
      expect(solution.phases.length).toBeGreaterThanOrEqual(4);
      expect(solution.phases.length).toBeLessThanOrEqual(6);
      expect(solution.faq.length).toBeGreaterThan(0);
      expect(solution.offers.length).toBeGreaterThan(0);
    }
  });

  it("thirteen offers, none orphaned, none priced", () => {
    expect(set.documents.offer).toHaveLength(13);
    for (const offer of set.documents.offer) {
      expect(offer.solutions.length + offer.practices.length).toBeGreaterThan(0);
      expect(offer.outputs.length).toBeGreaterThan(0);
      expect(Object.keys(offer).some((key) => /price|fee|cost|rate/i.test(key))).toBe(false);
    }
  });

  it("every industry with realities and problems", () => {
    expect(set.documents.industry).toHaveLength(4);
    for (const industry of set.documents.industry) {
      expect(industry.realities.length).toBeGreaterThan(0);
      expect(industry.problems.length).toBeGreaterThan(0);
    }
  });

  it("six trust topics as public summaries; certifications and subprocessors are not drafted", () => {
    expect(set.documents.trustItem.map((item) => item.topic)).toEqual(
      trustTopics.filter((topic) => topic !== "certifications" && topic !== "subprocessors"),
    );
    expect(Object.keys(omittedTrustTopics).sort()).toEqual(["certifications", "subprocessors"]);
    for (const item of set.documents.trustItem) {
      expect(item.publicSummary?.length).toBeGreaterThan(0);
      expect(item.certifications).toEqual([]);
      expect(item.subprocessors).toEqual([]);
      expect(item.contactEmail).toBeUndefined();
    }
  });

  it("lab assets only at research or concept maturity, with limitations and no links", () => {
    expect(set.documents.labAsset.length).toBeGreaterThan(0);
    for (const lab of set.documents.labAsset) {
      expect(["research", "concept"]).toContain(lab.maturity);
      expect(lab.limitations.length).toBeGreaterThan(40);
      expect(lab.repoUrl).toBeUndefined();
      expect(lab.demoUrl).toBeUndefined();
    }
  });

  it("legal pages are marked not in force, unindexed and full of placeholders", () => {
    expect(set.documents.legalPage).toHaveLength(5);
    for (const legal of set.documents.legalPage) {
      expect(legal.title).toContain(DRAFT_LEGAL_MARK);
      expect(legal.seo.noindex).toBe(true);
      expect(legal.effectiveDate).toBe("");
      expect(JSON.stringify(legal.body)).toMatch(/\[[^\]]+\]/);
    }
  });

  it("route pages for every key, and How We Work describes all nine stages", () => {
    expect(Object.keys(set.routePages).sort()).toEqual([...routePageKeys].sort());
    const body = JSON.stringify(set.routePages["how-we-work"]?.body);
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
      expect(body).toContain(`"text":"${stage}"`);
    }
    expect(set.routePages.contact?.routes.length).toBe(9);
  });

  it("site settings hold only facts the specs state", () => {
    expect(Object.keys(set.settings)).toEqual(["defaultSeo"]);
  });
});
