import type { MatchedChunk } from "../../db/types";

export interface ContextInput {
  pagePath: string;
  pageTitle: string | null;
  teamOnline: boolean;
  now: Date;
  confident: boolean;
  sources: MatchedChunk[];
  question: string;
}

const typeLabel = (c: MatchedChunk) => (c.source === "faq" ? "FAQ" : c.type);

/** "Wednesday 15 October 2026, 14:21" in Europe/London. */
export function londonDateTime(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")}`;
}

/**
 * The final user message: per-request context, numbered SOURCES (as data) and the redacted
 * question. With low confidence no sources are passed, so the model can only greet, clarify or
 * say it does not know.
 */
export function buildUserMessage(input: ContextInput): string {
  const sources = input.confident ? input.sources : [];
  const lines = [
    "CONTEXT",
    `Page: ${input.pagePath}${input.pageTitle ? ` (${input.pageTitle})` : ""}`,
    `Team: ${input.teamOnline ? "online" : "offline - replies by email on the next working day"}`,
    `Today: ${londonDateTime(input.now)} Europe/London`,
    `Retrieval: ${input.confident ? "confident" : "low - no sources match; do not answer from memory"}`,
    "",
    "SOURCES",
  ];
  if (sources.length === 0) lines.push("(none)");
  sources.forEach((c, i) => {
    const label = c.source === "faq" ? c.title : c.title;
    const link = c.source === "faq" ? (c.meta.canonical_path ?? "") : (c.url ?? "");
    lines.push(`[${i + 1}] ${label} (${typeLabel(c)}) ${link}`.trimEnd());
    lines.push(c.source === "faq" ? c.content : `${c.heading}\n${c.content}`);
  });
  lines.push("", "QUESTION", input.question);
  return lines.join("\n");
}
