import { cleanText } from "./text";
import { BRIEF_LIMITS, cardKeys, isTopicSlug } from "./types";
import type { BriefCard, BriefQuestion, Provenance, Source, TopicSlug } from "./types";

/**
 * Guided brief draft state (W6): a pure reducer plus sessionStorage persistence helpers. The
 * draft holds the visitor's text, so it lives in sessionStorage only (never localStorage, never
 * sent anywhere until the visitor shares), and "Start over" clears it. The AI opt-in is NOT
 * persisted: it is asked again in a new session.
 */

export type Step = "describe" | "questions" | "brief" | "share";
export const steps: readonly Step[] = ["describe", "questions", "brief", "share"];

export interface Notice {
  /** `ai-unavailable`: AI was asked for and could not be used; the checklist took over. */
  kind: "ai-unavailable";
  message: string;
}

export interface DraftState {
  step: Step;
  description: string;
  topic: TopicSlug | null;
  aiOptIn: boolean;
  questions: BriefQuestion[];
  questionsSource: Source | null;
  answers: Record<string, string>;
  cards: BriefCard[];
  briefSource: Source | null;
  /** One key per brief: retries and double clicks give one enquiry (the service replays it). */
  idempotencyKey: string;
  notice: Notice | null;
}

export const initialDraft = (idempotencyKey: string, topic: TopicSlug | null): DraftState => ({
  step: "describe",
  description: "",
  topic,
  aiOptIn: false,
  questions: [],
  questionsSource: null,
  answers: {},
  cards: [],
  briefSource: null,
  idempotencyKey,
  notice: null,
});

export type Action =
  | { type: "describe"; description: string }
  | { type: "opt-in"; value: boolean }
  | { type: "questions-ready"; questions: BriefQuestion[]; source: Source; notice: Notice | null }
  | { type: "answer"; id: string; value: string }
  | { type: "brief-ready"; cards: BriefCard[]; source: Source; notice: Notice | null }
  | { type: "cards"; cards: BriefCard[] }
  | { type: "go"; step: Step }
  | { type: "restore"; draft: DraftState }
  | { type: "reset"; idempotencyKey: string; topic: TopicSlug | null };

export function reducer(state: DraftState, action: Action): DraftState {
  switch (action.type) {
    case "describe":
      return {
        ...state,
        description: action.description.slice(0, BRIEF_LIMITS.descriptionMax),
        // New words invalidate questions and the brief drafted from the old ones.
        ...(state.questions.length > 0 && action.description !== state.description
          ? { questions: [], questionsSource: null, answers: {}, cards: [], briefSource: null }
          : {}),
      };
    case "opt-in":
      return { ...state, aiOptIn: action.value };
    case "questions-ready":
      return {
        ...state,
        step: "questions",
        questions: action.questions,
        questionsSource: action.source,
        answers: {},
        cards: [],
        briefSource: null,
        notice: action.notice,
      };
    case "answer":
      return {
        ...state,
        answers: { ...state.answers, [action.id]: action.value.slice(0, BRIEF_LIMITS.answerMax) },
        cards: [],
        briefSource: null,
      };
    case "brief-ready":
      return {
        ...state,
        step: "brief",
        cards: action.cards,
        briefSource: action.source,
        notice: action.notice,
      };
    case "cards":
      return { ...state, cards: action.cards };
    case "go":
      return { ...state, step: action.step };
    case "restore":
      return action.draft;
    case "reset":
      return initialDraft(action.idempotencyKey, action.topic);
  }
}

export const DRAFT_STORAGE_KEY = "vitalos.aid.brief.v1";
export const SHARED_STORAGE_KEY = "vitalos.aid.brief.shared.v1";

const provenances: readonly Provenance[] = ["you", "ai", "checklist"];

/** What is written to sessionStorage: everything except the opt-in and transient notice. */
export function serialiseDraft(state: DraftState): string {
  const persisted: Partial<DraftState> = { ...state };
  delete persisted.aiOptIn;
  delete persisted.notice;
  return JSON.stringify({ v: 1, ...persisted });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSource = (value: unknown): value is Source => value === "ai" || value === "checklist";

/** Reads a stored draft defensively. Anything malformed is discarded (null), never trusted. */
export function parseDraft(raw: string | null): DraftState | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.v !== 1) return null;
    const { step, description, topic, questions, questionsSource, answers, cards, briefSource } =
      data;
    const key = data.idempotencyKey;
    if (!steps.includes(step as Step) || typeof description !== "string") return null;
    if (typeof key !== "string" || !/^[0-9a-f-]{36}$/i.test(key)) return null;
    const parsedCards: BriefCard[] = [];
    if (Array.isArray(cards)) {
      for (const card of cards) {
        if (
          !isRecord(card) ||
          !cardKeys.includes(card.key as never) ||
          typeof card.text !== "string" ||
          typeof card.original !== "string" ||
          !provenances.includes(card.provenance as Provenance)
        ) {
          return null;
        }
        parsedCards.push({
          key: card.key as BriefCard["key"],
          text: cleanText(card.text),
          original: cleanText(card.original),
          provenance: card.provenance as Provenance,
          edited: card.edited === true,
          removed: card.removed === true,
        });
      }
    }
    const parsedQuestions: BriefQuestion[] = [];
    if (Array.isArray(questions)) {
      for (const q of questions) {
        if (!isRecord(q) || typeof q.id !== "string" || typeof q.question !== "string") return null;
        parsedQuestions.push({
          id: q.id,
          question: q.question,
          why: typeof q.why === "string" ? q.why : "",
          suggestions: Array.isArray(q.suggestions)
            ? q.suggestions.filter((s): s is string => typeof s === "string").slice(0, 4)
            : [],
          ...(typeof q.role === "string" ? { role: q.role as never } : {}),
        });
      }
    }
    const parsedAnswers: Record<string, string> = {};
    if (isRecord(answers)) {
      for (const [id, value] of Object.entries(answers)) {
        if (typeof value === "string") parsedAnswers[id] = value.slice(0, BRIEF_LIMITS.answerMax);
      }
    }
    return {
      step: step as Step,
      description: description.slice(0, BRIEF_LIMITS.descriptionMax),
      topic: isTopicSlug(topic) ? topic : null,
      aiOptIn: false,
      questions: parsedQuestions,
      questionsSource: isSource(questionsSource) ? questionsSource : null,
      answers: parsedAnswers,
      cards: parsedCards,
      briefSource: isSource(briefSource) ? briefSource : null,
      idempotencyKey: key,
      notice: null,
    };
  } catch {
    return null;
  }
}

/** The brief as shared, kept for the receipt page (same tab, same session). */
export interface SharedBrief {
  fullText: string;
  source: Source;
  cardsKept: number;
}

export const serialiseShared = (shared: SharedBrief): string => JSON.stringify(shared);

export function parseShared(raw: string | null): SharedBrief | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (
      isRecord(data) &&
      typeof data.fullText === "string" &&
      isSource(data.source) &&
      typeof data.cardsKept === "number"
    ) {
      return {
        fullText: data.fullText.slice(0, 8000),
        source: data.source,
        cardsKept: data.cardsKept,
      };
    }
  } catch {
    // fall through
  }
  return null;
}

