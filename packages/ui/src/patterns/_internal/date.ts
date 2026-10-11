/**
 * Formats an ISO 8601 date for display. Fixed to UTC so server and client render identically
 * (no hydration drift). Returns the input unchanged when it cannot be parsed.
 */
export function formatDate(iso: string, locale = "en-GB"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
