import { describe, expect, it } from "vitest";
import { cardsFromDraft } from "./cards";
import { initialDraft, parseDraft, parseShared, reducer, serialiseDraft } from "./state";

const KEY = "11111111-1111-4111-8111-111111111111";
const cards = cardsFromDraft(
  {
    currentWorkflow: "a",
    desiredOutcome: "b",
    possibleAutomation: ["c"],
    unknowns: ["d"],
    suggestedNextStep: "e",
  },
  "checklist",
);

describe("draft reducer", () => {
  it("clears questions and the brief when the description changes, but not on identical text", () => {
    let state = reducer(initialDraft(KEY, null), {
      type: "describe",
      description: "We do X by hand.",
    });
    state = reducer(state, {
      type: "questions-ready",
      questions: [{ id: "q1", question: "?", why: "", suggestions: [] }],
      source: "checklist",
      notice: null,
    });
    state = reducer(state, { type: "answer", id: "q1", value: "Excel" });
    expect(
      reducer(state, { type: "describe", description: "We do X by hand." }).questions,
    ).toHaveLength(1);
    const changed = reducer(state, { type: "describe", description: "We do Y by hand." });
    expect(changed.questions).toHaveLength(0);
    expect(changed.answers).toEqual({});
  });

  it("keeps the idempotency key through edits and replaces it only on reset", () => {
    let state = reducer(initialDraft(KEY, null), {
      type: "brief-ready",
      cards,
      source: "checklist",
      notice: null,
    });
    state = reducer(state, { type: "go", step: "share" });
    expect(state.idempotencyKey).toBe(KEY);
    const other = "22222222-2222-4222-8222-222222222222";
    expect(reducer(state, { type: "reset", idempotencyKey: other, topic: null })).toEqual(
      initialDraft(other, null),
    );
  });
});

describe("persistence", () => {
  it("round-trips a draft without the AI opt-in", () => {
    const state = reducer(
      {
        ...initialDraft(KEY, "document-intake"),
        aiOptIn: true,
        description: "Documents by email.",
      },
      { type: "brief-ready", cards, source: "checklist", notice: null },
    );
    const restored = parseDraft(serialiseDraft(state));
    expect(restored).toMatchObject({
      step: "brief",
      topic: "document-intake",
      aiOptIn: false,
      idempotencyKey: KEY,
    });
    expect(restored?.cards).toHaveLength(5);
  });

  it("discards malformed or tampered drafts", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("not json")).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 2 }))).toBeNull();
    expect(
      parseDraft(
        JSON.stringify({ v: 1, step: "describe", description: "x", idempotencyKey: "nope" }),
      ),
    ).toBeNull();
    expect(
      parseDraft(
        JSON.stringify({
          v: 1,
          step: "brief",
          description: "x",
          idempotencyKey: KEY,
          cards: [{ key: "evil" }],
        }),
      ),
    ).toBeNull();
  });

  it("parses the shared brief for the receipt", () => {
    expect(parseShared(JSON.stringify({ fullText: "x", source: "ai", cardsKept: 3 }))).toEqual({
      fullText: "x",
      source: "ai",
      cardsKept: 3,
    });
    expect(parseShared(JSON.stringify({ fullText: 1 }))).toBeNull();
  });
});
