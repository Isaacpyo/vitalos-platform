import { describe, expect, it } from "vitest";
import { cardsFromDraft, editCard, provenanceLabel, revertCard, setCardRemoved } from "./cards";
import { draftChecklistBrief, selectQuestions } from "./question-bank";
import { topics } from "./topics";
import { topicSlugs } from "./types";

describe("selectQuestions", () => {
  it("is deterministic and returns two to four questions for every topic", () => {
    for (const topic of [...topicSlugs, null]) {
      const description = topic ? topics[topic].starter : "We handle a lot of things by hand.";
      const first = selectQuestions({ description, topic });
      expect(selectQuestions({ description, topic })).toEqual(first);
      expect(first.length).toBeGreaterThanOrEqual(2);
      expect(first.length).toBeLessThanOrEqual(4);
      expect(first.some((q) => q.role === "outcome")).toBe(true);
      for (const q of first) expect(q.suggestions.length).toBeLessThanOrEqual(4);
    }
  });

  it("uses topic-specific suggestion chips", () => {
    const [tools] = selectQuestions({
      description: "We re-type things.",
      topic: "finance-reconciliation",
    });
    expect(tools?.role).toBe("tools");
    expect(tools?.suggestions).toContain("Xero or QuickBooks");
  });

  it("skips what the description already answers", () => {
    const roles = selectQuestions({
      description: "We reconcile in Excel about 200 a week and mismatches are common.",
      topic: null,
    }).map((q) => q.role);
    expect(roles).not.toContain("tools");
    expect(roles).not.toContain("volume");
    expect(roles).not.toContain("exceptions");
    expect(roles).toContain("outcome");
  });

  it("asks about data sensitivity on a keyword or a document topic", () => {
    const keyword = selectQuestions({
      description: "Customer contracts arrive by email.",
      topic: null,
    });
    expect(keyword.map((q) => q.role)).toContain("data");
    const topic = selectQuestions({
      description: "Paperwork piles up here.",
      topic: "document-intake",
    });
    expect(topic.map((q) => q.role)).toContain("data");
  });

  it("numbers the question ids q1, q2...", () => {
    const ids = selectQuestions({ description: "x".repeat(30), topic: null }).map((q) => q.id);
    expect(ids).toEqual(ids.map((_, index) => `q${index + 1}`));
  });
});

describe("draftChecklistBrief and cards", () => {
  const description = "Supplier statements are matched by hand every month.";
  const questions = selectQuestions({ description, topic: "finance-reconciliation" });
  const outcomeId = questions.find((q) => q.role === "outcome")?.id ?? "";

  it("builds the workflow and outcome from the visitor's words and labels the rest as checklist", () => {
    const draft = draftChecklistBrief({
      description,
      topic: "finance-reconciliation",
      questions,
      answers: [{ id: outcomeId, question: "q", answer: "Fewer errors and a list of exceptions" }],
    });
    expect(draft.currentWorkflow).toContain(description);
    expect(draft.desiredOutcome).toBe("Fewer errors and a list of exceptions");
    expect(draft.unknowns.length).toBeGreaterThan(0);
    const cards = cardsFromDraft(draft, "checklist");
    expect(cards.map((c) => provenanceLabel(c))).toEqual([
      "You said",
      "You said",
      "Suggested from our checklist",
      "Suggested from our checklist",
      "Suggested from our checklist",
    ]);
  });

  it("marks an unanswered outcome as a checklist placeholder and lists skipped questions as unknowns", () => {
    const draft = draftChecklistBrief({ description, topic: null, questions, answers: [] });
    const cards = cardsFromDraft(draft, "checklist");
    expect(cards[1]?.provenance).toBe("checklist");
    expect(draft.unknowns.join(" ")).toMatch(/good result/i);
  });

  it("makes no price or date commitment in the next step and names the existing offers", () => {
    const draft = draftChecklistBrief({ description, topic: null, questions, answers: [] });
    expect(draft.suggestedNextStep).toContain("AI Opportunity Assessment");
    expect(draft.suggestedNextStep).toContain("AI Proof of Value");
    expect(draft.suggestedNextStep).not.toMatch(/£|\$|\bdays?\b|\bweeks?\b|by (monday|friday)/i);
  });

  it("labels every card as AI when the source is ai", () => {
    const cards = cardsFromDraft(
      {
        currentWorkflow: "a",
        desiredOutcome: "b",
        possibleAutomation: ["c"],
        unknowns: ["d"],
        suggestedNextStep: "e",
      },
      "ai",
    );
    expect(cards.every((c) => provenanceLabel(c) === "Suggested by AI")).toBe(true);
  });

  it("edits, reverts, removes and restores a card", () => {
    const base = cardsFromDraft(
      {
        currentWorkflow: "a",
        desiredOutcome: "b",
        possibleAutomation: ["c"],
        unknowns: ["d"],
        suggestedNextStep: "e",
      },
      "ai",
    );
    const edited = editCard(base, "currentWorkflow", "  my words ");
    expect(edited[0]).toMatchObject({ text: "my words", edited: true });
    expect(provenanceLabel(edited[0]!)).toBe("Edited by you");
    expect(editCard(edited, "currentWorkflow", "   ")[0]?.text).toBe("my words");
    expect(revertCard(edited, "currentWorkflow")[0]).toMatchObject({ text: "a", edited: false });
    const removed = setCardRemoved(edited, "currentWorkflow", true);
    expect(removed[0]?.removed).toBe(true);
    expect(setCardRemoved(removed, "currentWorkflow", false)[0]?.removed).toBe(false);
  });
});
