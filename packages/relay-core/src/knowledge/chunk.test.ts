import { describe, expect, it } from "vitest";
import { chunkMarkdown, embeddingInput, MAX_WORDS, OVERLAP_WORDS } from "./chunk";

describe("chunkMarkdown", () => {
  it("splits by headings and keeps the heading path", () => {
    const chunks = chunkMarkdown(
      "Engineering Rescue",
      "Intro text.\n\n## Who it is for\n\nTeams with a failing project.\n\n### Signs\n\nMissed releases.",
    );
    expect(chunks.map((c) => c.heading)).toEqual([
      "Engineering Rescue",
      "Engineering Rescue › Who it is for",
      "Engineering Rescue › Who it is for › Signs",
    ]);
    expect(chunks.map((c) => c.ix)).toEqual([0, 1, 2]);
  });

  it("caps chunks at about 300 words with overlap", () => {
    const words = Array.from({ length: 700 }, (_, i) => `w${i}`).join(" ");
    const chunks = chunkMarkdown("Long", words);
    expect(chunks.length).toBe(3);
    for (const c of chunks) expect(c.content.split(" ").length).toBeLessThanOrEqual(MAX_WORDS);
    const firstEnd = chunks[0]?.content.split(" ").slice(-OVERLAP_WORDS);
    const secondStart = chunks[1]?.content.split(" ").slice(0, OVERLAP_WORDS);
    expect(secondStart).toEqual(firstEnd);
  });

  it("ignores empty documents and sections", () => {
    expect(chunkMarkdown("Empty", "")).toEqual([]);
    expect(chunkMarkdown("Only headings", "## A\n\n## B\n")).toEqual([]);
  });

  it("prefixes embedding input with title and heading", () => {
    expect(embeddingInput("Offer", "Offer › Scope", "Text")).toBe("Offer — Scope: Text");
    expect(embeddingInput("Offer", "Offer", "Text")).toBe("Offer: Text");
  });
});
