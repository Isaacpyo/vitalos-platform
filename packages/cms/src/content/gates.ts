/**
 * Publication gates: thresholds and pure functions. No I/O, no framework imports.
 *
 * Specs: Work needs at least two verified case studies (Stage 10 §17); Insights needs a
 * useful corpus with named authors (Stage 8 §16, Stage 10 §18); Labs, Industries and Careers
 * need at least one published item (Stage 8 §13, §15, §19; Stage 10 §12).
 *
 * Below threshold: no navigation item, the index route 404s, detail pages are noindex and
 * excluded from the sitemap. See ADR-022.
 */

export const gateKeys = ["work", "insights", "labs", "industries", "careers"] as const;
export type GateKey = (typeof gateKeys)[number];

/** Minimum number of qualifying published documents before a section becomes public. */
export const GATE_THRESHOLDS: Readonly<Record<GateKey, number>> = {
  /** Verified case studies only. Stage 10 §17 ("at least two ... three is preferable"). */
  work: 2,
  /** Published insights that each have at least one named author. Stage 8 §16 recommends 6-10. */
  insights: 6,
  labs: 1,
  industries: 1,
  /** Open roles only. Stage 8 §19. */
  careers: 1,
};

export type GateCounts = Readonly<Record<GateKey, number>>;

export interface PublicationGates {
  /** Qualifying document counts as reported by the content source. */
  counts: GateCounts;
  /** Whether each section has met its threshold. */
  open: Readonly<Record<GateKey, boolean>>;
}

export type GatedDocKind = "caseStudy" | "insight" | "labAsset" | "industry" | "job";

const gateByKind: Readonly<Record<GatedDocKind, GateKey>> = {
  caseStudy: "work",
  insight: "insights",
  labAsset: "labs",
  industry: "industries",
  job: "careers",
};

/** Gate that governs a document kind, or undefined when the kind is ungated. */
export function gateForKind(kind: string): GateKey | undefined {
  return Object.hasOwn(gateByKind, kind) ? gateByKind[kind as GatedDocKind] : undefined;
}

export function isGateOpen(gate: GateKey, count: number): boolean {
  return Number.isFinite(count) && count >= GATE_THRESHOLDS[gate];
}

/** Builds `PublicationGates` from counts; missing counts are treated as zero. */
export function evaluateGates(counts: Partial<Record<GateKey, number>> = {}): PublicationGates {
  const full = Object.fromEntries(gateKeys.map((key) => [key, counts[key] ?? 0])) as Record<
    GateKey,
    number
  >;
  const open = Object.fromEntries(
    gateKeys.map((key) => [key, isGateOpen(key, full[key])]),
  ) as Record<GateKey, boolean>;
  return { counts: full, open };
}

/** All gates closed: the state of an empty content source. */
export const closedGates: PublicationGates = evaluateGates();

/** A gated section appears in navigation only when its gate is open. Ungated items always do. */
export function isNavVisible(gate: GateKey | undefined, gates: PublicationGates): boolean {
  return gate === undefined || gates.open[gate];
}

/** The section index route is served only when its gate is open; otherwise call `notFound()`. */
export function shouldServeIndex(gate: GateKey | undefined, gates: PublicationGates): boolean {
  return isNavVisible(gate, gates);
}

/** Detail pages of a closed section stay reachable but must be `noindex`. */
export function isDetailIndexable(gate: GateKey | undefined, gates: PublicationGates): boolean {
  return isNavVisible(gate, gates);
}

/** Documents of a closed section are excluded from the sitemap. */
export function isSitemapEligible(gate: GateKey | undefined, gates: PublicationGates): boolean {
  return isNavVisible(gate, gates);
}
