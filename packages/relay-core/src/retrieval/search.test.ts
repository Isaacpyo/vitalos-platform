import { describe, expect, it } from "vitest";
import type { MatchedChunk } from "../db/types";
import { composeQuery, diversify, semanticConfidence } from "./search";

const chunk = (chunkId: string, documentId: string): MatchedChunk =>
  ({ chunkId, documentId }) as unknown as MatchedChunk;

describe("diversify", () => {
  it("puts each document's best chunk first, then the rest in rank order", () => {
    const ranked = [chunk("a1", "A"), chunk("a2", "A"), chunk("b1", "B"), chunk("c1", "C")];
    expect(diversify(ranked, 3).map((c) => c.chunkId)).toEqual(["a1", "b1", "c1"]);
    expect(diversify(ranked, 6).map((c) => c.chunkId)).toEqual(["a1", "b1", "c1", "a2"]);
  });

  it("keeps a single document's chunks when nothing else matched", () => {
    expect(diversify([chunk("a1", "A"), chunk("a2", "A")], 6).map((c) => c.chunkId)).toEqual([
      "a1",
      "a2",
    ]);
  });
});

describe("composeQuery", () => {
  it("joins a short pronoun follow-up to the previous question", () => {
    expect(composeQuery("how long would that take?", "Can you rescue a project?")).toBe(
      "Can you rescue a project? how long would that take?",
    );
    expect(composeQuery("Do you sign NDAs?", "Can you rescue a project?")).toBe(
      "Do you sign NDAs?",
    );
  });
});

describe("semanticConfidence", () => {
  it("normalises similarity from the floor and adds 0.1 for a full-text match", () => {
    expect(semanticConfidence(0.7, 0.7, false)).toBe(0);
    expect(semanticConfidence(0.85, 0.7, false)).toBeCloseTo(0.5);
    expect(semanticConfidence(0.85, 0.7, true)).toBeCloseTo(0.6);
    expect(semanticConfidence(null, 0.7, true)).toBe(0);
  });
});
