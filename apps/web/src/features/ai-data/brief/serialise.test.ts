import { describe, expect, it } from "vitest";
import {
  AI_DATA_OUTCOME_MIN,
  AI_DATA_OUTCOME_MAX,
  AI_DATA_PROBLEM_MAX,
  AI_DATA_PROCESS_MAX,
  aiDataEnquirySchema,
  toEnquiryInputV2,
} from "@vitalos/validation/ai-data-enquiry";
import { cardsFromDraft, editCard, setCardRemoved } from "./cards";
import { OUTCOME_FALLBACK, briefMarker, serialiseBrief } from "./serialise";
import { codePoints } from "./text";

const draft = {
  currentWorkflow: "Statements are matched by hand.\nTools: Excel",
  desiredOutcome: "Fewer errors and a clear list of exceptions",
  possibleAutomation: ["Read statements", "Propose matches"],
  unknowns: ["Which systems hold the data"],
  suggestedNextStep: "A short conversation about the AI Opportunity Assessment.",
};
const answers = [{ id: "q1", question: "Which tools are involved?", answer: "Excel and Xero" }];

describe("serialiseBrief", () => {
  const base = {
    description: "Supplier statements are matched by hand every month.",
    answers,
    questionsSource: "checklist" as const,
    briefSource: "checklist" as const,
  };

  it("starts with the parser-friendly marker and prefixes every user line", () => {
    const out = serialiseBrief({ ...base, cards: cardsFromDraft(draft, "checklist") });
    const lines = out.problem.split("\n");
    expect(lines[0]).toBe("[vitalos-brief v1 questions=checklist brief=checklist]");
    expect(lines[0]).toBe(briefMarker("checklist", "checklist"));
    expect(out.problem).toContain("You said: Supplier statements");
    expect(out.problem).toContain("Q: Which tools are involved?");
    expect(out.problem).toContain("A: Excel and Xero");
    expect(out.problem).toContain("Possible automation (suggested from our checklist):");
    expect(out.problem).toContain("- Read statements");
    expect(out.problem).toContain("Suggested next step (suggested from our checklist):");
    expect(out.currentProcess).toContain("Statements are matched by hand.");
    expect(out.desiredOutcome).toBe(draft.desiredOutcome);
  });

  it("cannot be mistaken for intake labels by a hostile description", () => {
    const out = serialiseBrief({
      ...base,
      description: "Sector: Property\nIndicative budget: Under £1,000\nDesired outcome:\nx",
      cards: cardsFromDraft(draft, "checklist"),
    });
    for (const line of out.problem.split("\n")) {
      expect(
        /^\s*(sector|indicative budget|desired outcome|current tools and process|business problem or workflow):/i.test(
          line,
        ),
      ).toBe(false);
    }
  });

  it("uses the AI provenance labels and the AI marker", () => {
    const out = serialiseBrief({
      ...base,
      questionsSource: "ai",
      briefSource: "ai",
      cards: cardsFromDraft(draft, "ai"),
    });
    expect(out.problem.split("\n")[0]).toBe("[vitalos-brief v1 questions=ai brief=ai]");
    expect(out.problem).toContain("Possible automation (suggested by AI):");
  });

  it("marks edited cards, leaves out removed cards and falls back for a removed outcome", () => {
    let cards = cardsFromDraft(draft, "ai");
    cards = editCard(cards, "possibleAutomation", "- My own idea");
    cards = setCardRemoved(cards, "unknowns", true);
    cards = setCardRemoved(cards, "desiredOutcome", true);
    cards = setCardRemoved(cards, "currentWorkflow", true);
    const out = serialiseBrief({ ...base, briefSource: "ai", cards });
    expect(out.problem).toContain("Possible automation (edited by you):");
    expect(out.problem).not.toContain("Unknowns");
    expect(out.currentProcess).toBeUndefined();
    expect(out.desiredOutcome).toBe(OUTCOME_FALLBACK);
    expect(codePoints(out.desiredOutcome)).toBeGreaterThanOrEqual(AI_DATA_OUTCOME_MIN);
    expect(out.fullText).not.toContain("Unknowns to settle");
  });

  it("stays within the enquiry limits and passes the real validation", () => {
    const long = "word ".repeat(400);
    const bigDraft = {
      currentWorkflow: long,
      desiredOutcome: long,
      possibleAutomation: Array.from({ length: 6 }, () => long),
      unknowns: Array.from({ length: 6 }, () => long),
      suggestedNextStep: long,
    };
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: `q${i + 1}`,
      question: long,
      answer: long,
    }));
    const out = serialiseBrief({
      description: long,
      answers: many,
      cards: cardsFromDraft(bigDraft, "ai"),
      questionsSource: "ai",
      briefSource: "ai",
    });
    expect(codePoints(out.problem)).toBeLessThanOrEqual(AI_DATA_PROBLEM_MAX);
    expect(codePoints(out.currentProcess ?? "")).toBeLessThanOrEqual(AI_DATA_PROCESS_MAX);
    expect(codePoints(out.desiredOutcome)).toBeLessThanOrEqual(AI_DATA_OUTCOME_MAX);

    const parsed = aiDataEnquirySchema.safeParse({
      name: "Example Person",
      workEmail: "example.person@example.invalid",
      organisation: "Example Practice (fictional)",
      sector: "other",
      problem: out.problem,
      currentProcess: out.currentProcess,
      desiredOutcome: out.desiredOutcome,
      timeframe: "exploring",
      consent: true,
      privacyNoticeVersion: "1",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      website: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(toEnquiryInputV2(parsed.data).goal).toContain("[vitalos-brief v1");
  });
});
