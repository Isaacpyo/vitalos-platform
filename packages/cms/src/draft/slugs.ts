/**
 * Slugs and ids of the draft documents. URL patterns follow Stage 8 §7 (for example
 * `/what-we-do/engineering`, `/solutions/ai-transformation`, `/industries/health-care`): lower
 * case, hyphenated, ampersands dropped.
 */

export const practiceSlugs = [
  "consulting",
  "engineering",
  "ai-data",
  "experience",
  "managed-services",
] as const;
export type PracticeSlug = (typeof practiceSlugs)[number];

export const solutionSlugs = [
  "ai-transformation",
  "business-process-modernisation",
  "digital-product-transformation",
  "application-modernisation",
  "data-intelligence-transformation",
  "technology-recovery-reliability",
] as const;
export type SolutionSlug = (typeof solutionSlugs)[number];

export const offerSlugs = [
  "digital-transformation-discovery",
  "technology-health-assessment",
  "ai-opportunity-assessment",
  "ai-prototype-sprint",
  "custom-digital-product",
  "application-modernisation",
  "systems-integration",
  "business-process-automation",
  "data-bi-modernisation",
  "customer-experience-transformation",
  "engineering-rescue",
  "managed-engineering-application-care",
  "product-discovery",
] as const;
export type OfferSlug = (typeof offerSlugs)[number];

export const industrySlugs = [
  "health-care",
  "retail-commerce-consumer",
  "operations-industry-logistics",
  "growth-technology",
] as const;
export type IndustrySlug = (typeof industrySlugs)[number];

/** Document id of a draft document: `<type>-<slug>`. The same id is used in the Sanity export. */
export const draftId = (type: string, slug: string): string => `${type}-${slug}`;

/** Date the draft content was written; used as `updatedAt` on every draft document. */
export const DRAFTED_ON = "2026-10-10";
