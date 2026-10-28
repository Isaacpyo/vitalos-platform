import { aiDataOfferLabels } from "@vitalos/validation/ai-data-enquiry";
import { cleanText, oneLine, truncate } from "./text";
import type { BriefAnswer, BriefDraft, BriefQuestion, QuestionRole, TopicSlug } from "./types";
import { BRIEF_LIMITS } from "./types";

/**
 * Deterministic question bank and checklist brief (W6). Used when the AI assist is switched off,
 * unavailable, or the visitor did not opt in. Pure functions: the same input always gives the
 * same output, nothing is sent anywhere, and nothing here pretends to be AI.
 */

type Topic = TopicSlug | "general";

interface BankEntry {
  role: QuestionRole;
  question: string;
  why: string;
  suggestions: Partial<Record<Topic, string[]>> & { general: string[] };
  /** The description already answers this: skip the question. */
  answered?: RegExp;
  /** Ask this question when the description matches, whatever the topic. */
  triggers?: RegExp;
  /** Topics for which the question is always relevant. */
  topics?: readonly TopicSlug[];
}

const bank: readonly BankEntry[] = [
  {
    role: "tools",
    question: "Which tools or systems are involved today?",
    why: "Knowing where the information lives shapes what is practical.",
    suggestions: {
      "finance-reconciliation": [
        "Xero or QuickBooks",
        "Excel spreadsheets",
        "Bank feeds",
        "Supplier portals",
      ],
      "document-intake": [
        "Email inbox",
        "Shared drive",
        "Paper and a scanner",
        "A line-of-business system",
      ],
      "customer-requests": ["Shared inbox", "Help desk tool", "Phone and email", "A CRM"],
      "operational-reporting": ["Spreadsheets", "Accounting system", "A CRM", "A dashboard tool"],
      general: ["Spreadsheets", "Email", "An accounting system", "Paper"],
    },
    answered:
      /\b(xero|quickbooks|sage|excel|spreadsheet|outlook|gmail|salesforce|hubspot|sharepoint|zendesk|sap|dynamics)\b/i,
  },
  {
    role: "volume",
    question: "Roughly how often does this happen, and how many items each time?",
    why: "Volume tells us whether the effort is worth reducing.",
    suggestions: {
      general: ["A few a day", "Dozens a week", "Hundreds a month", "It varies a lot"],
    },
    answered:
      /\b\d+\s*(a|per|each|every|\/)\b|\b(daily|weekly|monthly|hourly)\b|\bper (day|week|month|year)\b|\b(hundreds|thousands|dozens)\b/i,
  },
  {
    role: "exceptions",
    question: "What goes wrong, or needs a person's judgement, today?",
    why: "Exceptions are usually where the time goes and where a person must stay in charge.",
    suggestions: {
      "finance-reconciliation": [
        "Amounts that do not match",
        "Missing references",
        "Duplicates",
        "Late corrections",
      ],
      "document-intake": ["Poor scans", "Missing fields", "Unusual layouts", "Wrong recipient"],
      "customer-requests": [
        "Unclear requests",
        "Urgent cases",
        "Needs a specialist",
        "Repeat contacts",
      ],
      "operational-reporting": [
        "Numbers that disagree",
        "Late inputs",
        "Manual fixes",
        "Changing formats",
      ],
      general: [
        "Missing information",
        "Mismatched details",
        "Unusual cases",
        "Rework after errors",
      ],
    },
    answered: /\b(exceptions?|mismatch\w*|errors?|wrong|mistakes?|missing|unusual|rework)\b/i,
  },
  {
    role: "data",
    question: "Is any of the information personal, financial or confidential?",
    why: "It decides what care is needed with the data and which questions to settle first.",
    suggestions: {
      general: ["Customer personal data", "Financial records", "Mostly internal", "Not sure"],
    },
    triggers:
      /\b(customer|client|patient|tenant|employee|payroll|personal|invoice|bank|contract)\b/i,
    topics: ["document-intake", "customer-requests"],
  },
  {
    role: "people",
    question: "Who does this work today, and who relies on the result?",
    why: "It shows who would need to review and trust the output.",
    suggestions: {
      general: ["One person", "A small team", "The finance team", "Our customers"],
    },
  },
  {
    role: "outcome",
    question: "What would a good result look like?",
    why: "A clear result gives the first piece of work something to be measured against.",
    suggestions: {
      general: [
        "Less manual re-keying",
        "Fewer errors",
        "A faster turnaround",
        "A clear list of exceptions",
      ],
    },
  },
];

const display: readonly QuestionRole[] = [
  "tools",
  "volume",
  "exceptions",
  "data",
  "people",
  "outcome",
];
/** Which questions win a place when more than four apply. */
const priority: readonly QuestionRole[] = [
  "outcome",
  "tools",
  "volume",
  "data",
  "exceptions",
  "people",
];

const id = (index: number) => `q${index + 1}`;

/**
 * Two to four contextual questions. The outcome question is always asked; questions the
 * description already answers are skipped, and topic or keyword triggers add the data question.
 */
export function selectQuestions(input: {
  description: string;
  topic: TopicSlug | null;
}): BriefQuestion[] {
  const description = input.description;
  const topic: Topic = input.topic ?? "general";
  const applicable = bank.filter((entry) => {
    if (entry.role === "outcome") return true;
    if (entry.answered?.test(description)) return false;
    if (entry.role === "data") {
      return Boolean(
        entry.triggers?.test(description) || (input.topic && entry.topics?.includes(input.topic)),
      );
    }
    return true;
  });
  let chosen = priority
    .map((role) => applicable.find((entry) => entry.role === role))
    .filter((entry): entry is BankEntry => entry !== undefined)
    .slice(0, BRIEF_LIMITS.maxQuestions);
  if (chosen.length < 2) {
    // Everything was answered already: still ask the two most useful questions.
    chosen = priority
      .map((role) => bank.find((entry) => entry.role === role))
      .filter((entry): entry is BankEntry => entry !== undefined && entry.role !== "data")
      .slice(0, 2);
  }
  return display
    .map((role) => chosen.find((entry) => entry.role === role))
    .filter((entry): entry is BankEntry => entry !== undefined)
    .map((entry, index) => ({
      id: id(index),
      role: entry.role,
      question: entry.question,
      why: entry.why,
      suggestions: [...(entry.suggestions[topic] ?? entry.suggestions.general)],
    }));
}

const automation: Record<Topic, string[]> = {
  "finance-reconciliation": [
    "Read incoming statements and extract each line",
    "Propose matches between statement lines and ledger entries",
    "List the exceptions for a person to review and decide",
  ],
  "document-intake": [
    "Read incoming documents and pull out the key fields",
    "Check the fields for gaps and obvious errors",
    "Pass clean records to the system and queue the rest for a person",
  ],
  "customer-requests": [
    "Read each request and suggest a category and urgency",
    "Draft a suggested reply for a person to review",
    "Route each request to the right person or queue",
  ],
  "operational-reporting": [
    "Collect the numbers from each source on a schedule",
    "Build the report in a fixed layout and flag figures that disagree",
    "Leave the commentary and sign-off to a person",
  ],
  general: [
    "Read the incoming information and extract the key details",
    "Check it against your rules and flag anything unusual",
    "Keep a person in charge of exceptions and sign-off",
  ],
};

const unknownByRole: Record<QuestionRole, string> = {
  tools: "Which systems hold the information, and how it can be accessed",
  volume: "How often this happens and how many items each time",
  exceptions: "Which cases need a person's judgement",
  data: "Which information is personal, financial or confidential",
  people: "Who does the work today and who reviews the result",
  outcome: "What a good result looks like, in your own terms",
};

const NO_ANSWER = "Not described yet. Add what a good result would look like.";

/** The suggested next step. Names the existing offers and a conversation; no price, no date. */
export const checklistNextStep =
  `A short conversation about whether and where automation fits this workflow. ` +
  `The ${aiDataOfferLabels["ai-opportunity-assessment"]} is the usual first step: it looks at one ` +
  `workflow before anything is built. If the picture is already clear, the ` +
  `${aiDataOfferLabels["ai-proof-of-value"]} tests the critical part on data you authorise. ` +
  `Sometimes the right answer is ordinary software, and we will say so.`;

/**
 * The checklist brief. The current workflow and the outcome are the visitor's own words
 * (description and answers); automation, unknowns and the next step come from the checklist.
 * `questions` is the list that was asked, so skipped questions become unknowns.
 */
export function draftChecklistBrief(input: {
  description: string;
  topic: TopicSlug | null;
  questions: readonly BriefQuestion[];
  answers: readonly BriefAnswer[];
}): BriefDraft {
  const topic: Topic = input.topic ?? "general";
  const answered = new Map(
    input.answers
      .map((entry) => [entry.id, oneLine(cleanText(entry.answer))] as const)
      .filter(([, text]) => text !== ""),
  );
  const roleText = (role: QuestionRole): string | undefined => {
    const question = input.questions.find((entry) => entry.role === role);
    return question ? answered.get(question.id) : undefined;
  };

  const workflow = [cleanText(input.description)];
  for (const role of ["tools", "volume", "people", "exceptions", "data"] as const) {
    const text = roleText(role);
    const label = {
      tools: "Tools",
      volume: "How often",
      people: "Who",
      exceptions: "What goes wrong",
      data: "Information involved",
    }[role];
    if (text) workflow.push(`${label}: ${text}`);
  }

  // Questions without a role (they came from the AI and the draft fell back to the checklist):
  // keep the visitor's answers, quoted against the question.
  for (const question of input.questions) {
    const text = answered.get(question.id);
    if (!question.role && text) workflow.push(`${oneLine(question.question)} ${text}`);
  }

  const unknowns = input.questions
    .filter((question) => question.role && !answered.has(question.id))
    .map((question) => unknownByRole[question.role as QuestionRole]);
  unknowns.push("Who would approve changes to the process, and who reviews the output");
  const seen = new Set<string>();

  return {
    currentWorkflow: truncate(workflow.join("\n"), BRIEF_LIMITS.cardMax),
    desiredOutcome: roleText("outcome") ?? NO_ANSWER,
    possibleAutomation: [...automation[topic]],
    unknowns: unknowns.filter((item) => !seen.has(item) && seen.add(item)).slice(0, 4),
    suggestedNextStep: checklistNextStep,
  };
}

/** True when the desired outcome is the placeholder rather than the visitor's words. */
export const isOutcomePlaceholder = (value: string): boolean => value === NO_ANSWER;
