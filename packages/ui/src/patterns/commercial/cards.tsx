import { FeatureCard, type CardBaseProps } from "../_internal/FeatureCard";

/** Matches SolutionSummary ({ title, summary }) plus the resolved `href`. */
export type SolutionCardProps = CardBaseProps;

/** A high-value solution as a feature card. Use for a small number of items, not a card wall. */
export function SolutionCard(props: SolutionCardProps) {
  return <FeatureCard kind="solution" {...props} />;
}

export type LinkCardKind = "practice" | "solution" | "industry" | "case-study" | "insight" | "lab";

export interface LinkCardProps extends CardBaseProps {
  /** Content type. Drives `data-kind`; the visible label is `eyebrow`, supplied by the caller. */
  kind: LinkCardKind;
}

/** Generic related-content card: one link to a practice, solution, case study, insight or lab asset. */
export function LinkCard({ kind, ...props }: LinkCardProps) {
  return <FeatureCard kind={kind} {...props} />;
}
