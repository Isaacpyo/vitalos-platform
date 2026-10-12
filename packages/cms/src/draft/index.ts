// Draft editorial content (ADR-025). Entry: `@vitalos/cms/draft`.
//
// Repo-authored content drafted from the strategy library (`docs/strategy/`), every document with
// provenance and the status "draft-pending-approval". Rejected in production by @vitalos/config
// and by the web content-source factory. It is served by the same in-memory source as the
// fixtures, so the publication gates, sitemap and noindex rules apply unchanged.
import { createFixtureSource } from "../content/fixture-source";
import type { FixtureContentSourceOptions } from "../content/fixture-source";
import type { ContentSource } from "../content/source";
import { buildDraftContentSet } from "./set";
import type { DraftContentSet } from "./set";

export type { DraftContentSet };
export { DRAFT_STATUS, singletonProvenanceKeys } from "./provenance";
export type { DraftCitation, DraftProvenance } from "./provenance";
export { DRAFT_LEGAL_MARK, DRAFT_LEGAL_VERSION } from "./content/legal";

/** The draft content set, built once. */
export const draftContent: DraftContentSet = buildDraftContentSet();

/** The draft `ContentSource`. Never use it in production (configuration rejects it there). */
export function createDraftContentSource(options: FixtureContentSourceOptions = {}): ContentSource {
  // The draft source alone counts placeholder case studies towards the Work gate (ADR-025).
  return createFixtureSource(draftContent.set, { ...options, countPlaceholderCaseStudies: true });
}
