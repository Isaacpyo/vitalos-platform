import { EditorialRow, type RowBaseProps } from "../_internal/EditorialRow";

/** Matches PracticeSummary ({ title, summary }) plus the resolved `href`. */
export type PracticeRowProps = RowBaseProps;

/** One of the practices as an editorial row: title, proposition, link. */
export function PracticeRow(props: PracticeRowProps) {
  return <EditorialRow kind="practice" {...props} />;
}

/**
 * Matches OfferSummary plus `href`. There is deliberately no price prop (Stage 8 section 12).
 * Pass the engagement basics (audience, duration) as labelled `meta`.
 */
export type OfferRowProps = RowBaseProps;

export function OfferRow(props: OfferRowProps) {
  return <EditorialRow kind="offer" {...props} />;
}

/** Matches IndustrySummary plus `href`. */
export type IndustryRowProps = RowBaseProps;

export function IndustryRow(props: IndustryRowProps) {
  return <EditorialRow kind="industry" {...props} />;
}
