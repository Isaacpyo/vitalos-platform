/**
 * Guided brief (W6): shared types and limits. Framework-free so the client components, the
 * server actions and the tests all use the same shapes.
 */

export const topicSlugs = [
  "finance-reconciliation",
  "document-intake",
  "customer-requests",
  "operational-reporting",
] as const;
export type TopicSlug = (typeof topicSlugs)[number];

export const isTopicSlug = (value: unknown): value is TopicSlug =>
  typeof value === "string" && (topicSlugs as readonly string[]).includes(value);

/** Limits. The brief-assist contract allows more; these keep a shared brief inside the enquiry. */
export const BRIEF_LIMITS = {
  descriptionMin: 20,
  descriptionMax: 1500,
  answerMax: 500,
  questionMax: 300,
  maxQuestions: 4,
  maxAnswers: 6,
  cardMax: 900,
} as const;

/** Where a piece of text came from. Shown on every card. */
export type Provenance = "you" | "ai" | "checklist";

export type QuestionRole = "tools" | "volume" | "outcome" | "exceptions" | "people" | "data";

export interface BriefQuestion {
  id: string;
  question: string;
  why: string;
  suggestions: string[];
  /** Checklist questions carry a role; AI questions do not. */
  role?: QuestionRole;
}

export interface BriefAnswer {
  id: string;
  question: string;
  answer: string;
}

/** The shape the model (or the checklist) drafts. */
export interface BriefDraft {
  currentWorkflow: string;
  desiredOutcome: string;
  possibleAutomation: string[];
  unknowns: string[];
  suggestedNextStep: string;
}

export const cardKeys = [
  "currentWorkflow",
  "desiredOutcome",
  "possibleAutomation",
  "unknowns",
  "nextStep",
] as const;
export type CardKey = (typeof cardKeys)[number];

export const cardTitles: Record<CardKey, string> = {
  currentWorkflow: "Current workflow",
  desiredOutcome: "Desired outcome",
  possibleAutomation: "Possible automation",
  unknowns: "Unknowns to settle",
  nextStep: "Suggested next step",
};

export interface BriefCard {
  key: CardKey;
  /** List cards hold one item per line. */
  text: string;
  provenance: Provenance;
  /** The text as first drafted, so an edit can be reverted. */
  original: string;
  edited: boolean;
  removed: boolean;
}

export type Source = "ai" | "checklist";
