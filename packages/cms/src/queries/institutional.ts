/**
 * Trust, careers and legal queries.
 * Params: `$slug` (or `$topic` for trust items), `$statuses`, `$today`.
 */
import { defineQuery } from "groq";
import {
  jobSummary,
  legalPageSummary,
  ok,
  okEvidence,
  richTextFields,
  seoFields,
  trustTopicSummary,
} from "./fragments";

/**
 * Only certifications that are verified, public, scoped, dated and not expired. The evidence
 * pointer, owner and verification detail stay in the CMS.
 */
export const trustItemQuery =
  defineQuery(`*[_type == "trustItem" && topic == $topic && ${okEvidence}][0]{
  "id": _id,
  "editorialStatus": governance.editorialStatus,
  topic,
  title,
  summary,
  "updatedAt": _updatedAt,
  ${seoFields},
  "evidence": evidence{ evidenceStatus, classification, verifiedAt },
  "publicSummary": publicSummary[]${richTextFields},
  "certifications": certifications[evidence.evidenceStatus == "verified" && evidence.classification == "public" && defined(scope) && defined(issuedAt) && (!defined(expiresAt) || expiresAt >= $today)]{ name, scope, issuedAt, expiresAt, "evidence": evidence{ evidenceStatus, classification, verifiedAt } },
  "subprocessors": subprocessors[]{ name, purpose, location },
  contactEmail
}`);

export const trustItemSummariesQuery = defineQuery(
  `*[_type == "trustItem" && ${okEvidence}] | order(title asc)${trustTopicSummary}`,
);

export const jobQuery = defineQuery(`*[_type == "job" && slug.current == $slug && ${ok}][0]{
  "id": _id,
  "editorialStatus": governance.editorialStatus,
  "slug": slug.current,
  title,
  summary,
  "updatedAt": _updatedAt,
  ${seoFields},
  employmentType,
  location,
  datePosted,
  validThrough,
  status,
  applicationUrl,
  "description": description[]${richTextFields}
}`);

/** All eligible jobs, open or closed; the source decides which count as open (`$today`). */
export const jobSummariesQuery = defineQuery(
  `*[_type == "job" && ${ok}] | order(datePosted desc)${jobSummary}`,
);

export const legalPageQuery =
  defineQuery(`*[_type == "legalPage" && slug.current == $slug && ${ok}][0]{
  "id": _id,
  "editorialStatus": governance.editorialStatus,
  "slug": slug.current,
  title,
  version,
  effectiveDate,
  "body": body[]${richTextFields},
  ${seoFields}
}`);

export const legalPageSummariesQuery = defineQuery(
  `*[_type == "legalPage" && ${ok}] | order(title asc)${legalPageSummary}`,
);
