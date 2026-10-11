/**
 * Case study, insight, person and lab asset queries.
 * Params: `$slug` (+ `$labType` for lab assets), `$statuses`, `$today`.
 *
 * Never projected: `evidenceReference`, `evidenceOwner`, `permissionEvidence` (only a computed
 * "named client permitted" boolean leaves the CMS).
 */
import { defineQuery } from "groq";
import {
  baseFields,
  basicSummary,
  caseStudySummary,
  evidenceFields,
  identityFields,
  imageFields,
  insightSummary,
  labAssetSummary,
  metricFields,
  ok,
  okEvidence,
  okInsight,
  okLab,
  personSummary,
  richTextFields,
  seoFields,
} from "./fragments";

export const caseStudyQuery =
  defineQuery(`*[_type == "caseStudy" && slug.current == $slug && ${okEvidence}][0]{
  ${baseFields},
  engagementBasis,
  clientDisplay,
  anonymisedDescriptor,
  "namedPermitted": clientDisplay == "named" && permissionEvidence.evidenceStatus == "verified" && defined(clientName),
  "clientName": select(clientDisplay == "named" && permissionEvidence.evidenceStatus == "verified" => clientName),
  sector,
  "challenge": challenge[]${richTextFields},
  "approach": approach[]${richTextFields},
  "outcome": outcome[]${richTextFields},
  "metrics": metrics[evidence.evidenceStatus == "verified" && evidence.classification == "public"]${metricFields},
  "testimonial": select(testimonial.permissionStatus == "granted" => testimonial{ quote, attribution, role, permissionStatus }),
  "evidence": evidence${evidenceFields},
  "practices": coalesce(practices[]->[${ok}]${basicSummary}, []) + *[_type == "practice" && ^._id in work[]._ref && ${ok}]${basicSummary},
  "solutions": coalesce(solutions[]->[${ok}]${basicSummary}, []) + *[_type == "solution" && ^._id in work[]._ref && ${ok}]${basicSummary},
  "industries": coalesce(industries[]->[${ok}]${basicSummary}, []) + *[_type == "industry" && ^._id in work[]._ref && ${ok}]${basicSummary}
}`);

export const caseStudySummariesQuery = defineQuery(
  `*[_type == "caseStudy" && ${okEvidence}] | order(title asc)${caseStudySummary}`,
);

export const insightQuery =
  defineQuery(`*[_type == "insight" && slug.current == $slug && ${okInsight}][0]{
  ${identityFields},
  "updatedAt": coalesce(updatedAt, _updatedAt),
  ${seoFields},
  format,
  topics,
  "authors": authors[]->[${ok}]${personSummary},
  publishedAt,
  "body": body[]${richTextFields},
  "related": coalesce(related[]->[${okInsight}]${insightSummary}, []) + *[_type == "insight" && ^._id in related[]._ref && ${okInsight}]${insightSummary}
}`);

export const insightSummariesQuery = defineQuery(
  `*[_type == "insight" && ${okInsight}] | order(publishedAt desc)${insightSummary}`,
);

export const personQuery = defineQuery(`*[_type == "person" && slug.current == $slug && ${ok}][0]{
  "id": _id,
  "editorialStatus": governance.editorialStatus,
  "slug": slug.current,
  name,
  "title": name,
  summary,
  "updatedAt": _updatedAt,
  ${seoFields},
  role,
  isLeadership,
  "bio": bio[]${richTextFields},
  "portrait": select(portrait.rightsStatus == "approved" => portrait${imageFields}),
  "credentials": credentials[evidence.evidenceStatus == "verified" && evidence.classification == "public"]{ label, "evidence": evidence${evidenceFields} },
  "sameAs": sameAs[verified == true]{ label, url, verified },
  "insights": *[_type == "insight" && ^._id in authors[]._ref && ${okInsight}] | order(publishedAt desc)${insightSummary}
}`);

export const personSummariesQuery = defineQuery(
  `*[_type == "person" && ${ok}] | order(name asc)${personSummary}`,
);

export const labAssetQuery =
  defineQuery(`*[_type == "labAsset" && labType == $labType && slug.current == $slug && ${okLab}][0]{
  ${baseFields},
  labType,
  maturity,
  is,
  isNot,
  limitations,
  "body": body[]${richTextFields},
  maintained,
  "repoUrl": select(maintained == true => repoUrl),
  "demoUrl": select(maintained == true => demoUrl),
  "supportVerified": supportEvidence.evidenceStatus == "verified",
  "evidence": evidence${evidenceFields}
}`);

export const labAssetSummariesQuery = defineQuery(
  `*[_type == "labAsset" && ${okLab}] | order(title asc)${labAssetSummary}`,
);
