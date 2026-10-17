/**
 * Structural UI labels.
 *
 * These are the names of page parts and of fields ("Audience", "Typical duration", "Related
 * offers"), taken from the Stage 9 section 21 to 23 template tables and the Stage 8 section 9
 * layer names. They describe what a block IS; they carry no marketing claim. Approved marketing
 * copy lives only in `@vitalos/cms` locked-copy.ts and everything else comes from the content files, so do
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
  /** The FAQ page title (Support menu, owner direction 15 Oct 2026). */
  faq: "Frequently asked questions",
  faqGroups: "Question groups",
  /** Closing links of the What We Do and Who We Are menu columns. */
  allSolutions: "All solutions",
  allLabs: "All Labs",
  allIndustries: "All industries",
  /** The Support menu's column of enquiry topics. */
  enquiries: "Enquiries",

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

  /** Product pages (owner direction, 17 Oct 2026). */
  atAGlance: "At a glance",
  productScreens: "More of the site",
} as const;

/** Display titles of the duration categories. */
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

/** Accessible names of a carousel's paging buttons, from the carousel's own name. Structural. */
/** Accessible name of the pause switch for looping background motion (hero, Industries; WCAG 2.2.2). */
export const heroMotionPauseLabel = "Pause background motion";

export function carouselLabels(label: string): { previousLabel: string; nextLabel: string } {
  return { previousLabel: `Previous: ${label}`, nextLabel: `Next: ${label}` };
}
