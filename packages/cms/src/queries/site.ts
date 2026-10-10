/**
 * Site-level queries: settings, gate counts, route pages, the homepage and the sitemap.
 * Params: `$statuses`, `$today` (and `$key` for route pages).
 */
import { defineQuery } from "groq";
import {
  basicSummary,
  caseStudySummary,
  ctaFields,
  evidenceFields,
  imageFields,
  insightSummary,
  labAssetSummary,
  ok,
  okEvidence,
  okInsight,
  okLab,
  personSummary,
  richTextFields,
  seoFields,
  trustTopicSummary,
} from "./fragments";

export const siteSettingsQuery = defineQuery(`*[_type == "siteSettings" && ${ok}][0]{
  "editorialStatus": governance.editorialStatus,
  legalName,
  companyNumber,
  registeredAddress,
  contactEmail,
  securityEmail,
  "social": social[verified == true]{ label, href, verified },
  "defaultSeo": defaultSeo{ title, description, noindex, "ogImage": select(ogImage.rightsStatus == "approved" => ogImage${imageFields}) },
  "logo": select(logo.rightsStatus == "approved" => logo${imageFields})
}`);

/**
 * Counts of qualifying documents per publication gate (ADR-022):
 * Work counts verified case studies; Insights counts insights with a named author; Careers counts
 * open roles whose `validThrough` has not passed.
 */
export const gateCountsQuery = defineQuery(`{
  "work": count(*[_type == "caseStudy" && ${okEvidence} && evidence.evidenceStatus == "verified"]),
  "insights": count(*[_type == "insight" && ${okInsight}]),
  "labs": count(*[_type == "labAsset" && ${okLab}]),
  "industries": count(*[_type == "industry" && ${ok}]),
  "careers": count(*[_type == "job" && ${ok} && status == "open" && (!defined(validThrough) || validThrough >= $today)])
}`);

export const routePageQuery = defineQuery(`*[_type == "routePage" && routeKey == $key && ${ok}][0]{
  "editorialStatus": governance.editorialStatus,
  "key": routeKey,
  heading,
  intro,
  "body": body[]${richTextFields},
  ${seoFields},
  "cta": cta${ctaFields},
  "expectations": expectations[]${richTextFields},
  successMessage,
  "routes": routes[]{ intent, label, description }
}`);

export const homePageQuery = defineQuery(`*[_type == "homePage" && ${ok}][0]{
  "editorialStatus": governance.editorialStatus,
  ${seoFields},
  "homeSections": homeSections[]{ sectionKey, visibleHeading },
  "proof": proof[evidence.evidenceStatus == "verified" && evidence.classification == "public"]{ label, href, "evidence": evidence${evidenceFields} },
  "solutions": solutions[]->[${ok}]${basicSummary},
  "practices": practices[]->[${ok}]${basicSummary},
  "selectedWork": selectedWork[]->[${okEvidence} && evidence.evidenceStatus == "verified"]${caseStudySummary},
  "industries": industries[]->[${ok}]${basicSummary},
  "labs": labs[]->[${okLab}]${labAssetSummary},
  "insights": insights[]->[${okInsight}]${insightSummary},
  "leadership": leadership[]->[${ok}]${personSummary},
  "trustHighlights": trustHighlights[]->[${okEvidence}]${trustTopicSummary},
  "finalCta": finalCta${ctaFields}
}`);

/**
 * Every public document that has a detail route, for the sitemap. The source drops documents of a
 * closed gate and anything marked `noindex`.
 */
export const sitemapQuery = defineQuery(`{
  "practice": *[_type == "practice" && ${ok}]{ "slug": slug.current, "updatedAt": _updatedAt, "noindex": seo.noindex, "editorialStatus": governance.editorialStatus },
  "solution": *[_type == "solution" && ${ok}]{ "slug": slug.current, "updatedAt": _updatedAt, "noindex": seo.noindex, "editorialStatus": governance.editorialStatus },
  "offer": *[_type == "offer" && ${ok}]{ "slug": slug.current, "updatedAt": _updatedAt, "noindex": seo.noindex, "editorialStatus": governance.editorialStatus },
  "industry": *[_type == "industry" && ${ok}]{ "slug": slug.current, "updatedAt": _updatedAt, "noindex": seo.noindex, "editorialStatus": governance.editorialStatus },
  "caseStudy": *[_type == "caseStudy" && ${okEvidence} && evidence.evidenceStatus == "verified"]{ "slug": slug.current, "updatedAt": _updatedAt, "noindex": seo.noindex, "editorialStatus": governance.editorialStatus, "classification": evidence.classification },
  "insight": *[_type == "insight" && ${okInsight}]{ "slug": slug.current, "updatedAt": coalesce(updatedAt, _updatedAt), "noindex": seo.noindex, "editorialStatus": governance.editorialStatus },
  "person": *[_type == "person" && ${ok}]{ "slug": slug.current, "updatedAt": _updatedAt, "noindex": seo.noindex, "editorialStatus": governance.editorialStatus },
  "labAsset": *[_type == "labAsset" && ${okLab}]{ "slug": slug.current, labType, "updatedAt": _updatedAt, "noindex": seo.noindex, "editorialStatus": governance.editorialStatus, "classification": evidence.classification },
  "trustItem": *[_type == "trustItem" && ${okEvidence}]{ topic, "updatedAt": _updatedAt, "noindex": seo.noindex, "editorialStatus": governance.editorialStatus, "classification": evidence.classification },
  "job": *[_type == "job" && ${ok}]{ "slug": slug.current, "updatedAt": _updatedAt, "noindex": seo.noindex, "editorialStatus": governance.editorialStatus },
  "legalPage": *[_type == "legalPage" && ${ok}]{ "slug": slug.current, "updatedAt": _updatedAt, "noindex": seo.noindex, "editorialStatus": governance.editorialStatus }
}`);
