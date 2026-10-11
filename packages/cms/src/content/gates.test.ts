import { describe, expect, it } from "vitest";
import { filterNavByGates, primaryNav, ctaNav, utilityNav } from "../navigation";
import {
  GATE_THRESHOLDS,
  closedGates,
  evaluateGates,
  gateForKind,
  isDetailIndexable,
  isGateOpen,
  isNavVisible,
  isSitemapEligible,
  shouldServeIndex,
} from "./gates";

describe("publication gate thresholds", () => {
  it("encode the spec minimums", () => {
    expect(GATE_THRESHOLDS).toEqual({ work: 2, insights: 6, labs: 1, industries: 1, careers: 1 });
  });

  it("opens exactly at the threshold", () => {
    expect(isGateOpen("work", 1)).toBe(false);
    expect(isGateOpen("work", 2)).toBe(true);
    expect(isGateOpen("insights", 5)).toBe(false);
    expect(isGateOpen("insights", 6)).toBe(true);
    expect(isGateOpen("labs", 0)).toBe(false);
    expect(isGateOpen("careers", 1)).toBe(true);
  });

  it("never opens on invalid counts", () => {
    expect(isGateOpen("labs", Number.NaN)).toBe(false);
    expect(isGateOpen("labs", -1)).toBe(false);
  });
});

describe("evaluateGates", () => {
  it("treats missing counts as zero and starts fully closed", () => {
    expect(closedGates.open).toEqual({
      work: false,
      insights: false,
      labs: false,
      industries: false,
      careers: false,
    });
    expect(evaluateGates({ labs: 1 }).open.labs).toBe(true);
    expect(evaluateGates({ labs: 1 }).counts.work).toBe(0);
  });
});

describe("gate decisions", () => {
  const gates = evaluateGates({ work: 1, insights: 6 });

  it("maps document kinds to gates", () => {
    expect(gateForKind("caseStudy")).toBe("work");
    expect(gateForKind("insight")).toBe("insights");
    expect(gateForKind("labAsset")).toBe("labs");
    expect(gateForKind("industry")).toBe("industries");
    expect(gateForKind("job")).toBe("careers");
    expect(gateForKind("practice")).toBeUndefined();
    expect(gateForKind("constructor")).toBeUndefined();
  });

  it("hides nav, 404s the index, noindexes details and drops sitemap entries below threshold", () => {
    expect(isNavVisible("work", gates)).toBe(false);
    expect(shouldServeIndex("work", gates)).toBe(false);
    expect(isDetailIndexable("work", gates)).toBe(false);
    expect(isSitemapEligible("work", gates)).toBe(false);
  });

  it("publishes everything for an open gate and for ungated sections", () => {
    expect(isNavVisible("insights", gates)).toBe(true);
    expect(shouldServeIndex("insights", gates)).toBe(true);
    expect(isDetailIndexable(undefined, gates)).toBe(true);
    expect(isSitemapEligible(undefined, closedGates)).toBe(true);
  });
});

describe("navigation", () => {
  const labels = (keys: readonly { label: string }[]) => keys.map((item) => item.label);

  it("shows only ungated primary items when every gate is closed", () => {
    expect(labels(filterNavByGates(primaryNav, closedGates))).toEqual(["What We Do", "About"]);
  });

  it("shows every primary item in spec order when every gate is open", () => {
    const open = evaluateGates({ work: 2, insights: 6, labs: 1, industries: 1, careers: 1 });
    expect(labels(filterNavByGates(primaryNav, open))).toEqual([
      "What We Do",
      "Industries",
      "Work",
      "Insights",
      "Labs",
      "About",
    ]);
  });

  it("carries the utility link and primary CTA from locked copy", () => {
    expect(labels(utilityNav)).toEqual(["Trust Centre"]);
    expect(ctaNav.label).toBe("Talk to Vitalos");
    expect(ctaNav.href).toBe("/contact");
  });
});
