/**
 * Small pure helpers shared by the fixture, draft and repo content sources. No I/O, no framework
 * imports.
 */
import { labTypes, trustTopics } from "../routes";
import type { DocKind } from "./types";

/** Removes `undefined` entries so results satisfy `exactOptionalPropertyTypes`. */
export function clean<T extends object>(value: { [K in keyof T]: T[K] | undefined }): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

/** A non-blank string (content is preserved as authored), or undefined. */
export function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function oneOf<const T extends readonly string[]>(
  options: T,
  value: unknown,
): T[number] | undefined {
  return typeof value === "string" && (options as readonly string[]).includes(value)
    ? value
    : undefined;
}

/**
 * Static route params for a kind, derived from its summaries: `{ slug }`, `{ type, slug }` for lab
 * assets, `{ topic }` for trust items. Duplicates are dropped.
 */
export function paramsFromSummaries(
  kind: DocKind,
  summaries: readonly Record<string, unknown>[],
): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const seen = new Set<string>();
  for (const summary of summaries) {
    const slug = text(summary.slug);
    const topic = oneOf(trustTopics, summary.topic);
    const labType = oneOf(labTypes, summary.labType);
    let params: Record<string, string> | undefined;
    if (kind === "trustItem") params = topic === undefined ? undefined : { topic };
    else if (kind === "labAsset") {
      params = slug === undefined || labType === undefined ? undefined : { type: labType, slug };
    } else params = slug === undefined ? undefined : { slug };
    if (params === undefined) continue;
    const key = JSON.stringify(params);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(params);
    }
  }
  return out;
}
