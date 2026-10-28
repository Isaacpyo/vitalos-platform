/** Small text helpers shared by the brief modules. */

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Strips control characters (keeps newlines), normalises line endings, trims. */
export function cleanText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(CONTROL, "").trim();
}

export const codePoints = (value: string): number => Array.from(value).length;

/** Truncates to `limit` code points on a word boundary where possible, marking the cut. */
export function truncate(value: string, limit: number): string {
  const chars = Array.from(value);
  if (chars.length <= limit) return value;
  let cut = chars.slice(0, Math.max(0, limit - 1)).join("");
  const space = cut.lastIndexOf(" ");
  if (space > limit / 2) cut = cut.slice(0, space);
  return `${cut.trimEnd()}…`;
}

/** One line: newlines and runs of whitespace become single spaces. */
export const oneLine = (value: string): string => value.replace(/\s+/g, " ").trim();

/** The non-empty, trimmed lines of a list card. */
export const listItems = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((line) => line !== "");
