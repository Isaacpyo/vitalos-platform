/**
 * Geometry for the brand-system artwork (ADR-044): deterministic numbers from a seed, and the
 * Convergence drawn as two polygons. Pure functions with no randomness at run time, so the server
 * HTML and the hydrated page always match and a page always draws the same picture.
 */

/** The band angle of the Convergence (brand `band-angle`, 30 degrees). */
export const BAND_ANGLE = Math.PI / 6;
const TAN = Math.tan(BAND_ANGLE);
const COS = Math.cos(BAND_ANGLE);

/** FNV-1a, 32 bit: a stable number for any string. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A small deterministic generator (mulberry32) seeded from a string: numbers in [0, 1). */
export function seeded(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number in [min, max] from a generator. */
export const pick = (next: () => number, min: number, max: number): number =>
  min + Math.floor(next() * (max - min + 1));

const r = (value: number): number => Math.round(value * 10) / 10;
const points = (list: readonly (readonly [number, number])[]): string =>
  list.map(([x, y]) => `${r(x)},${r(y)}`).join(" ");

export interface ConvergenceSpec {
  /** The clean vertical cut where both bands start (a column line). */
  startX: number;
  /** Where the bands' inner edges meet the horizontal run. */
  mergeX: number;
  /** The centre line of the gap between the two bands after the merge. */
  axisY: number;
  /** Thickness of the strategy band (cobalt, above). */
  upper: number;
  /** Thickness of the engineering band (mineral, below); smaller, as in the symbol. */
  lower: number;
  /** The gap between the bands (brand `band-gap`, about 6% of the thickness, at least 4). */
  gap: number;
  /** Where the horizontal run ends: past the right edge, so it leaves the frame. */
  endX: number;
}

/**
 * The Convergence (brand book, "Graphic language"): strategy above falling at 30 degrees,
 * engineering below rising at 30 degrees, both turning into one horizontal path that leaves the
 * frame. Each band starts as a clean vertical cut at `startX`; corners are mitred.
 */
export function convergence(spec: ConvergenceSpec): { strategy: string; engineering: string } {
  const { startX, mergeX, axisY, upper, lower, gap, endX } = spec;
  const run = mergeX - startX;
  const bottom = axisY - gap / 2;
  const top = axisY + gap / 2;
  const upperCorner = mergeX + upper * ((1 / COS - 1) / TAN);
  const lowerCorner = mergeX + lower * ((1 / COS - 1) / TAN);
  const strategy = points([
    [startX, bottom - run * TAN - upper / COS],
    [upperCorner, bottom - upper],
    [endX, bottom - upper],
    [endX, bottom],
    [mergeX, bottom],
    [startX, bottom - run * TAN],
  ]);
  const engineering = points([
    [startX, top + run * TAN],
    [mergeX, top],
    [endX, top],
    [endX, top + lower],
    [lowerCorner, top + lower],
    [startX, top + run * TAN + lower / COS],
  ]);
  return { strategy, engineering };
}

/** A path through the given points (orthogonal and 60/30 degree segments by construction). */
export const polyline = (list: readonly (readonly [number, number])[]): string =>
  list.map(([x, y], index) => `${index === 0 ? "M" : "L"}${r(x)} ${r(y)}`).join(" ");

/** The rise of a 60 degree segment over a horizontal distance. */
export const rise60 = (dx: number): number => dx * Math.tan(Math.PI / 3);
/** The rise of a 30 degree segment over a horizontal distance. */
export const rise30 = (dx: number): number => dx * TAN;
