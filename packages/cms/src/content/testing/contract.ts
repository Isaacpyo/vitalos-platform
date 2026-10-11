/**
 * The shared `ContentSource` contract: properties every implementation must satisfy, whatever
 * content it holds. Run against the empty, fixture and Sanity sources.
 */
import { describe, expect, it } from "vitest";
import { GATE_THRESHOLDS, gateForKind, gateKeys } from "../gates";
import type { ContentSource } from "../source";
import { routePageKeys } from "../../routes";
import type { LabType } from "../../routes";
import type { DocKind, ViewFor } from "../types";

export const docKinds: readonly DocKind[] = [
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

/** Keys that must never appear in anything a source returns. */
export const forbiddenKeys = [
  "evidenceReference",
  "evidenceOwner",
  "permissionEvidence",
  "classification",
  "editorialStatus",
  "governance",
] as const;

export interface ContractOptions {
  /** The source holds no content at all. */
  empty?: boolean;
  /** Which gates are expected to be open (omit to skip the check). */
  gates?: "closed" | "open";
}

/** Reads a document the way the web app does, from a `listParams` entry. */
async function getFromParams(source: ContentSource, kind: DocKind, params: Record<string, string>) {
  switch (kind) {
    case "trustItem":
      return source.getDocument("trustItem", params.topic as never);
    case "legalPage":
      return source.getDocument("legalPage", params.slug as never);
    case "labAsset":
      return source.getDocument("labAsset", params.slug as string, {
        labType: params.type as LabType,
      });
    default:
      return source.getDocument(kind as "practice", params.slug as string);
  }
}

const collectKeys = (value: unknown, found = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) value.forEach((entry) => collectKeys(entry, found));
  else if (typeof value === "object" && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      found.add(key);
      collectKeys(entry, found);
    }
  }
  return found;
};

export function describeContentSourceContract(
  name: string,
  create: () => ContentSource,
  options: ContractOptions = {},
): void {
  describe(`ContentSource contract: ${name}`, () => {
    const source = create();

    it("reports gates consistent with their thresholds and with getSiteChrome", async () => {
      const gates = await source.getPublicationGates();
      const chrome = await source.getSiteChrome();
      expect(chrome.gates).toEqual(gates);
      for (const key of gateKeys) {
        expect(gates.open[key]).toBe(gates.counts[key] >= GATE_THRESHOLDS[key]);
      }
      if (options.gates === "open") expect(Object.values(gates.open).every(Boolean)).toBe(true);
      if (options.gates === "closed") expect(Object.values(gates.open).some(Boolean)).toBe(false);
      await expect(source.getPublicationGates({ preview: true })).resolves.toBeDefined();
    });

    it("lists unique params, every one resolving to a document with a matching summary", async () => {
      for (const kind of docKinds) {
        const params = await source.listParams(kind);
        const keys = params.map((entry) => JSON.stringify(entry));
        expect(new Set(keys).size, `${kind} params are unique`).toBe(keys.length);
        const summaries = await source.listSummaries(kind);
        const summaryIds = summaries.map((summary) => summary.id);
        expect(new Set(summaryIds).size, `${kind} summary ids are unique`).toBe(summaryIds.length);
        // Closed roles keep a page but leave the index, so params may exceed summaries for jobs.
        expect(params.length).toBeGreaterThanOrEqual(summaries.length);
        for (const entry of params) {
          for (const value of Object.values(entry)) expect(value).toMatch(/\S/);
          const doc = await getFromParams(source, kind, entry);
          expect(doc, `${kind} ${JSON.stringify(entry)}`).not.toBeNull();
        }
        for (const summary of summaries) {
          const matching = await Promise.all(
            params.map((entry) => getFromParams(source, kind, entry)),
          );
          expect(
            matching.some((doc) => doc !== null && doc.id === summary.id),
            `${kind} summary ${summary.id} has a detail document`,
          ).toBe(true);
        }
      }
    });

    it("returns null for unknown documents", async () => {
      for (const kind of docKinds) {
        if (kind === "trustItem" || kind === "legalPage" || kind === "labAsset") continue;
        await expect(
          source.getDocument(kind as "practice", "no-such-slug-here"),
        ).resolves.toBeNull();
      }
      await expect(
        source.getDocument("labAsset", "nope", { labType: "research" }),
      ).resolves.toBeNull();
      await expect(source.getDocument("legalPage", "terms")).resolves.toSatisfy(
        (doc: unknown) => doc === null || (doc as { slug: string }).slug === "terms",
      );
      // Not a slug at all: never reaches the CMS.
      await expect(source.getDocument("practice", "Not A Slug!")).resolves.toBeNull();
    });

    it("looks lab assets up by type and slug", async () => {
      const params = await source.listParams("labAsset");
      for (const entry of params) {
        const other: ViewFor<"labAsset"> | null = await source.getDocument(
          "labAsset",
          entry.slug as string,
          { labType: entry.type === "research" ? "experiments" : "research" },
        );
        expect(other !== null && other.slug === entry.slug && other.labType === entry.type).toBe(
          false,
        );
      }
    });

    it("counts gates from the documents it serves", async () => {
      const gates = await source.getPublicationGates();
      const verified = await countWhere(
        source,
        "caseStudy",
        (doc) => doc.evidence.status === "verified",
      );
      expect(gates.counts.work).toBe(verified);
      expect(gates.counts.insights).toBe(
        await countWhere(source, "insight", (doc) => doc.authors.length > 0),
      );
      expect(gates.counts.labs).toBe((await source.listParams("labAsset")).length);
      expect(gates.counts.industries).toBe((await source.listParams("industry")).length);
      expect(gates.counts.careers).toBe(
        await countWhere(source, "job", (doc) => doc.status === "open"),
      );
    });

    it("keeps closed gates out of the sitemap and never lists a path twice", async () => {
      const gates = await source.getPublicationGates();
      const sitemap = await source.getSitemapEntries();
      const paths = sitemap.map((entry) => entry.path);
      expect(new Set(paths).size).toBe(paths.length);
      for (const entry of sitemap) {
        expect(entry.path.startsWith("/")).toBe(true);
        const gate = gateForKind(entry.kind);
        if (gate !== undefined) expect(gates.open[gate], `${entry.kind} gate`).toBe(true);
      }
    });

    it("serves route pages under their own key", async () => {
      for (const key of routePageKeys) {
        const page = await source.getRoutePage(key);
        if (page !== null) expect(page.key).toBe(key);
      }
    });

    it("never exposes evidence pointers, classifications or governance data", async () => {
      const everything: unknown[] = [
        await source.getSiteChrome(),
        await source.getHomePage(),
        await source.getSitemapEntries(),
      ];
      for (const key of routePageKeys) everything.push(await source.getRoutePage(key));
      for (const kind of docKinds) {
        everything.push(await source.listSummaries(kind));
        for (const entry of await source.listParams(kind)) {
          everything.push(await getFromParams(source, kind, entry));
        }
      }
      const keys = collectKeys(everything);
      for (const forbidden of forbiddenKeys) expect(keys.has(forbidden), forbidden).toBe(false);
      expect(JSON.stringify(everything)).not.toContain("drafts.");
    });

    it("accepts preview reads", async () => {
      await expect(source.getHomePage({ preview: true })).resolves.toBeDefined();
      await expect(source.listSummaries("practice", { preview: true })).resolves.toBeInstanceOf(
        Array,
      );
    });

    if (options.empty) {
      it("holds nothing", async () => {
        await expect(source.getHomePage()).resolves.toBeNull();
        await expect(source.getSitemapEntries()).resolves.toEqual([]);
        for (const kind of docKinds) {
          await expect(source.listParams(kind)).resolves.toEqual([]);
          await expect(source.listSummaries(kind)).resolves.toEqual([]);
        }
      });
    }
  });
}

async function countWhere<K extends "caseStudy" | "insight" | "job">(
  source: ContentSource,
  kind: K,
  predicate: (doc: ViewFor<K>) => boolean,
): Promise<number> {
  const params = await source.listParams(kind);
  let count = 0;
  for (const entry of params) {
    const doc = (await getFromParams(source, kind, entry)) as ViewFor<K> | null;
    if (doc && predicate(doc)) count += 1;
  }
  return count;
}
