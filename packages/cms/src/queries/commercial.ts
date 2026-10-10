/**
 * Practice, solution, offer and industry queries. Weak relations are read in both directions
 * (the forward reference unioned with the reverse lookup); mappers de-duplicate by id.
 * Params: `$slug`, `$statuses`, `$today`.
 */
import { defineQuery } from "groq";
import {
  baseFields,
  basicSummary,
  caseStudySummary,
  ctaFields,
  insightSummary,
  offerSummary,
  ok,
  okEvidence,
  okInsight,
  richTextFields,
} from "./fragments";

export const practiceQuery =
  defineQuery(`*[_type == "practice" && slug.current == $slug && ${ok}][0]{
  ${baseFields},
  proposition,
  problems,
  capabilities,
  "body": body[]${richTextFields},
  "solutions": coalesce(solutions[]->[${ok}]${basicSummary}, []) + *[_type == "solution" && ^._id in practices[]._ref && ${ok}]${basicSummary},
  "offers": *[_type == "offer" && ^._id in practices[]._ref && ${ok}]${offerSummary},
  "industries": industries[]->[${ok}]${basicSummary},
  "work": coalesce(work[]->[${okEvidence}]${caseStudySummary}, []) + *[_type == "caseStudy" && ^._id in practices[]._ref && ${okEvidence}]${caseStudySummary},
  "cta": cta${ctaFields}
}`);

export const practiceSummariesQuery = defineQuery(
  `*[_type == "practice" && ${ok}] | order(title asc)${basicSummary}`,
);

export const solutionQuery =
  defineQuery(`*[_type == "solution" && slug.current == $slug && ${ok}][0]{
  ${baseFields},
  problemStatement,
  signals,
  impact,
  "approach": approach[]${richTextFields},
  "phases": phases[]{ title, description },
  "offers": coalesce(offers[]->[${ok}]${offerSummary}, []) + *[_type == "offer" && ^._id in solutions[]._ref && ${ok}]${offerSummary},
  "practices": coalesce(practices[]->[${ok}]${basicSummary}, []) + *[_type == "practice" && ^._id in solutions[]._ref && ${ok}]${basicSummary},
  "industries": coalesce(industries[]->[${ok}]${basicSummary}, []) + *[_type == "industry" && ^._id in solutions[]._ref && ${ok}]${basicSummary},
  "work": coalesce(work[]->[${okEvidence}]${caseStudySummary}, []) + *[_type == "caseStudy" && ^._id in solutions[]._ref && ${okEvidence}]${caseStudySummary},
  "faq": faq[]{ question, answer },
  "cta": cta${ctaFields}
}`);

export const solutionSummariesQuery = defineQuery(
  `*[_type == "solution" && ${ok}] | order(title asc)${basicSummary}`,
);

export const offerQuery = defineQuery(`*[_type == "offer" && slug.current == $slug && ${ok}][0]{
  ${baseFields},
  audience,
  trigger,
  scope,
  outputs,
  requirements,
  durationCategory,
  exclusions,
  nextStep,
  "solutions": coalesce(solutions[]->[${ok}]${basicSummary}, []) + *[_type == "solution" && ^._id in offers[]._ref && ${ok}]${basicSummary},
  "practices": practices[]->[${ok}]${basicSummary},
  "cta": cta${ctaFields}
}`);

export const offerSummariesQuery = defineQuery(
  `*[_type == "offer" && ${ok}] | order(title asc)${offerSummary}`,
);

export const industryQuery =
  defineQuery(`*[_type == "industry" && slug.current == $slug && ${ok}][0]{
  ${baseFields},
  realities,
  problems,
  aiOpportunities,
  considerations,
  "solutions": coalesce(solutions[]->[${ok}]${basicSummary}, []) + *[_type == "solution" && ^._id in industries[]._ref && ${ok}]${basicSummary},
  "offers": offers[]->[${ok}]${offerSummary},
  "work": coalesce(work[]->[${okEvidence}]${caseStudySummary}, []) + *[_type == "caseStudy" && ^._id in industries[]._ref && ${okEvidence}]${caseStudySummary},
  "insights": coalesce(insights[]->[${okInsight}]${insightSummary}, []) + *[_type == "insight" && ^._id in industries[]._ref && ${okInsight}]${insightSummary},
  "cta": cta${ctaFields}
}`);

export const industrySummariesQuery = defineQuery(
  `*[_type == "industry" && ${ok}] | order(title asc)${basicSummary}`,
);
