import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { homeSections } from "../locked-copy";
import { labTypes, legalSlugs, routePageKeys, trustTopics } from "../routes";
import { documentTypeNames, singletonTypes } from "./constants";
import { homeSectionsInitialValue } from "./documents/institutional";
import { documentTypes, objectTypes, schemaTypes } from "./index";
import { FIXTURE_TODAY, validDocs, type ValidDocType } from "./testing/fixtures";
import { emptyDataset, errorsOf, validateDocument } from "./testing/validate";

interface Def {
  name: string;
  type: string;
  fields?: Def[];
  of?: Def[];
  initialValue?: unknown;
  hidden?: unknown;
  readOnly?: unknown;
  options?: { list?: { value: string }[] };
}

const defs = schemaTypes as unknown as Def[];
const docs = documentTypes as unknown as Def[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${FIXTURE_TODAY}T12:00:00Z`));
});
afterEach(() => vi.useRealTimers());

describe("schema set", () => {
  it("defines every object and document in the plan, once", () => {
    const names = defs.map((def) => def.name);
    expect(new Set(names).size).toBe(names.length);
    for (const object of [
      "seo",
      "governance",
      "evidence",
      "cta",
      "approvedImage",
      "richText",
      "callout",
      "pullQuote",
      "figure",
      "codeBlock",
      "dataTable",
      "stat",
      "outcomeMetric",
      "testimonial",
      "hero",
    ]) {
      expect(objectTypes.map((def) => def.name)).toContain(object);
    }
    expect(docs.map((def) => def.name)).toEqual([...documentTypeNames]);
  });

  it("gives every content document a hidden, read-only en-GB locale", () => {
    for (const doc of docs) {
      const locale = doc.fields?.find((field) => field.name === "locale");
      expect(locale, doc.name).toBeDefined();
      expect(locale?.hidden, doc.name).toBe(true);
      expect(locale?.readOnly, doc.name).toBe(true);
      expect(locale?.initialValue, doc.name).toBe("en-GB");
    }
  });

  it("gives every document governance, and every page document SEO (settings carry default SEO)", () => {
    for (const doc of docs) {
      const names = doc.fields?.map((field) => field.name) ?? [];
      expect(names, doc.name).toContain("governance");
      if (doc.name !== "redirect") {
        expect(names.includes("seo") || names.includes("defaultSeo"), doc.name).toBe(true);
      }
    }
  });

  it("has no price-like field anywhere on offers (Stage 8 §12)", () => {
    const offer = docs.find((doc) => doc.name === "offer");
    const seen: string[] = [];
    const visit = (def: Def | undefined) => {
      if (!def) return;
      seen.push(def.name);
      def.fields?.forEach(visit);
      def.of?.forEach(visit);
    };
    visit(offer);
    expect(seen.length).toBeGreaterThan(10);
    expect(seen.filter((name) => /price|pricing|cost|fee|rate|budget/i.test(name))).toEqual([]);
  });

  it("uses lab types, topics, route keys and legal slugs from routes.ts", () => {
    const list = (doc: string, field: string) =>
      docs
        .find((entry) => entry.name === doc)
        ?.fields?.find((entry) => entry.name === field)
        ?.options?.list?.map((item) => item.value);
    expect(list("labAsset", "labType")).toEqual([...labTypes]);
    expect(list("trustItem", "topic")).toEqual([...trustTopics]);
    expect(list("routePage", "routeKey")).toEqual([...routePageKeys]);
    expect(list("labAsset", "maturity")).toEqual([
      "research",
      "concept",
      "prototype",
      "accelerator",
      "beta",
      "production-product",
    ]);
    expect(legalSlugs).toContain("privacy");
  });

  it("marks exactly the homepage and site settings as singletons", () => {
    expect([...singletonTypes]).toEqual(["homePage", "siteSettings"]);
  });
});

describe("homepage section headings", () => {
  it("come from locked-copy as Studio initial values only", () => {
    const initial = homeSectionsInitialValue();
    expect(initial.map((entry) => entry.sectionKey)).toEqual(homeSections.map((s) => s.key));
    for (const section of homeSections) {
      const entry = initial.find((candidate) => candidate.sectionKey === section.key);
      if ("visibleHeading" in section) {
        expect(entry).toMatchObject({ visibleHeading: section.visibleHeading });
      } else {
        expect(entry).not.toHaveProperty("visibleHeading");
      }
    }
  });

  it("is wired as the array field's initialValue, not as a validation default", () => {
    const field = docs
      .find((doc) => doc.name === "homePage")
      ?.fields?.find((entry) => entry.name === "homeSections");
    expect(field?.initialValue).toBe(homeSectionsInitialValue);
  });
});

describe("valid artificial documents", () => {
  it.each(Object.keys(validDocs) as ValidDocType[])("%s passes with no errors", async (type) => {
    const findings = await validateDocument(validDocs[type](), {
      fetch: emptyDataset,
    });
    expect(errorsOf(findings)).toEqual([]);
  });
});
