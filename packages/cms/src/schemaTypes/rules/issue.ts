/**
 * Validation core: every rule is a pure function that returns `Issue[]`. `wire.ts` adapts these to
 * Sanity `Rule.custom` so the Studio and the unit tests run exactly the same logic.
 */
export type PathSegment = string | number;

export interface Issue {
  message: string;
  /** Path relative to the validated value (field names / array indexes). */
  path?: PathSegment[];
}

export const issue = (message: string, ...path: PathSegment[]): Issue =>
  path.length > 0 ? { message, path } : { message };

/** Today as an ISO date (UTC). Isolated so tests can use fake timers. */
export const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** True for a non-blank string. */
export const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Strict yyyy-mm-dd check that also rejects impossible dates. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Counts entries that actually point at a document. */
export function countRefs(value: unknown): number {
  return asArray(value).filter((item) => isRecord(item) && hasText(item["_ref"])).length;
}

/**
 * Linear-time slug maker: keeps ASCII letters and digits (lower-cased when `lower`), turns every
 * other run of characters into a single hyphen, and trims hyphens at both ends. Input is capped
 * first, so hostile input costs at most `maxInput` steps. No regular expressions (ReDoS-safe).
 */
export function hyphenate(
  input: string,
  options: { maxInput?: number; lower?: boolean } = {},
): string {
  const { maxInput = 2048, lower = false } = options;
  let out = "";
  let pendingHyphen = false;
  const limit = Math.min(input.length, maxInput);
  for (let i = 0; i < limit; i++) {
    const code = input.charCodeAt(i);
    const isDigit = code >= 48 && code <= 57;
    const isLower = code >= 97 && code <= 122;
    const isUpper = code >= 65 && code <= 90;
    if (isDigit || isLower || isUpper) {
      if (pendingHyphen && out.length > 0) out += "-";
      pendingHyphen = false;
      out += lower && isUpper ? String.fromCharCode(code + 32) : input.charAt(i);
    } else {
      pendingHyphen = true;
    }
  }
  return out;
}

/** Reads a string field from an unknown record. */
export function str(source: unknown, key: string): string | undefined {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

export function obj(source: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return isRecord(value) ? value : undefined;
}
