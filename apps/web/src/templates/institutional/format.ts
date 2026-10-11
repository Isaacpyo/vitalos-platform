/** Small, pure formatting helpers shared by the G2b templates. No copy is generated here. */

/** "insight-article" becomes "Insight article". Fallback label for an enum value without a mapped label. */
export function humanise(value: string): string {
  const spaced = value.replace(/[-_]+/g, " ").trim();
  return spaced === "" ? "" : spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Calendar date in en-GB ("5 March 2026"). Returns undefined for anything that is not a date. */
export function formatDate(value: string | undefined): string | undefined {
  if (value === undefined || Number.isNaN(Date.parse(value))) return undefined;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

/** Host without `www.`, used as the visible label of a verified external profile link. */
export function hostLabel(url: string): string | undefined {
  if (!URL.canParse(url)) return undefined;
  const host = new URL(url).hostname.replace(/^www\./, "");
  return host === "" ? undefined : host;
}

/** `https:` URLs without credentials only. Anything else is not rendered as an external link. */
export function isHttpsUrl(value: string | undefined): value is string {
  if (!value || !URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}
