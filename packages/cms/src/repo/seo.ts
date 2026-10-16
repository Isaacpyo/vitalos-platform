/**
 * SEO for pages built from structure rather than from one document (docs/seo/KEYWORD-MAP.md):
 * the FAQ page collects the solutions' questions, and a Labs category page lists its assets.
 * Each description summarises what the page shows; it states no new fact. Titles stay the
 * structural labels the pages already use.
 */
import type { LabType } from "../routes";
import type { SeoView } from "../content/types";

export const structuralSeo: {
  faq: Pick<SeoView, "description">;
  labTypes: Partial<Record<LabType, Pick<SeoView, "description">>>;
} = {
  faq: {
    description:
      "Answers to common questions about each Vitalos solution: AI, process modernisation, digital products, legacy applications, data and platform recovery.",
  },
  labTypes: {
    // Only categories with published assets are pages (no empty category pages). Add one here
    // when a category gets its first asset.
    research: {
      description:
        "Research from Vitalos Labs: concepts and frameworks for AI evaluation, AI readiness and system takeover, each with an explicit maturity label.",
    },
  },
};
