import { describe, expect, it } from "vitest";
import { MemoryRelayStore } from "../db/memory";
import { nullEmbedder } from "../retrieval/embed";
import { checksumOf } from "./checksum";
import {
  canonicalPath,
  holdReasons,
  mapFaqRow,
  nextStepFor,
  plainText,
  sectionOrder,
  stripConfirmBlocks,
} from "./faq";
import type { FaqRow } from "./faq";
import { ingestEntries } from "./ingest";

const routes = new Set([
  "/",
  "/about",
  "/trust/certifications",
  "/trust/security",
  "/trust",
  "/offers/ai-opportunity-assessment",
  "/offers/engineering-rescue",
  "/offers/data-bi-modernisation",
  "/labs",
]);
const routeExists = (p: string) => routes.has(p);

const row = (over: Partial<FaqRow> = {}): FaqRow => ({
  notionPageId: "3fae4b34-11f9-8047-8753-d29bc287b2e0",
  notionUrl: "https://app.notion.com/p/3fae4b3411f980478753d29bc287b2e0",
  lastEditedAt: null,
  id: "TRU-02",
  question: "Is Vitalos ISO 27001 certified?",
  section: "10. Trust Centre",
  shortAnswer: "No. Vitalos is not ISO/IEC 27001 certified.",
  fullAnswer: "Cyber Essentials comes first, then ISO 27001 readiness when demand justifies it.",
  status: "Verified",
  pagePlacement: ["/trust/certifications", "/trust/security"],
  linkedOfferCta: "Talk to Vitalos",
  audienceTags: ["Security / IT reviewer"],
  source: "S06 §13 internal reference",
  confirmNote: "internal note that must never leak",
  ...over,
});

describe("plain text and whitespace", () => {
  it("joins Notion rich text plain_text and normalises whitespace", () => {
    expect(plainText([{ plain_text: "Hello  " }, { plain_text: "\n\n\nworld\u202E" }, {}])).toBe(
      "Hello\n\nworld",
    );
  });
});

describe("stripConfirmBlocks", () => {
  it("removes a simple block", () => {
    expect(
      stripConfirmBlocks("We start with discovery [CONFIRM: check scope] and agree a plan."),
    ).toBe("We start with discovery and agree a plan.");
  });
  it("removes nested brackets and line breaks", () => {
    expect(
      stripConfirmBlocks(
        "Assessments [CONFIRM: internal S04 floors\n[see table] about £3,500] are scoped.",
      ),
    ).toBe("Assessments are scoped.");
  });
  it("is case-insensitive and removes several blocks", () => {
    expect(stripConfirmBlocks("A [confirm: x] B [ CONFIRM : y [z] ] C")).toBe("A B C");
  });
  it("fails closed on an unterminated block", () => {
    expect(stripConfirmBlocks("Safe part. [CONFIRM: never closed £9,999 internal")).toBe(
      "Safe part.",
    );
  });
});

describe("holdReasons", () => {
  it.each([
    ["Please CONFIRM this", "contains CONFIRM"],
    ["TODO: write", "contains TODO"],
    ["Price TBC", "contains TBC"],
    ["Registered as [COMPANY NUMBER]", "contains a bracketed placeholder"],
    ["Costs £3,500", "contains a currency amount"],
    ["From $ 20k", "contains a currency amount"],
    ["About €900", "contains a currency amount"],
    ["Our day rate is set per role", 'mentions "day rate"'],
    ["Day-rates vary", 'mentions "day rate"'],
    ["See S04 for floors", "contains an internal stage reference"],
    ["Section § 9", "contains an internal stage reference"],
    ["A revolutionary approach", 'uses the banned word "revolutionary"'],
    ["Cutting-edge tools", 'uses the banned word "cutting-edge"'],
    ["AI-powered everything", 'uses the banned word "ai-powered"'],
  ])("holds %j", (text, reason) => {
    expect(holdReasons(text)).toContain(reason);
  });
  it("does not treat ordinary prose as a marker", () => {
    expect(
      holdReasons(
        "Post-release checks confirm that orders are flowing; tell us so we can confirm staffing.",
      ),
    ).toEqual([]);
  });
  it("passes clean text, including ISO numbers and plain brackets", () => {
    expect(
      holdReasons("No. Vitalos is not ISO/IEC 27001 certified [1]. Cyber Essentials comes first."),
    ).toEqual([]);
  });
});

describe("canonical path and NEXT STEP", () => {
  it("picks the most specific existing placement and ignores /people/ unless alone", () => {
    expect(
      canonicalPath(["/trust", "/trust/certifications", "/people/temitope-agbola"], routeExists),
    ).toBe("/trust/certifications");
    expect(canonicalPath(["/people/temitope-agbola"], routeExists)).toBeNull();
    expect(canonicalPath(["/does-not-exist", "/about"], routeExists)).toBe("/about");
  });
  it("maps each CTA shape", () => {
    expect(nextStepFor("Talk to Vitalos", routeExists)).toBeNull();
    expect(nextStepFor("Engineering Rescue / Talk to Vitalos", routeExists)).toEqual({
      kind: "link",
      label: "Engineering Rescue",
      href: "/offers/engineering-rescue",
    });
    expect(nextStepFor("Data & BI Modernisation / Talk to Vitalos", routeExists)).toEqual({
      kind: "link",
      label: "Data & BI Modernisation",
      href: "/offers/data-bi-modernisation",
    });
    expect(
      nextStepFor("AI Opportunity Assessment / Start an AI Opportunity Assessment", routeExists),
    ).toEqual({
      kind: "link",
      label: "Start an AI Opportunity Assessment",
      href: "/offers/ai-opportunity-assessment",
    });
    expect(nextStepFor("Explore Labs / Talk to Vitalos", routeExists)).toEqual({
      kind: "link",
      label: "Explore Labs",
      href: "/labs",
    });
    expect(nextStepFor("Discuss a health & care challenge / Talk to Vitalos", routeExists)).toEqual(
      {
        kind: "handoff",
        label: "Discuss a health & care challenge",
      },
    );
    expect(nextStepFor("Systems Integration / Talk to Vitalos", routeExists)).toBeNull();
  });
  it("orders sections by number", () => {
    expect(sectionOrder("10. Trust Centre")).toBe(10);
    expect(sectionOrder("Other")).toBe(99);
  });
});

describe("mapFaqRow", () => {
  const options = { routeExists, requireHubActive: false, hubActive: null };

  it("publishes a clean Verified entry as one chunk with admin fields kept apart", () => {
    const { entry, held } = mapFaqRow(row(), options);
    expect(held).toEqual([]);
    expect(entry.status).toBe("published");
    expect(entry.url).toBe("/trust/certifications");
    expect(entry.chunks).toHaveLength(1);
    // Embedded on the question and short answer only; the full answer stays in the content.
    expect(
      entry.chunks?.[0]?.embeddingText?.startsWith("Is Vitalos ISO 27001 certified?\nNo."),
    ).toBe(true);
    const publicText = JSON.stringify({
      title: entry.title,
      body: entry.bodyMd,
      meta: entry.meta,
      chunks: entry.chunks,
    });
    expect(publicText).not.toContain("S06");
    expect(publicText).not.toContain("internal note");
    expect(entry.adminMeta.confirm_note).toBe("internal note that must never leak");
  });

  it("keeps Needs confirmation entries out of retrieval entirely", () => {
    const { entry, verified } = mapFaqRow(
      row({ status: "Needs confirmation", id: "ENG-06" }),
      options,
    );
    expect(verified).toBe(false);
    expect(entry.status).toBe("archived");
    expect(entry.bodyMd).toBe("");
    expect(entry.chunks).toEqual([]);
  });

  it("holds an entry whose text still leaks after stripping, and never publishes the amount", () => {
    const { entry, held } = mapFaqRow(
      row({
        fullAnswer: "Assessments are scoped [CONFIRM: £9,999 internal]. Typical cost £5,000.",
      }),
      options,
    );
    expect(held).toContain("contains a currency amount");
    expect(entry.status).toBe("draft");
    expect(entry.chunks).toEqual([]);
    expect(entry.bodyMd).toBe("");
  });

  it("strips CONFIRM blocks from published text", () => {
    const { entry } = mapFaqRow(
      row({ fullAnswer: "We review quarterly [CONFIRM: internal S04 £9,999 floor]." }),
      options,
    );
    expect(entry.status).toBe("published");
    expect(entry.bodyMd).not.toMatch(/CONFIRM|9,999|S04/);
  });

  it("keeps Verified entries as drafts while the hub page is not Active (production gate)", () => {
    const gated = mapFaqRow(row(), { routeExists, requireHubActive: true, hubActive: false });
    expect(gated.entry.status).toBe("draft");
    expect(gated.entry.adminMeta.awaiting_sign_off).toBe(true);
    const open = mapFaqRow(row(), { routeExists, requireHubActive: true, hubActive: true });
    expect(open.entry.status).toBe("published");
    expect(gated.entry.checksum).not.toBe(open.entry.checksum);
  });

  it("has a stable checksum", () => {
    expect(mapFaqRow(row(), options).entry.checksum).toBe(mapFaqRow(row(), options).entry.checksum);
    expect(checksumOf({ b: 1, a: [1, { y: 2, x: 1 }] })).toBe(
      checksumOf({ a: [1, { x: 1, y: 2 }], b: 1 }),
    );
  });
});

describe("ingest", () => {
  it("is idempotent, archives disappeared entries and never indexes held or unverified text", async () => {
    const store = new MemoryRelayStore();
    const options = { routeExists, requireHubActive: false, hubActive: null };
    const clean = mapFaqRow(row(), options).entry;
    const unverified = mapFaqRow(
      row({
        id: "ENG-06",
        notionPageId: "x1",
        status: "Needs confirmation",
        fullAnswer: "about £3,500",
      }),
      options,
    ).entry;
    const first = await ingestEntries(store, nullEmbedder, [clean, unverified], {
      archiveMissingFor: ["faq"],
    });
    expect(first).toMatchObject({ added: 2, chunks: 1 });
    const again = await ingestEntries(store, nullEmbedder, [clean, unverified], {
      archiveMissingFor: ["faq"],
    });
    expect(again).toMatchObject({ added: 0, updated: 0, unchanged: 2, chunks: 0 });

    const hits = await store.matchChunks({
      queryText: "3,500 cost",
      embedding: null,
      matchCount: 6,
    });
    expect(hits.every((h) => !h.content.includes("3,500"))).toBe(true);
    expect(
      JSON.stringify(
        await store.matchChunks({ queryText: "ISO certified", embedding: null, matchCount: 6 }),
      ),
    ).not.toMatch(/confirm_note|internal note|S06/);

    const removed = await ingestEntries(store, nullEmbedder, [unverified], {
      archiveMissingFor: ["faq"],
    });
    expect(removed.archived).toBe(1);
    expect(
      await store.matchChunks({ queryText: "ISO certified", embedding: null, matchCount: 6 }),
    ).toEqual([]);
  });
});
