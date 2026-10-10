import { describe, expect, it } from "vitest";
import type { LabAssetSummary, LabAssetView } from "@vitalos/cms";
import { fullFixtureSet } from "@vitalos/cms/fixtures";
import {
  isIsNotItems,
  isLabType,
  labFilterGroups,
  labRowProps,
  maturityLabel,
  resourceLinks,
  typesWithAssets,
} from "./map";

const [concept, prototype] = fullFixtureSet.documents.labAsset as [LabAssetView, LabAssetView];

const summary = (asset: LabAssetView): LabAssetSummary => ({
  id: asset.id,
  slug: asset.slug,
  title: asset.title,
  labType: asset.labType,
  maturity: asset.maturity,
});

describe("lab mapping", () => {
  it("validates the lab type", () => {
    expect(isLabType("open-source")).toBe(true);
    expect(isLabType("made-up")).toBe(false);
    expect(isLabType("")).toBe(false);
  });

  it("states maturity in words, from the locked labels", () => {
    expect(maturityLabel("beta")).toBe("Beta / Pilot");
    expect(maturityLabel("production-product")).toBe("Production product");
  });

  it("builds a row with type, canonical link and maturity", () => {
    const row = labRowProps(summary(concept));
    expect(row.href).toBe(`/labs/${concept.labType}/${concept.slug}`);
    expect(row.eyebrow).toBe("Reference Architectures");
    expect(row.maturity).toBe("concept");
    expect(row.maturityLabel).toBe("Concept");
  });

  it("lists only types that have assets", () => {
    expect(typesWithAssets([summary(prototype)])).toEqual(["open-source"]);
    expect(typesWithAssets([])).toEqual([]);
  });

  it("offers a maturity filter only when maturities differ", () => {
    expect(labFilterGroups([summary(concept)])).toEqual([]);
    expect(labFilterGroups([summary(concept), summary(prototype)])[0]?.options).toHaveLength(2);
  });
});

describe("is / is not", () => {
  it("returns only the statements that exist", () => {
    expect(isIsNotItems(concept).map((item) => item.term)).toEqual([
      "What it is",
      "What it is not",
    ]);
    expect(isIsNotItems(prototype)).toEqual([]);
    expect(isIsNotItems({ ...concept, isNot: "  " }).map((item) => item.term)).toEqual([
      "What it is",
    ]);
  });
});

describe("resource links", () => {
  it("includes repository and demo links when present", () => {
    expect(resourceLinks(prototype)?.map((link) => link.label)).toEqual(["Repository", "Demo"]);
  });

  it("returns nothing without links", () => {
    expect(resourceLinks(concept)).toBeUndefined();
  });

  it("refuses links that are not plain https URLs", () => {
    const unsafe = {
      ...prototype,
      repoUrl: "javascript:alert(1)",
      demoUrl: "http://example.invalid/demo",
    } as LabAssetView;
    expect(resourceLinks(unsafe)).toBeUndefined();
    expect(
      resourceLinks({
        ...prototype,
        repoUrl: "https://user:pw@example.invalid/x",
        demoUrl: undefined,
      } as unknown as LabAssetView),
    ).toBeUndefined();
  });
});
