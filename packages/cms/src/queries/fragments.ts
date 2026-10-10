/**
 * GROQ building blocks for the public projections.
 *
 * These are plain string constants (not functions) so `sanity typegen` can resolve them when it
 * evaluates `defineQuery(...)` in the sibling files.
 *
 * Public-safety rules, enforced here AND again by the mappers (defence in depth):
 *  - only documents whose editorial status is in `$statuses` (the source passes `approved` for
 *    published reads; draft mode adds the in-progress states; `archived` is never included);
 *  - documents that carry evidence must be classified `public` (`controlled` is never projected;
 *    a missing classification is treated as not public);
 *  - never project `evidenceReference`, `evidenceOwner` or `permissionEvidence`;
 *  - images only when `rightsStatus == "approved"`;
 *  - testimonials only when `permissionStatus == "granted"`;
 *  - verified-only: certifications, credentials, metrics, proof markers, sameAs and social links;
 *  - lab repository and demo URLs only when `maintained == true`.
 *
 * Params shared by every query: `$statuses` (string[]) and `$today` (YYYY-MM-DD).
 */

/** Document is in an editorial status the current read may show. */
export const ok = `governance.editorialStatus in $statuses`;

/** Evidence-bearing document that is explicitly public. */
export const okEvidence = `${ok} && evidence.classification == "public"`;

/** Lab assets: `production-product` additionally needs verified support evidence. */
export const okLab = `${okEvidence} && (maturity != "production-product" || supportEvidence.evidenceStatus == "verified")`;

/** Insights need at least one named, public author. */
export const okInsight = `${ok} && count(authors[]->[${ok}]) > 0`;

/** The only evidence fields that leave the CMS. */
export const evidenceFields = `{ evidenceStatus, classification, verifiedAt }`;

/** Approved-rights images only: wrap each image field in `select(<path>.rightsStatus == "approved" => ...)`. */
export const imageFields = `{ "url": asset->url, alt, decorative, credit, rightsStatus, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height }`;

export const seoFields = `"seo": { "title": seo.title, "description": seo.description, "noindex": seo.noindex, "ogImage": select(seo.ogImage.rightsStatus == "approved" => seo.ogImage${imageFields}) }`;

/** Target of a CTA or internal link: enough to build a route and to re-check publication status. */
export const refTargetFields = `{ _type, "slug": slug.current, topic, labType, "editorialStatus": governance.editorialStatus, "classification": evidence.classification }`;

export const ctaFields = `{ label, intent, routeKey, "target": internalRef->${refTargetFields} }`;

/** Portable text with approved-rights figures and resolved internal links. */
export const richTextFields = `{ ..., _type == "block" => { ..., markDefs[]{ ..., _type == "internalLink" => { "target": reference->${refTargetFields} } } }, _type == "figure" => { ..., "image": select(image.rightsStatus == "approved" => image${imageFields}) } }`;

export const metricFields = `{ value, descriptor, source, context, timeframe, "evidence": evidence${evidenceFields} }`;

/* ---------- Summaries ---------- */

export const basicSummary = `{ "id": _id, "editorialStatus": governance.editorialStatus, "slug": slug.current, title, summary }`;

export const offerSummary = `{ "id": _id, "editorialStatus": governance.editorialStatus, "slug": slug.current, title, summary, durationCategory }`;

/** `clientName` is projected only for a named client with verified permission. */
export const caseStudySummary = `{ "id": _id, "editorialStatus": governance.editorialStatus, "slug": slug.current, title, summary, engagementBasis, clientDisplay, anonymisedDescriptor, "namedPermitted": clientDisplay == "named" && permissionEvidence.evidenceStatus == "verified" && defined(clientName), "clientName": select(clientDisplay == "named" && permissionEvidence.evidenceStatus == "verified" => clientName), "evidence": evidence${evidenceFields} }`;

export const personSummary = `{ "id": _id, "editorialStatus": governance.editorialStatus, "slug": slug.current, "title": name, summary, role, "portrait": select(portrait.rightsStatus == "approved" => portrait${imageFields}) }`;

export const insightSummary = `{ "id": _id, "editorialStatus": governance.editorialStatus, "slug": slug.current, title, summary, format, publishedAt, "authors": authors[]->[${ok}]${personSummary} }`;

export const labAssetSummary = `{ "id": _id, "editorialStatus": governance.editorialStatus, "slug": slug.current, title, summary, labType, maturity, "supportVerified": supportEvidence.evidenceStatus == "verified", "evidence": evidence${evidenceFields} }`;

export const trustTopicSummary = `{ "id": _id, "editorialStatus": governance.editorialStatus, topic, title, summary, "evidence": evidence${evidenceFields} }`;

export const jobSummary = `{ "id": _id, "editorialStatus": governance.editorialStatus, "slug": slug.current, title, summary, location, employmentType, status, validThrough, datePosted }`;

export const legalPageSummary = `{ "id": _id, "editorialStatus": governance.editorialStatus, "slug": slug.current, title }`;

/** Identity fields every routable detail projection starts with. */
export const identityFields = `"id": _id, "editorialStatus": governance.editorialStatus, "slug": slug.current, title, summary`;

/** Identity, last-modified time and SEO. */
export const baseFields = `${identityFields}, "updatedAt": _updatedAt, ${seoFields}`;
