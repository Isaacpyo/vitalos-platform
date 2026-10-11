/**
 * Enumerations shared by schema types and their validation rules. Pure data; no Sanity runtime.
 * Spec references: Stage 8 §12-16, §21; Stage 10 §9, §15-20; Stage 0 §39.
 */
import { contactIntents, labTypes, routePageKeys, trustTopics, legalSlugs } from "../routes";
import { labMaturities } from "../content/types";

/** API version used by Studio-side clients (validation lookups, redirect creation). */
export const studioApiVersion = "2025-02-19";

/** Hidden `locale` field on every document. A future locale layer is anticipated in Stage 0. */
export const defaultLocale = "en-GB";

export interface ListEntry {
  title: string;
  value: string;
}

export const editorialStatuses = [
  "draft",
  "review",
  "approved",
  "needs-review",
  "archived",
] as const;
export type EditorialStatus = (typeof editorialStatuses)[number];
export const editorialStatusList: readonly ListEntry[] = [
  { title: "Draft", value: "draft" },
  { title: "In review (awaiting approval)", value: "review" },
  { title: "Approved", value: "approved" },
  { title: "Needs review", value: "needs-review" },
  { title: "Archived", value: "archived" },
];

export const evidenceStatuses = ["verified", "pending", "n/a"] as const;
export type EvidenceStatus = (typeof evidenceStatuses)[number];

/** `public` content may be projected to the website; `controlled` content never is. Stage 6 §14. */
export const classifications = ["public", "controlled"] as const;
export type Classification = (typeof classifications)[number];

export const rightsStatuses = ["approved", "pending"] as const;
export type RightsStatus = (typeof rightsStatuses)[number];

export const permissionStatuses = ["granted", "pending"] as const;
export type PermissionStatus = (typeof permissionStatuses)[number];

/** CTA intents: the contact intents of Stage 8 §20 plus navigation-only intents. */
export const ctaIntents = [...contactIntents, "explore", "read", "download"] as const;

/** Link labels that tell the visitor nothing (Stage 9 §15 link text guidance). Compared lower-case. */
export const genericCtaLabels = ["learn more", "read more", "click here", "here", "more"] as const;

export const engagementBases = ["contracted-by-vitalos", "prior-team-experience"] as const;
export const engagementBasisList: readonly ListEntry[] = [
  { title: "Contracted by Vitalos", value: "contracted-by-vitalos" },
  { title: "Prior founder / team experience", value: "prior-team-experience" },
];
export const clientDisplays = ["named", "anonymised"] as const;

/** Stage 8 §16 (Formats). */
export const insightFormatList: readonly ListEntry[] = [
  { title: "Insight article", value: "insight-article" },
  { title: "Executive briefing", value: "executive-briefing" },
  { title: "Engineering note", value: "engineering-note" },
  { title: "Research report", value: "research-report" },
  { title: "Guide / playbook", value: "guide-playbook" },
  { title: "Case study insight", value: "case-study-insight" },
  { title: "Webinar / event recap", value: "webinar-event-recap" },
];

/** Stage 8 §16 (Topics). */
export const insightTopicList: readonly ListEntry[] = [
  { title: "AI & Agents", value: "ai-agents" },
  { title: "Digital Transformation", value: "digital-transformation" },
  { title: "Software & Platforms", value: "software-platforms" },
  { title: "Data & Analytics", value: "data-analytics" },
  { title: "Cloud & Reliability", value: "cloud-reliability" },
  { title: "Experience & Commerce", value: "experience-commerce" },
  { title: "Cyber / Trust (only where capability is genuine)", value: "cyber-trust" },
  { title: "Health & Care", value: "health-care" },
  { title: "Retail / Commerce", value: "retail-commerce" },
  { title: "Operations / Industry / Logistics", value: "operations-industry-logistics" },
];

/**
 * Offer "timeframe category" (Stage 8 §12 "likely timeframe category"). The spec does not fix the
 * categories, so these are deliberately coarse and need owner confirmation. Never a price.
 */
export const durationCategoryList: readonly ListEntry[] = [
  { title: "Short engagement", value: "short" },
  { title: "Medium engagement", value: "medium" },
  { title: "Long engagement", value: "long" },
  { title: "Ongoing", value: "ongoing" },
];

export const employmentTypeList: readonly ListEntry[] = [
  { title: "Full time", value: "full-time" },
  { title: "Part time", value: "part-time" },
  { title: "Contract", value: "contract" },
  { title: "Temporary", value: "temporary" },
  { title: "Internship", value: "internship" },
];

export const jobStatuses = ["open", "closed"] as const;

export const redirectStatusCodes = [301, 308, 410] as const;
export type RedirectStatusCode = (typeof redirectStatusCodes)[number];

export const codeLanguageList: readonly ListEntry[] = [
  { title: "TypeScript", value: "typescript" },
  { title: "JavaScript", value: "javascript" },
  { title: "Python", value: "python" },
  { title: "SQL", value: "sql" },
  { title: "Shell", value: "shell" },
  { title: "JSON", value: "json" },
  { title: "YAML", value: "yaml" },
  { title: "Plain text", value: "text" },
];

export const calloutTones = ["info", "note", "caution"] as const;

export const labTypeList: readonly ListEntry[] = labTypes.map((value) => ({ title: value, value }));
export const maturityList: readonly ListEntry[] = labMaturities.map((value) => ({
  title: value,
  value,
}));
export const trustTopicList: readonly ListEntry[] = trustTopics.map((value) => ({
  title: value,
  value,
}));
export const routeKeyList: readonly ListEntry[] = routePageKeys.map((value) => ({
  title: value,
  value,
}));
export const legalSlugList: readonly ListEntry[] = legalSlugs.map((value) => ({
  title: value,
  value,
}));
export const contactIntentList: readonly ListEntry[] = contactIntents.map((value) => ({
  title: value,
  value,
}));

/** Document types that have exactly one document (pinned in the desk, no create/duplicate/delete). */
export const singletonTypes = ["homePage", "siteSettings"] as const;
export type SingletonType = (typeof singletonTypes)[number];
export const isSingletonType = (type: string): type is SingletonType =>
  (singletonTypes as readonly string[]).includes(type);

/** Document types whose documents carry a routable `slug`. */
export const slugDocumentTypes = [
  "practice",
  "solution",
  "offer",
  "industry",
  "caseStudy",
  "insight",
  "person",
  "labAsset",
  "job",
  "legalPage",
] as const;

/** Every document type in the model. Order is the order of `schemaTypes`. */
export const documentTypeNames = [
  "practice",
  "solution",
  "offer",
  "industry",
  "caseStudy",
  "insight",
  "person",
  "labAsset",
  "trustItem",
  "job",
  "legalPage",
  "routePage",
  "homePage",
  "siteSettings",
  "redirect",
] as const;
export type DocumentTypeName = (typeof documentTypeNames)[number];
