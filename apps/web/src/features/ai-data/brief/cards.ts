import { isOutcomePlaceholder } from "./question-bank";
import { cleanText, truncate } from "./text";
import { BRIEF_LIMITS } from "./types";
import type { BriefCard, BriefDraft, CardKey, Provenance, Source } from "./types";

/**
 * Brief cards (W6): what the visitor sees, edits, removes and restores. The provenance of each
 * card is fixed when it is drafted: the visitor's own words are "you", model output is "ai", a
 * checklist suggestion is "checklist". An edited card keeps its origin and shows as edited.
 */

const card = (key: CardKey, text: string, provenance: Provenance): BriefCard => ({
  key,
  text,
  provenance,
  original: text,
  edited: false,
  removed: false,
});

const lines = (items: readonly string[]) => items.map((item) => `- ${item}`).join("\n");

/**
 * Cards from a draft. In checklist mode the current workflow is the visitor's own description and
 * answers ("you"); the desired outcome is theirs when they answered the outcome question.
 */
export function cardsFromDraft(draft: BriefDraft, source: Source): BriefCard[] {
  const ai = source === "ai";
  const outcomeIsYours = !ai && !isOutcomePlaceholder(draft.desiredOutcome);
  return [
    card("currentWorkflow", draft.currentWorkflow, ai ? "ai" : "you"),
    card("desiredOutcome", draft.desiredOutcome, ai ? "ai" : outcomeIsYours ? "you" : "checklist"),
    card("possibleAutomation", lines(draft.possibleAutomation), ai ? "ai" : "checklist"),
    card("unknowns", lines(draft.unknowns), ai ? "ai" : "checklist"),
    card("nextStep", draft.suggestedNextStep, ai ? "ai" : "checklist"),
  ];
}

/** Replaces a card's text. Empty text is refused (remove the card instead). */
export function editCard(cards: readonly BriefCard[], key: CardKey, text: string): BriefCard[] {
  const next = truncate(cleanText(text), BRIEF_LIMITS.cardMax);
  return cards.map((entry) =>
    entry.key === key && next !== ""
      ? { ...entry, text: next, edited: next !== entry.original, removed: false }
      : entry,
  );
}

export const revertCard = (cards: readonly BriefCard[], key: CardKey): BriefCard[] =>
  cards.map((entry) =>
    entry.key === key ? { ...entry, text: entry.original, edited: false } : entry,
  );

export const setCardRemoved = (
  cards: readonly BriefCard[],
  key: CardKey,
  removed: boolean,
): BriefCard[] => cards.map((entry) => (entry.key === key ? { ...entry, removed } : entry));

/** Label shown on a card. Text, not colour, carries the meaning. */
export function provenanceLabel(entry: Pick<BriefCard, "provenance" | "edited">): string {
  if (entry.edited) return "Edited by you";
  switch (entry.provenance) {
    case "you":
      return "You said";
    case "ai":
      return "Suggested by AI";
    case "checklist":
      return "Suggested from our checklist";
  }
}
