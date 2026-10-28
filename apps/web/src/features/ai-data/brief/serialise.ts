import {
  AI_DATA_OUTCOME_MAX,
  AI_DATA_PROBLEM_MAX,
  AI_DATA_PROCESS_MAX,
} from "@vitalos/validation/ai-data-enquiry";
import { isOutcomePlaceholder } from "./question-bank";
import { cleanText, codePoints, listItems, oneLine, truncate } from "./text";
import type { BriefAnswer, BriefCard, CardKey, Source } from "./types";

/**
 * Serialisation of an approved brief into the existing AI & Data enquiry fields (W6).
 *
 * The brief travels through `submitAiDataEnquiryAction`, so it lands in the enquiry message that
 * the Super Admin intake already reads (`superadmin/apps/aidata/intake.py`):
 *
 * - `problem`        ("Business problem or workflow:")  the marker line, what the visitor said,
 *                    their follow-up answers, and the suggestion sections;
 * - `currentProcess` ("Current tools and process:")     the current workflow card;
 * - `desiredOutcome` ("Desired outcome:")               the desired outcome card.
 *
 * Every line the visitor wrote starts with a fixed prefix (`You said:`, `Q:`, `A:`, `- `), so it
 * can never be read as one of intake's own labels (`Sector:`, `Indicative budget:`, a section
 * heading). The first line is a machine-readable marker:
 *
 *     [vitalos-brief v1 questions=ai|checklist brief=ai|checklist]
 *
 * Documented in docs/ai-data/engineering/guided-brief.md.
 */

export const BRIEF_FORMAT_VERSION = 1;

export const briefMarker = (questions: Source, brief: Source): string =>
  `[vitalos-brief v${BRIEF_FORMAT_VERSION} questions=${questions} brief=${brief}]`;

export const OUTCOME_FALLBACK = "Not described in the guided brief; to discuss on a call.";

export interface SerialiseInput {
  description: string;
  answers: readonly BriefAnswer[];
  cards: readonly BriefCard[];
  questionsSource: Source;
  briefSource: Source;
}

export interface SerialisedBrief {
  problem: string;
  currentProcess: string | undefined;
  desiredOutcome: string;
  /** The whole brief as readable text (not shortened), for the copy action and the receipt. */
  fullText: string;
}

const sectionLabel = (card: BriefCard): string => {
  if (card.edited) return "edited by you";
  return card.provenance === "you"
    ? "you said"
    : card.provenance === "ai"
      ? "suggested by AI"
      : "suggested from our checklist";
};

const active = (cards: readonly BriefCard[], key: CardKey): BriefCard | undefined =>
  cards.find((entry) => entry.key === key && !entry.removed && entry.text.trim() !== "");

const bullets = (items: readonly string[], budget: number): string[] => {
  const out: string[] = [];
  let used = 0;
  for (const item of items) {
    const line = `- ${truncate(oneLine(item), 110)}`;
    if (used + line.length > budget && out.length > 0) break;
    out.push(line);
    used += line.length + 1;
  }
  return out;
};

/** The three enquiry fields and the readable full text for an approved brief. */
export function serialiseBrief(input: SerialiseInput): SerialisedBrief {
  const answered = input.answers.filter((entry) => cleanText(entry.answer) !== "");
  const perAnswer = answered.length > 0 ? Math.floor(480 / answered.length) : 0;

  const problem: string[] = [
    briefMarker(input.questionsSource, input.briefSource),
    `You said: ${truncate(oneLine(input.description), 400)}`,
  ];
  if (answered.length > 0) {
    problem.push("Follow-up answers (you said):");
    for (const entry of answered) {
      problem.push(`Q: ${truncate(oneLine(entry.question), Math.floor(perAnswer * 0.3))}`);
      problem.push(`A: ${truncate(oneLine(entry.answer), Math.floor(perAnswer * 0.7))}`);
    }
  }
  const automation = active(input.cards, "possibleAutomation");
  if (automation) {
    problem.push(`Possible automation (${sectionLabel(automation)}):`);
    problem.push(...bullets(listItems(automation.text), 260));
  }
  const unknowns = active(input.cards, "unknowns");
  if (unknowns) {
    problem.push(`Unknowns (${sectionLabel(unknowns)}):`);
    problem.push(...bullets(listItems(unknowns.text), 220));
  }
  const next = active(input.cards, "nextStep");
  if (next) {
    problem.push(
      `Suggested next step (${sectionLabel(next)}): ${truncate(oneLine(next.text), 240)}`,
    );
  }

  const workflow = active(input.cards, "currentWorkflow");
  const outcome = active(input.cards, "desiredOutcome");
  const outcomeText =
    outcome && !isOutcomePlaceholder(outcome.text)
      ? truncate(cleanText(outcome.text), AI_DATA_OUTCOME_MAX)
      : OUTCOME_FALLBACK;

  let problemText = problem.join("\n");
  // Hard guard: the field limit is a contract, so a pathological input is cut, never rejected.
  if (codePoints(problemText) > AI_DATA_PROBLEM_MAX) {
    problemText = truncate(problemText, AI_DATA_PROBLEM_MAX);
  }

  const full: string[] = [
    briefMarker(input.questionsSource, input.briefSource),
    "Vitalos AI & Data: my brief",
    "",
    `You said: ${cleanText(input.description)}`,
  ];
  for (const entry of answered)
    full.push("", `Q: ${oneLine(entry.question)}`, `A: ${cleanText(entry.answer)}`);
  const titles: Record<CardKey, string> = {
    currentWorkflow: "Current workflow",
    desiredOutcome: "Desired outcome",
    possibleAutomation: "Possible automation",
    unknowns: "Unknowns to settle",
    nextStep: "Suggested next step",
  };
  for (const card of input.cards) {
    if (card.removed) continue;
    full.push("", `${titles[card.key]} (${sectionLabel(card)}):`, card.text);
  }

  return {
    problem: problemText,
    currentProcess: workflow ? truncate(cleanText(workflow.text), AI_DATA_PROCESS_MAX) : undefined,
    desiredOutcome: outcomeText,
    fullText: full.join("\n"),
  };
}
