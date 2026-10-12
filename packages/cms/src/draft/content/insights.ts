/**
 * Placeholder insights (owner directive of 11 October 2026, ADR-025 status note): six articles on
 * the Stage 13 narrative pillars, attributed to the invented placeholder personas in `people.ts`.
 * Each is flagged `placeholder`, so it never emits structured data, is always `noindex` and stays
 * out of the repo content source. They claim no client experience, no results and no statistics.
 */
import type { InsightView } from "../../content/types";
import { seo } from "../build";
import { cite, placeholderDrafted } from "../provenance";
import type { DraftProvenance } from "../provenance";
import { DRAFTED_ON } from "../slugs";
import type { InsightDraftBody } from "./insight-types";
import { aiPilotsStall, evaluateBeforeLive, strategyToProduction } from "./insights-a";
import { dataFoundations, modernisationChoice, operateWhatYouBuild } from "./insights-b";
import type { PersonSlug } from "./people";

export interface InsightDraft extends Omit<InsightView, "id" | "authors" | "related"> {
  placeholder: true;
  authors: readonly PersonSlug[];
  /** Slugs of other placeholder insights. */
  related: readonly string[];
  provenance: DraftProvenance;
}

const omitted =
  "Invented placeholder article (owner directive, 11 October 2026), written as reasoning from the strategy documents under an invented placeholder author. It cites no statistic, client, result or credential, and its dates are placeholders. Replace with a real article by a real author, or delete, before launch.";

function toDraft(body: InsightDraftBody): InsightDraft {
  return {
    placeholder: true,
    slug: body.slug,
    title: body.title,
    summary: body.summary,
    seo: { ...seo(body.seoTitle, body.seoDescription), noindex: true },
    updatedAt: DRAFTED_ON,
    format: body.format,
    topics: body.topics,
    authors: [body.author],
    publishedAt: body.publishedAt,
    body: body.body,
    related: body.related,
    provenance: placeholderDrafted(
      body.sources.map(([stage, section]) => cite(stage, section)),
      omitted,
    ),
  };
}

export const insightDrafts: readonly InsightDraft[] = [
  aiPilotsStall,
  modernisationChoice,
  evaluateBeforeLive,
  strategyToProduction,
  operateWhatYouBuild,
  dataFoundations,
].map(toDraft);
