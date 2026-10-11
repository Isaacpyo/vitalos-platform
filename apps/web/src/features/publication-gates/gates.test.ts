import { describe, expect, it } from "vitest";
import { closedGates, evaluateGates, gateKeys, routeManifest } from "@vitalos/cms";
import { indexIsServable } from "./gates";
import { gateForPath, gateForRoutePage, manifestEntryForPath } from "./route-gates";

describe("route gates", () => {
  it("maps route-page keys to their gate", () => {
    expect(gateForRoutePage("work")).toBe("work");
    expect(gateForRoutePage("insights")).toBe("insights");
    expect(gateForRoutePage("labs")).toBe("labs");
    expect(gateForRoutePage("industries")).toBe("industries");
    expect(gateForRoutePage("careers")).toBe("careers");
    expect(gateForRoutePage("about")).toBeUndefined();
    expect(gateForRoutePage("leadership")).toBeUndefined();
    expect(gateForRoutePage("how-we-work")).toBeUndefined();
    expect(gateForRoutePage("contact")).toBeUndefined();
  });

  it("maps concrete paths through the manifest", () => {
    expect(gateForPath("/work/example")).toBe("work");
    expect(gateForPath("/labs/research/example")).toBe("labs");
    expect(gateForPath("/labs/research")).toBe("labs");
    expect(gateForPath("/careers/example")).toBe("careers");
    expect(gateForPath("/what-we-do/consulting")).toBeUndefined();
    expect(gateForPath("/people/example")).toBeUndefined();
  });

  it("knows the manifest and nothing else", () => {
    expect(manifestEntryForPath("/")?.pattern).toBe("/");
    expect(manifestEntryForPath("/legal/privacy")?.pattern).toBe("/legal/[slug]");
    expect(manifestEntryForPath("/nope")).toBeUndefined();
    expect(manifestEntryForPath("/what-we-do/a/b")).toBeUndefined();
  });

  it("covers every gate key from the manifest", () => {
    const gatesInManifest = new Set(
      routeManifest.flatMap((entry) => (entry.gate ? [entry.gate] : [])),
    );
    expect([...gatesInManifest].sort()).toEqual([...gateKeys].sort());
  });
});

describe("indexIsServable", () => {
  it("serves ungated sections always", () => {
    expect(indexIsServable(undefined, closedGates)).toBe(true);
  });

  it("serves a gated index only when its gate is open", () => {
    expect(indexIsServable("work", closedGates)).toBe(false);
    expect(indexIsServable("work", evaluateGates({ work: 1 }))).toBe(false);
    expect(indexIsServable("work", evaluateGates({ work: 2 }))).toBe(true);
    expect(indexIsServable("insights", evaluateGates({ insights: 5 }))).toBe(false);
    expect(indexIsServable("insights", evaluateGates({ insights: 6 }))).toBe(true);
  });

  it("lets editors preview a closed section in Draft Mode only", () => {
    expect(indexIsServable("work", closedGates, { draft: true })).toBe(true);
    expect(indexIsServable("work", closedGates, { draft: false })).toBe(false);
  });
});
