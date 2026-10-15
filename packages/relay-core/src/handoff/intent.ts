/**
 * Explicit request for a person, detected before the model is called (section 3, step 4).
 * Matches requests, not mentions: "do you build phone apps?" is not a hand-off; "can I speak to
 * someone?" is.
 */
const PATTERNS: RegExp[] = [
  /\btalk to a person\b/i,
  /\b(speak|talk|chat)\s+(to|with)\s+(a|an|some|the|your|one of your)?\s*(human|person|people|agent|someone|somebody|real|staff|team|member|consultant|specialist|expert|advisor|adviser|sales)\b/i,
  /\b(speak|talk)\s+to\s+(you|vitalos)\s+(directly|in person|on the phone)\b/i,
  /\b(real|actual|live)\s+(person|human|agent|people|someone)\b/i,
  /\bsomeone real\b|\bsomebody real\b/i,
  /\b(call|phone|ring)\s+me\b/i,
  /\b(can|could|may)\s+(i|we|someone|somebody)\s+(call|phone|ring)\b/i,
  /\b(your|a)\s+(phone|telephone|contact)\s+number\b/i,
  /\b(staff|team)\s+member\b/i,
  /\b(get|put)\s+me\s+(in touch|through)\b/i,
  /\b(connect|transfer)\s+me\b/i,
  /\bhuman\s+(please|agent|being)\b/i,
];

/** Very short messages that are only a request word ("human", "agent please", "a person"). */
const SHORT = /^(a\s+)?(human|person|agent|someone|operator|staff|people)(\s+please)?[.?!]*$/i;

export function isExplicitHandoffRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (SHORT.test(t)) return true;
  return PATTERNS.some((p) => p.test(t));
}

/** Normalises a question for gap grouping: lower case, no punctuation, collapsed spaces. */
export function normaliseQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/\[[a-z-]+\]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}
