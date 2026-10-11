import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyDataset, errorsOf, validateDocument } from "../schemaTypes/testing/validate";
import { draftContent, DRAFT_STATUS, toNdjson, toSanityDocuments } from "./index";

const documents = toSanityDocuments(draftContent);

describe("Sanity export of the draft content", () => {
  it("exports every draft document once, as an unpublished draft", () => {
    const ids = documents.map((doc) => doc._id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("drafts."))).toBe(true);
    expect(documents).toHaveLength(Object.keys(draftContent.provenance).length);
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
