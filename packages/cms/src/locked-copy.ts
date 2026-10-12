/**
 * Locked copy: the ONLY place approved, owner-locked strings live in code.
 *
 * Every string cites the spec section it comes from and is copied verbatim. Everything else
 * shown on the website comes from the repo content files (packages/cms/src/repo, ADR-028). Do not add marketing copy, client names, outcomes,
 * metrics, testimonials, certifications, bios or legal claims here.
 *
 * Source abbreviations: "Stage N §M" refers to the Vitalos stage specification documents.
 */

/** Category descriptor / hero eyebrow. Stage 0 §0 (Authoritative Vitalos context); Stage 8 §8 (Homepage hero); Stage 11 §9. */
export const descriptor = "Technology Consulting, Engineering & Digital Transformation";

/** Commercial proposition; the homepage H1. Stage 0 §0; Stage 8 §8 (Homepage hero); Stage 11 §9 (H1). */
export const proposition =
  "We help ambitious organisations modernise operations, build digital products and adopt AI.";

/** Brand line; supporting line beneath the H1, never the H1. Stage 0 §0; Stage 8 §8 (Homepage hero). */
export const brandLine = "From strategy to production.";

/** Masterbrand name. Stage 0 §0. */
export const brandName = "Vitalos";

/** Interim text wordmark until the approved logo export is supplied. Stage 9 §12 ("Vitalos wordmark"). */
export const wordmarkText = "VITALOS";

/** Calls to action. Stage 8 §8 (primary and secondary hero CTA); Stage 8 §20 (Primary CTA). */
export const ctas = {
  primary: "Talk to Vitalos",
  secondary: "Explore what we do",
} as const;

/** Navigation labels. Stage 8 §6 (Desktop primary nav); Stage 9 §12 (Header). */
export const navLabels = {
  whatWeDo: "What We Do",
  industries: "Industries",
  work: "Work",
  insights: "Insights",
  labs: "Labs",
  about: "About",
  /** Utility link. Stage 8 §6; Stage 9 §12. */
  trustCentre: "Trust Centre",
  /** Stage 8 §6 (Utility/footer navigation). */
  contact: "Contact",
  careers: "Careers",
  leadership: "Leadership",
  legal: "Legal",
  accessibility: "Accessibility",
  /** Stage 8 §6 (What We Do mega-menu, Explore column). */
  howWeWork: "How We Work",
  allWhatWeDo: "All What We Do",
} as const;

/** What We Do mega-menu column titles. Stage 8 §6 (What We Do mega-menu); Stage 9 §12 (Mega-menu). */
export const megaMenuColumns = {
  practices: "Practices",
  solutions: "Solutions",
  popularOffers: "Popular offers",
  explore: "Explore",
} as const;

/** Footer column titles. Stage 11 §30 (Footer & terminal CTA system). */
export const footerColumns = {
  whatWeDo: "What We Do",
  explore: "Explore",
  company: "Company",
  trust: "Trust",
  legal: "Legal",
} as const;

/** The five practices (names). Stage 8 §5, §6 (mega-menu), §9, §10 (the five practice pages). */
export const practiceNames = [
  "Consulting",
  "Engineering",
  "AI & Data",
  "Experience",
  "Managed Services",
] as const;

/** Display form: "Vitalos {practice}". Stage 8 §10 (The five practice pages). Labs is not a practice here. */
export const practiceDisplayName = (name: (typeof practiceNames)[number]): string =>
  `${brandName} ${name}`;

/** Solutions (names). Stage 8 §6 (mega-menu), §11 (Initial five); Stage 10 §12. */
export const solutionNames = [
  "AI Transformation",
  "Business Process Modernisation",
  "Digital Product Transformation",
  "Application Modernisation",
  "Data & Intelligence Transformation",
] as const;

/** Offers (names). Stage 8 §12 (Initial offer set). */
export const offerNames = [
  "Digital Transformation Discovery",
  "Technology Health Assessment",
  "AI Opportunity Assessment",
  "AI Prototype Sprint",
  "Custom Digital Product",
  "Application Modernisation",
  "Systems Integration",
  "Business Process Automation",
  "Data & BI Modernisation",
  "Customer Experience Transformation",
  "Engineering Rescue",
  "Managed Engineering & Application Care",
] as const;

/** Priority offers (names). Stage 10 §12 (Launch-critical pages, "Offers - priority"). */
export const priorityOfferNames = [
  "AI Opportunity Assessment",
  "AI Prototype Sprint",
  "Technology Health Assessment",
  "Digital Transformation Discovery",
  "Engineering Rescue",
  "Managed Engineering & Application Care",
] as const;

/** Industry pages (names). Stage 8 §5, §13 (Launch verticals); Stage 10 §12. */
export const industryNames = [
  "Health & Care",
  "Retail, Commerce & Consumer",
  "Operations, Industry & Logistics",
  "Growth & Technology",
] as const;

/** Signature AI journey stages, in order. Stage 9 §19 (Signature AI journey). */
export const aiJourneyStages = [
  "Opportunity Assessment",
  "Prototype",
  "Production",
  "Managed AI",
] as const;

/** How We Work delivery stages, in order. Stage 8 §17 (How We Work). */
export const howWeWorkStages = [
  "Qualify",
  "Discover",
  "Define",
  "Design",
  "Engineer",
  "Validate",
  "Release",
  "Operate",
  "Improve",
] as const;

/** Labs content types (display labels). Stage 8 §15 (Labs content types). Slugs live in routes.ts. */
export const labTypeLabels = {
  research: "Research",
  "reference-architectures": "Reference Architectures",
  demonstrators: "Demonstrators",
  accelerators: "Accelerators",
  "open-source": "Open Source",
  experiments: "Experiments",
  "product-incubation": "Product Incubation",
} as const;

/** Labs maturity labels. Stage 8 §15 (Maturity labels); Stage 9 §19 (Lab maturity badge). */
export const labMaturityLabels = {
  research: "Research",
  concept: "Concept",
  prototype: "Prototype",
  accelerator: "Accelerator",
  beta: "Beta / Pilot",
  "production-product": "Production product",
} as const;

/** Trust Centre topics (display labels). Stage 8 §18 (Trust Centre architecture). Slugs live in routes.ts. */
export const trustTopicLabels = {
  security: "Security",
  privacy: "Privacy",
  "responsible-ai": "Responsible AI",
  accessibility: "Accessibility",
  resilience: "Resilience",
  subprocessors: "Subprocessors",
  certifications: "Certifications",
  procurement: "Procurement",
} as const;

/**
 * Homepage sections, in order. Stage 8 §8 (Homepage architecture) names the sections; those names
 * are STRUCTURAL labels for editors, tests and analytics and are never rendered.
 *
 * `visibleHeading` is present only where a spec quotes a visitor-facing title, and is cited per
 * entry. It is the spec-quoted value and is not a render
 * fallback: visible headings come from the content source (`HomePageView.headings`) and a section renders no
 * heading when none is set. Titles marked "mockup brief" are quoted in Stage 11 §9 image prompts
 * and still need owner confirmation before use as production copy.
 */
export const homeSections = [
  { key: "hero", structuralLabel: "Hero" },
  { key: "credibility", structuralLabel: "Credibility strip" },
  {
    key: "problems",
    structuralLabel: "Problems we solve",
    /** Stage 11 §9 mockup brief, item 2. */
    visibleHeading: "Problems we solve",
  },
  {
    key: "strategyToProduction",
    structuralLabel: "From strategy to production",
    /** Stage 11 §9 mockup brief, item 3 (also the brand line, Stage 8 §8). */
    visibleHeading: "From strategy to production",
  },
  {
    key: "practices",
    structuralLabel: "Practices",
    /** Stage 11 §9 mockup brief, item 4. */
    visibleHeading: "Five practices, one firm",
  },
  {
    key: "aiAtTheCentre",
    structuralLabel: "AI at the centre",
    /** Stage 11 §9 mockup brief, item 5. */
    visibleHeading: "AI at the centre",
  },
  {
    key: "selectedWork",
    structuralLabel: "Selected Work",
    /** Stage 11 §9 mockup brief, item 6. */
    visibleHeading: "Selected Work",
  },
  { key: "industries", structuralLabel: "Industries" },
  { key: "trust", structuralLabel: "Trust" },
  { key: "labs", structuralLabel: "Labs" },
  { key: "insights", structuralLabel: "Insights" },
  { key: "leadership", structuralLabel: "Leadership" },
  {
    key: "finalConversion",
    structuralLabel: "Final conversion",
    /** Stage 11 §9 mockup brief, item 12; Stage 11 §30. */
    visibleHeading: "Bring us the problem.",
  },
] as const satisfies readonly {
  key: string;
  structuralLabel: string;
  visibleHeading?: string;
}[];

export type HomeSectionKey = (typeof homeSections)[number]["key"];

export const lockedCopy = {
  descriptor,
  proposition,
  brandLine,
  brandName,
  wordmarkText,
  ctas,
  navLabels,
  megaMenuColumns,
  footerColumns,
  practiceNames,
  solutionNames,
  offerNames,
  priorityOfferNames,
  industryNames,
  aiJourneyStages,
  howWeWorkStages,
  labTypeLabels,
  labMaturityLabels,
  trustTopicLabels,
  homeSections,
} as const;
