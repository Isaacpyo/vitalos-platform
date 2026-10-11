import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyDataset, errorsOf, validateDocument } from "../schemaTypes/testing/validate";
import { draftContent, DRAFT_STATUS, toNdjson, toSanityDocuments } from "./index";

const documents = toSanityDocuments(draftContent);
const withPlaceholders = toSanityDocuments(draftContent, { includePlaceholders: true });
const placeholderTypes = ["person", "insight", "caseStudy", "job"];

describe("Sanity export of the draft content", () => {
  it("exports every draft document once, as an unpublished draft", () => {
    const ids = documents.map((doc) => doc._id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("drafts."))).toBe(true);
    const real = Object.values(draftContent.provenance).filter((entry) => !entry.placeholder);
    expect(documents).toHaveLength(real.length);
    for (const doc of documents) {
      expect(doc["governance"]).toMatchObject({ editorialStatus: "draft" });
      expect(doc["draftProvenance"]).toMatchObject({ status: DRAFT_STATUS });
      expect(doc["locale"]).toBe("en-GB");
    }
  });

  it("passes the Studio validation rules (only the legal effective date is left for the owner)", async () => {
    for (const doc of documents) {
      const errors = errorsOf(await validateDocument(doc, { fetch: emptyDataset }));
      const expected =
        doc._type === "legalPage" ? [{ path: "effectiveDate", message: "Required" }] : [];
      expect(
        errors.map(({ path, message }) => ({ path, message })),
        doc._id,
      ).toEqual(expected);
    }
  });

  it("references only exported documents, weakly, so drafts import in any order", () => {
    const published = new Set(documents.map((doc) => doc._id.replace(/^drafts\./, "")));
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (typeof value === "object" && value !== null) {
        const record = value as Record<string, unknown>;
        if (record["_type"] === "reference") {
          expect(published.has(String(record["_ref"])), String(record["_ref"])).toBe(true);
          expect(record["_weak"]).toBe(true);
        }
        Object.values(record).forEach(visit);
      }
    };
    documents.forEach(visit);
  });

  it("excludes every placeholder document by default (they can never be imported by accident)", () => {
    expect(documents.filter((doc) => placeholderTypes.includes(doc._type))).toEqual([]);
    const text = toNdjson(documents);
    for (const name of ["Alex Morgan", "Sam Rivers", "Jordan Ellis"]) {
      expect(text).not.toContain(name);
    }
    expect(text).not.toMatch(/placeholder": ?true/);
    expect(documents.some((doc) => JSON.stringify(doc).includes("Illustrative scenario"))).toBe(
      false,
    );
  });

  it("includes them, flagged in their provenance, only when asked", () => {
    const extra = withPlaceholders.filter((doc) => placeholderTypes.includes(doc._type));
    expect(extra).toHaveLength(12);
    expect(withPlaceholders).toHaveLength(documents.length + 12);
    for (const doc of extra) {
      expect(doc["draftProvenance"]).toMatchObject({ status: DRAFT_STATUS, placeholder: true });
      expect(doc._id.startsWith("drafts.")).toBe(true);
    }
    // Real documents are unchanged by the flag, except that the Work, Insights and Careers route
    // pages are noindex while placeholders are their only content.
    const realOnly = withPlaceholders.filter((doc) => !placeholderTypes.includes(doc._type));
    const notRoutePage = (doc: (typeof documents)[number]) => doc._type !== "routePage";
    expect(realOnly.filter(notRoutePage)).toEqual(documents.filter(notRoutePage));
    for (const key of ["work", "insights", "careers"]) {
      const id = `drafts.routePage-${key}`;
      const withFlag = realOnly.find((doc) => doc._id === id);
      const without = documents.find((doc) => doc._id === id);
      expect(withFlag?.["seo"], id).toMatchObject({ noindex: true });
      expect(without?.["seo"], id).not.toHaveProperty("noindex");
    }
  });

  it("passes the Studio validation rules with placeholders included", async () => {
    const published = new Set(withPlaceholders.map((doc) => doc._id.replace(/^drafts\./, "")));
    for (const doc of withPlaceholders.filter((d) => placeholderTypes.includes(d._type))) {
      const errors = errorsOf(await validateDocument(doc, { fetch: emptyDataset }));
      expect(
        errors.map(({ path, message }) => ({ path, message })),
        doc._id,
      ).toEqual([]);
    }
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (typeof value === "object" && value !== null) {
        const record = value as Record<string, unknown>;
        if (record["_type"] === "reference") {
          expect(published.has(String(record["_ref"])), String(record["_ref"])).toBe(true);
        }
        Object.values(record).forEach(visit);
      }
    };
    withPlaceholders.forEach(visit);
  });

  it("has no price field anywhere", () => {
    expect(JSON.stringify(documents)).not.toMatch(/"(price|fee|rate)[A-Za-z]*":/i);
  });

  it("matches the committed tooling/content/draft-dataset.ndjson (run export-draft-dataset)", () => {
    const committed = readFileSync(
      new URL("../../../../tooling/content/draft-dataset.ndjson", import.meta.url),
      "utf8",
    );
    expect(committed.replaceAll("\r\n", "\n")).toBe(toNdjson(documents));
  });
});
