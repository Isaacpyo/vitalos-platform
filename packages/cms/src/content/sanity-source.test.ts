import { describe, expect, it, vi } from "vitest";
import { createSanityContentSource } from "./sanity-source";
import type { SanityFetcher } from "./sanity-source";
import {
  caseStudyQuery,
  gateCountsQuery,
  labAssetQuery,
  practiceQuery,
  practiceSummariesQuery,
  previewEditorialStatuses,
  publicEditorialStatuses,
  routePageQuery,
  trustItemQuery,
} from "../queries";

const NOW = () => new Date("2026-10-10T23:59:00Z");

function sourceWith(result: unknown) {
  const fetcher = vi.fn<SanityFetcher>(() => Promise.resolve(result));
  return { fetcher, source: createSanityContentSource(fetcher, { now: NOW }) };
}

describe("createSanityContentSource", () => {
  it("passes the published statuses, today's date and the slug as params", async () => {
    const { fetcher, source } = sourceWith(null);
    await expect(source.getDocument("practice", "example")).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      practiceQuery,
      { statuses: publicEditorialStatuses, today: "2026-10-10", slug: "example" },
      expect.objectContaining({ preview: false }),
    );
    expect(publicEditorialStatuses).toEqual(["approved"]);
  });

  it("widens the statuses in preview but never to archived", async () => {
    const { fetcher, source } = sourceWith(null);
    await source.getDocument("practice", "example", { preview: true });
    const [, params, opts] = fetcher.mock.calls[0] ?? [];
    expect(params).toMatchObject({ statuses: previewEditorialStatuses });
    expect(opts).toMatchObject({ preview: true });
    expect(previewEditorialStatuses).not.toContain("archived");
  });

  it("does not query for identifiers that cannot match", async () => {
    const { fetcher, source } = sourceWith(null);
    await expect(source.getDocument("practice", "Not A Slug!")).resolves.toBeNull();
    await expect(source.getDocument("trustItem", "made-up" as never)).resolves.toBeNull();
    await expect(source.getDocument("legalPage", "made-up" as never)).resolves.toBeNull();
    await expect(
      source.getDocument("labAsset", "ok", { labType: "made-up" as never }),
    ).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("addresses lab assets by type and slug, and trust items by topic", async () => {
    const { fetcher, source } = sourceWith(null);
    await source.getDocument("labAsset", "tool", { labType: "open-source" });
    await source.getDocument("trustItem", "security");
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      labAssetQuery,
      expect.objectContaining({ slug: "tool", labType: "open-source" }),
      expect.objectContaining({ preview: false }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      trustItemQuery,
      expect.objectContaining({ topic: "security" }),
      expect.objectContaining({ preview: false }),
    );
  });

  it("tags reads with the document type and slug for webhook invalidation", async () => {
    const { fetcher, source } = sourceWith(null);
    await source.getDocument("practice", "example");
    await source.listSummaries("caseStudy");
    await source.getDocument("trustItem", "security");
    await source.getRoutePage("work");
    expect(fetcher.mock.calls.map((call) => call[2]?.tags)).toEqual([
      ["sanity:practice", "sanity:practice:example"],
      ["sanity:caseStudy"],
      ["sanity:trustItem", "sanity:trustItem:security"],
      ["sanity:routePage", "sanity:routePage:work"],
    ]);
  });

  it("accepts the web app's cached fetcher shape", async () => {
    // Mirrors apps/web/src/lib/cms/fetch.ts (ADR-018): generic result, optional params and options.
    type WebFetcher = <T = unknown>(
      query: string,
      params?: Record<string, unknown>,
      options?: { tags?: readonly string[]; preview?: boolean },
    ) => Promise<T>;
    const webFetcher: WebFetcher = () => Promise.resolve(null as never);
    await expect(
      createSanityContentSource(webFetcher).getDocument("practice", "x"),
    ).resolves.toBeNull();
  });

  it("uses the injected clock for expiry checks", async () => {
    const { fetcher, source } = sourceWith({});
    await source.getPublicationGates();
    expect(fetcher).toHaveBeenCalledWith(
      gateCountsQuery,
      expect.objectContaining({ today: "2026-10-10" }),
      expect.objectContaining({ preview: false }),
    );
  });

  it("asks for the route page by key", async () => {
    const { fetcher, source } = sourceWith(null);
    await source.getRoutePage("how-we-work");
    expect(fetcher).toHaveBeenCalledWith(
      routePageQuery,
      expect.objectContaining({ key: "how-we-work" }),
      expect.objectContaining({ preview: false }),
    );
  });

  it("builds static params from published summaries", async () => {
    const approved = (slug: string) => ({
      id: slug,
      editorialStatus: "approved",
      slug,
      title: slug,
    });
    const { fetcher, source } = sourceWith([
      approved("a"),
      approved("b"),
      approved("a"),
      { ...approved("c"), editorialStatus: "draft" },
    ]);
    await expect(source.listParams("practice")).resolves.toEqual([{ slug: "a" }, { slug: "b" }]);
    expect(fetcher).toHaveBeenCalledWith(
      practiceSummariesQuery,
      expect.anything(),
      expect.objectContaining({ preview: false }),
    );
  });

  it("treats unexpected result shapes as no content rather than throwing", async () => {
    for (const result of [undefined, null, "oops", 42, [], {}]) {
      const { source } = sourceWith(result);
      await expect(source.getDocument("practice", "x")).resolves.toBeNull();
      await expect(source.listSummaries("practice")).resolves.toEqual([]);
      await expect(source.getHomePage()).resolves.toBeNull();
      await expect(source.getSitemapEntries()).resolves.toEqual([]);
      const gates = await source.getPublicationGates();
      expect(Object.values(gates.open).some(Boolean)).toBe(false);
    }
  });

  it("propagates fetch failures so the page can show its error state", async () => {
    const source = createSanityContentSource(() => Promise.reject(new Error("network")));
    await expect(source.getDocument("practice", "x")).rejects.toThrow("network");
  });

  it("filters a hostile result: controlled, archived and unverified content never gets through", async () => {
    const secret = "REF-SECRET-0001";
    const hostile = {
      id: "cs",
      editorialStatus: "approved",
      slug: "cs",
      title: "Hostile",
      engagementBasis: "contracted-by-vitalos",
      clientDisplay: "named",
      clientName: "Real Client Ltd",
      namedPermitted: false,
      evidence: { evidenceStatus: "verified", classification: "public", evidenceReference: secret },
      evidenceReference: secret,
      permissionEvidence: { evidenceStatus: "verified", evidenceReference: secret },
      testimonial: { quote: "q", attribution: "a", permissionStatus: "pending" },
    };
    const { fetcher, source } = sourceWith(hostile);
    const view = await source.getDocument("caseStudy", "cs");
    expect(fetcher).toHaveBeenCalledWith(
      caseStudyQuery,
      expect.anything(),
      expect.objectContaining({ preview: false }),
    );
    expect(view?.clientDisplay).toBe("anonymised");
    expect(JSON.stringify(view)).not.toContain(secret);
    expect(JSON.stringify(view)).not.toContain("Real Client");
    expect(view?.testimonial).toBeUndefined();

    const controlled = sourceWith({
      ...hostile,
      evidence: { ...hostile.evidence, classification: "controlled" },
    });
    await expect(controlled.source.getDocument("caseStudy", "cs")).resolves.toBeNull();
    const archived = sourceWith({ ...hostile, editorialStatus: "archived" });
    await expect(archived.source.getDocument("caseStudy", "cs")).resolves.toBeNull();
  });
});
