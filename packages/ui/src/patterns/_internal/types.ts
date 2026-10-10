/**
 * Shared, framework-free prop types for patterns.
 *
 * @vitalos/ui must not import @vitalos/cms, so these are plain local shapes that STRUCTURALLY match
 * the public view models (ImageView, CtaView, ...). The web app passes view-model fields straight
 * through. Optional members are typed `T | undefined` so `exactOptionalPropertyTypes` callers can
 * forward optional view-model fields without conditionals.
 */

/** A labelled link. Matches CtaView ({ label, href }) and navigation items. */
export interface PatternLink {
  label: string;
  href: string;
}

/** Matches ImageView. Images are always optional on patterns; layouts work without them. */
export interface PatternImage {
  url: string;
  /** Required unless `decorative`. */
  alt: string;
  decorative?: boolean | undefined;
  width: number;
  height: number;
  credit?: string | undefined;
}

/** An array with at least one element. Used where an empty module must not exist. */
export type NonEmptyArray<T> = readonly [T, ...T[]];

/** Type guard that turns a possibly-empty list into a `NonEmptyArray`. */
export function isNonEmpty<T>(items: readonly T[] | null | undefined): items is NonEmptyArray<T> {
  return Array.isArray(items) && items.length > 0;
}

/** True for a string with visible content. */
export function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Heading level for the title of a repeated item, so the page outline stays correct. */
export type ItemHeadingLevel = 2 | 3 | 4 | 5;
