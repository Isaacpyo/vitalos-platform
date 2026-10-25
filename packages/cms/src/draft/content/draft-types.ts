/**
 * Shapes of the offer and case-study drafts, shared by the content files that write them, so a
 * file of extra drafts (offers-health-care.ts, work-stories.ts) never imports the file that lists
 * it (no import cycle).
 */
import type { CaseStudyView, OfferView } from "../../content/types";
import type { DraftProvenance } from "../provenance";
import type { IndustrySlug, OfferSlug, PracticeSlug, SolutionSlug } from "../slugs";

export interface OfferDraft extends Omit<OfferView, "id" | "solutions" | "practices"> {
  slug: OfferSlug;
  solutions: readonly SolutionSlug[];
  practices: readonly PracticeSlug[];
  provenance: DraftProvenance;
}

export interface CaseStudyDraft extends Omit<
  CaseStudyView,
  "id" | "practices" | "solutions" | "industries" | "offers"
> {
  /** The two illustrative scenarios in work.ts; the Website Build Pack stories are real work. */
  placeholder?: true;
  practices: readonly PracticeSlug[];
  solutions: readonly SolutionSlug[];
  industries: readonly IndustrySlug[];
  offers?: readonly OfferSlug[];
  provenance: DraftProvenance;
}
