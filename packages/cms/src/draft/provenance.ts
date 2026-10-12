/**
 * Provenance of draft content (ADR-025).
 *
 * Every draft document records the strategy documents it was drafted from (stage number and the
 * section heading in `docs/strategy/`) and the status `draft-pending-approval`. Provenance is kept
 * beside the view models, never inside them, so the public view-model contract is unchanged and
 * nothing about drafting leaks into a page. Tests check that every document has provenance and
 * that every cited section heading exists in the cited stage file.
 */

/** The only status a draft document can have. Approval is an owner decision recorded in a pull request. */
export const DRAFT_STATUS = "draft-pending-approval" as const;
export type DraftStatus = typeof DRAFT_STATUS;

export interface DraftCitation {
  /** Strategy stage number: 0 (platform brief) to 20. */
  stage: number;
  /**
   * The section heading as it appears in the stage file, without the leading `#` marks, for
   * example "4.1 Core capabilities" or "Initial Offer Pricing Architecture".
   */
  section: string;
}

export interface DraftProvenance {
  status: DraftStatus;
  /** At least one citation. */
  sources: readonly DraftCitation[];
  /** What was deliberately left empty in this document, and why. */
  omitted?: string;
  /**
   * The document is invented placeholder content (owner directive of 11 October 2026, ADR-025):
   * dropped by the repo content source (ADR-028).
   */
  placeholder?: true;
}

/** A citation: `cite(3, "4.1 Core capabilities")`. */
export const cite = (stage: number, section: string): DraftCitation => ({ stage, section });

/** Provenance for a document drafted from the given sections. */
export function drafted(sources: readonly DraftCitation[], omitted?: string): DraftProvenance {
  return omitted === undefined
    ? { status: DRAFT_STATUS, sources }
    : { status: DRAFT_STATUS, sources, omitted };
}

/** Provenance keys of documents that have no id of their own. */
export const singletonProvenanceKeys = {
  siteSettings: "siteSettings",
  homePage: "homePage",
  routePage: (key: string) => `routePage.${key}`,
} as const;

/** Provenance for an invented placeholder document: same shape, flagged `placeholder`. */
export function placeholderDrafted(
  sources: readonly DraftCitation[],
  omitted: string,
): DraftProvenance {
  return { status: DRAFT_STATUS, sources, omitted, placeholder: true };
}
