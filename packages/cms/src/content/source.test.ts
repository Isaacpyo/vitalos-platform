import { describe, expect, it } from "vitest";
import { closedGates } from "./gates";
import { EmptyContentSource } from "./source";
import type { ContentSource } from "./source";
import type { DocKind } from "./types";

const kinds: DocKind[] = [
  "practice",
  "solution",
  "offer",
  "industry",
  "caseStudy",
  "insight",
  "person",
  "labAsset",
  "trustItem",
  "job",
  "legalPage",
];

describe("EmptyContentSource", () => {
  const source: ContentSource = new EmptyContentSource();

  it("returns an empty site chrome with every gate closed", async () => {
    await expect(source.getSiteChrome()).resolves.toEqual({ settings: {}, gates: closedGates });
    await expect(source.getPublicationGates({ preview: true })).resolves.toEqual(closedGates);
  });

  it("has no home page or route pages (callers render locked copy only)", async () => {
    await expect(source.getHomePage()).resolves.toBeNull();
    await expect(source.getRoutePage("contact")).resolves.toBeNull();
    await expect(source.getRoutePage("trust")).resolves.toBeNull();
  });

  it.each(kinds)("has no %s documents, summaries or params", async (kind) => {
    await expect(source.getDocument(kind as "practice", "anything")).resolves.toBeNull();
    await expect(source.listSummaries(kind)).resolves.toEqual([]);
    await expect(source.listParams(kind)).resolves.toEqual([]);
  });

  it("has an empty sitemap", async () => {
    await expect(source.getSitemapEntries()).resolves.toEqual([]);
  });

  it("types document lookups unambiguously", async () => {
    // Lab asset slugs are unique per lab type only, so the type is mandatory.
    await expect(
      source.getDocument("labAsset", "x", { labType: "reference-architectures" }),
    ).resolves.toBeNull();
    // @ts-expect-error labType is required for lab assets
    await source.getDocument("labAsset", "x");
    // Trust items are addressed by topic and legal pages by their fixed slug.
    await expect(source.getDocument("trustItem", "security")).resolves.toBeNull();
    // @ts-expect-error not a trust topic
    await source.getDocument("trustItem", "made-up");
    await expect(source.getDocument("legalPage", "privacy")).resolves.toBeNull();
    // @ts-expect-error not a legal slug
    await source.getDocument("legalPage", "made-up");
  });
});
