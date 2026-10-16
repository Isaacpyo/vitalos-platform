import type { CareersPageData, ClosedRoleData, RoleDetailData } from "../schemas";
import type { z } from "zod";
import type { RoleSummary } from "../schemas";
import { CAREERS_BASE } from "../routes";

/**
 * Pure view models for the Careers pages (brief 6.1, 6.2, 6.5). No framework imports.
 */

export type RoleSummaryData = z.output<typeof RoleSummary>;
export type RoleDetail = RoleDetailData;
export type ClosedRole = ClosedRoleData;

export const careersCopy = {
  eyebrow: "CAREERS",
  seeOpenRoles: "See open roles",
  howWeWork: "How we work",
  openRoles: "Open roles",
  introduceYourself: "Introduce yourself",
  allOpenRoles: "All open roles",
  aboutCareers: "About careers",
  applyForRole: "Apply for this role",
  opensNewSite: "opens a new site",
  benefits: "Benefits",
  howWeHire: "How we hire",
  salaryPolicy: "Salary policy",
  equalOpportunities: "Equal opportunities",
  filterBy: "Filter roles",
  allRoles: "All roles",
  closedLabel: (date: string) => `CLOSED · ${date}`.toUpperCase(),
  closedText: (date: string) => `This role closed on ${date}.`,
  closes: (date: string) => `Closes ${date}`,
  notOpenYet:
    "Applications are not open yet. Please check back soon, or get in touch through the contact page.",
  titleSuffix: "Careers at Vitalos",
} as const;

/** The role page's sections, in order (brief 6.2). Empty ones are not shown. */
export const roleSections = [
  { key: "about", heading: "About the role" },
  { key: "responsibilities", heading: "What you'll do" },
  { key: "requirements", heading: "What you'll bring" },
  { key: "niceToHave", heading: "Nice to have" },
  { key: "process", heading: "How we hire" },
  { key: "equalOpportunities", heading: "Equal opportunities" },
] as const;

export const rolePathOf = (slug: string): string => `${CAREERS_BASE}/${slug}`;

/** "{title} | Careers at Vitalos". */
export const careersTitle = (title: string): string =>
  title.trim() ? `${title.trim()} | ${careersCopy.titleSuffix}` : careersCopy.titleSuffix;

/** The fixed practice order (brief 6.1). */
export const practiceOrder = [
  "consulting",
  "engineering",
  "ai_data",
  "experience",
  "managed_services",
  "labs",
] as const;

const upper = (value: string) => value.toUpperCase();

/** Mono facts: "ENGINEERING · SENIOR · HYBRID · {LOCATION} · PERMANENT" (level only when shown). */
export function roleFactsLine(role: RoleSummaryData): string {
  return [
    role.practice.label,
    ...(role.level ? [role.level.label] : []),
    role.workModel.label,
    role.location,
    role.employmentType.label,
  ]
    .filter((part) => part.trim() !== "")
    .map(upper)
    .join(" · ");
}

export const closesLine = (role: RoleSummaryData): string | null =>
  role.closesAt ? careersCopy.closes(role.closesAt.short) : null;

export interface Fact {
  label: string;
  value: string;
}

/** The role page's facts grid (brief 6.2), each only when it has a value. */
export function roleFacts(role: RoleDetail): Fact[] {
  return [
    { label: "PRACTICE", value: role.practice.label },
    ...(role.level ? [{ label: "LEVEL", value: role.level.label }] : []),
    ...(role.location.trim() ? [{ label: "LOCATION", value: role.location }] : []),
    { label: "WORK MODEL", value: role.workModel.label },
    { label: "EMPLOYMENT", value: role.employmentType.label },
    ...(role.salary ? [{ label: "SALARY", value: role.salary.label }] : []),
    ...(role.sponsorship ? [{ label: "VISA SPONSORSHIP", value: role.sponsorship.label }] : []),
    ...(role.closesAt ? [{ label: "CLOSES", value: role.closesAt.long }] : []),
  ];
}

// ---------------------------------------------------------------------------------------------
// The careers page: groups and filters
// ---------------------------------------------------------------------------------------------

/** Filters appear only when more than this many roles are open (brief 6.1). */
export const FILTER_THRESHOLD = 6;

export const filterDimensions = ["practice", "workModel", "employmentType"] as const;
export type FilterDimension = (typeof filterDimensions)[number];

export interface CareersFilter {
  dimension: FilterDimension;
  value: string;
}

export const isFilterDimension = (value: string): value is FilterDimension =>
  (filterDimensions as readonly string[]).includes(value);

/** `/careers` or `/careers?{dimension}={value}`. */
export const careersHref = (filter?: CareersFilter): string =>
  filter
    ? `${CAREERS_BASE}?${new URLSearchParams({ [filter.dimension]: filter.value }).toString()}`
    : CAREERS_BASE;

const valueOf = (
  role: RoleSummaryData,
  dimension: FilterDimension,
): { key: string; label: string } => role[dimension];

export interface RoleGroup {
  practice: { key: string; label: string };
  roles: RoleSummaryData[];
}

/** Open roles by practice in the fixed order, empty groups left out, optionally filtered. */
export function groupRoles(page: CareersPageData, filter?: CareersFilter): RoleGroup[] {
  const order = (key: string) => {
    const index = (practiceOrder as readonly string[]).indexOf(key);
    return index === -1 ? practiceOrder.length : index;
  };
  return [...page.groups]
    .sort((a, b) => order(a.practice.key) - order(b.practice.key))
    .map((group) => ({
      practice: group.practice,
      roles: filter
        ? group.roles.filter((role) => valueOf(role, filter.dimension).key === filter.value)
        : [...group.roles],
    }))
    .filter((group) => group.roles.length > 0);
}

export interface FilterGroup {
  dimension: FilterDimension;
  label: string;
  options: { label: string; href: string; current: boolean }[];
}

const dimensionLabels: Record<FilterDimension, string> = {
  practice: "Practice",
  workModel: "Work model",
  employmentType: "Employment type",
};

/** Filters as links, only when more than six roles are open (brief 6.1). */
export function filterGroups(page: CareersPageData, active?: CareersFilter): FilterGroup[] {
  if (page.total <= FILTER_THRESHOLD) return [];
  const roles = page.groups.flatMap((group) => group.roles);
  return filterDimensions
    .map((dimension) => {
      const seen = new Map<string, string>();
      for (const role of roles)
        seen.set(valueOf(role, dimension).key, valueOf(role, dimension).label);
      return {
        dimension,
        label: dimensionLabels[dimension],
        options: [...seen].map(([value, label]) => ({
          label,
          href: careersHref({ dimension, value }),
          current: active?.dimension === dimension && active.value === value,
        })),
      };
    })
    .filter((group) => group.options.length > 1);
}

/** The label of an active filter, for its page title; null when the value matches no role. */
export function filterLabel(page: CareersPageData, filter: CareersFilter): string | null {
  for (const role of page.groups.flatMap((group) => group.roles)) {
    const value = valueOf(role, filter.dimension);
    if (value.key === filter.value) return value.label;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------------------------

export interface ApplyLink {
  href: string;
  external: boolean;
}

/** The form anchor, or an https external URL (brief section 9); null when neither is usable. */
export function applyLink(role: RoleDetail): ApplyLink | null {
  if (role.apply.mode === "form") return { href: "#apply", external: false };
  const url = role.apply.externalUrl;
  if (!url || !URL.canParse(url) || new URL(url).protocol !== "https:") return null;
  return { href: url, external: true };
}

/** A privacy notice link usable in the consent text: a site path or an https URL. */
export function privacyNoticeHref(url: string | null): string | null {
  if (!url) return null;
  if (/^\/(?![/\\])[^\s\\]*$/.test(url)) return url;
  return URL.canParse(url) && new URL(url).protocol === "https:" ? url : null;
}

// ---------------------------------------------------------------------------------------------
// JobPosting
// ---------------------------------------------------------------------------------------------

const employmentTypes: Record<string, string> = {
  permanent_full_time: "FULL_TIME",
  permanent_part_time: "PART_TIME",
  fixed_term: "TEMPORARY",
  contract: "CONTRACTOR",
  associate: "CONTRACTOR",
};

const validDate = (iso: string | undefined) =>
  iso !== undefined && !Number.isNaN(Date.parse(iso)) ? iso : undefined;

/**
 * `JobPosting` for an open role (brief 6.2), or null when any required field is missing:
 * title, description (the rendered role text), datePosted, a mapped employment type, the hiring
 * organisation (name and URL) and a location (an address locality, or remote with the United
 * Kingdom as the applicant location). Nothing is fabricated: `validThrough` only with a closing
 * date, `baseSalary` only when the salary is shown, `directApply` only for form roles.
 */
export function jobPostingJsonLd(
  role: RoleDetail,
  input: {
    siteUrl: string;
    descriptionHtml: string;
    organization: { name: string; url: string; logo?: unknown };
  },
): Record<string, unknown> | null {
  if (role.state !== "open") return null;
  const title = role.title.trim();
  const description = input.descriptionHtml.trim();
  const datePosted = validDate(role.datePosted.iso);
  const employmentType = employmentTypes[role.employmentType.key];
  const remote = role.workModel.key === "remote";
  const locality = role.location.trim();
  const { name, url } = input.organization;
  if (!title || !description || !datePosted || !employmentType || !name || !url) return null;
  if (!remote && !locality) return null;
  const validThrough = validDate(role.closesAt?.iso);
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "@id": `${new URL(rolePathOf(role.slug), input.siteUrl).toString()}#job`,
    title,
    description,
    datePosted,
    ...(validThrough ? { validThrough } : {}),
    employmentType,
    hiringOrganization: {
      "@type": "Organization",
      name,
      url,
      ...(input.organization.logo ? { logo: input.organization.logo } : {}),
    },
    ...(remote
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: { "@type": "Country", name: "United Kingdom" },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: locality },
          },
        }),
    ...(role.salary
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: role.salary.currency,
            value: {
              "@type": "QuantitativeValue",
              minValue: role.salary.min,
              maxValue: role.salary.max,
              unitText: role.salary.period === "day" ? "DAY" : "YEAR",
            },
          },
        }
      : {}),
    ...(role.apply.mode === "form" ? { directApply: true } : {}),
    url: new URL(rolePathOf(role.slug), input.siteUrl).toString(),
  };
}
