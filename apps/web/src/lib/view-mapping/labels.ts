/**
 * Structural UI labels.
 *
 * These are the names of page parts and of fields ("Audience", "Typical duration", "Related
 * offers"), taken from the Stage 9 section 21 to 23 template tables and the Stage 8 section 9
 * layer names. They describe what a block IS; they carry no marketing claim. Approved marketing
 * copy lives only in `@vitalos/cms` locked-copy.ts and everything else comes from Sanity, so do
 * not add sentences or claims here.
 */
import { megaMenuColumns, navLabels } from "@vitalos/cms";
import type { EngagementBasis } from "@vitalos/cms";

export const structuralLabels = {
  home: "Home",
  /** Stage 8 section 9 layer names. "Practices" and "Solutions" are locked mega-menu column titles. */
  practices: megaMenuColumns.practices,
  solutions: megaMenuColumns.solutions,
  offers: "Offers",
  industries: navLabels.industries,
  work: navLabels.work,
  insights: navLabels.insights,
  labs: navLabels.labs,
  trustCentre: navLabels.trustCentre,
  howWeWork: navLabels.howWeWork,
  whatWeDo: navLabels.whatWeDo,
  leadership: navLabels.leadership,

  /** Stage 9 section 21 (Practice page template). */
  problems: "Problems",
  capabilities: "Capabilities",
  relatedSolutions: "Related solutions",
  relatedOffers: "Related offers",
  relatedPractices: "Related practices",
  relatedIndustries: "Industries",
  selectedWork: "Selected work",
  relatedInsights: "Insights",

  /** Stage 9 section 22 (Solution page). */
  signals: "Signals",
  impact: "Business impact",
  approach: "Approach",
  journey: "Typical journey",
  questions: "Common questions",

  /** Stage 9 section 22 (Offer page). */
  engagement: "Engagement summary",
  audience: "Who this is for",
  trigger: "Problem or trigger",
  scope: "What Vitalos does",
  duration: "Typical duration",
  nextStep: "How this connects to the next phase",
  outputs: "What you receive",
  requirements: "What we need from you",
  exclusions: "What this does not include",

  /** Stage 9 section 23 (Industry page). */
  realities: "Sector realities",
  industryProblems: "Priority problems",
  aiOpportunities: "AI opportunities",
  considerations: "Trust and regulatory considerations",

  /** Facts on case-study summaries. */
  client: "Client",
  engagementBasis: "Basis",
} as const;

/** Display titles of the Studio duration list (`durationCategoryList` in the CMS schema). */
const durationLabels: Readonly<Record<string, string>> = {
  short: "Short engagement",
  medium: "Medium engagement",
  long: "Long engagement",
  ongoing: "Ongoing",
};

/** Duration category as text. An unknown value is shown as authored rather than hidden or guessed. */
export function durationLabel(category: string | undefined): string | undefined {
  const value = category?.trim();
  if (!value) return undefined;
  return durationLabels[value] ?? value;
}

/** Stage 10 section 17 (Evidence rule): the engagement basis, stated plainly. */
const engagementLabels: Readonly<Record<EngagementBasis, string>> = {
  "contracted-by-vitalos": "Contracted by Vitalos",
  "prior-team-experience": "Prior team experience",
};

export function engagementBasisLabel(basis: EngagementBasis): string {
  return engagementLabels[basis];
}
