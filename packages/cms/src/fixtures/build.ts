/**
 * Builders for fixture content. Everything is obviously artificial: "(fixture)" in every visible
 * string, `*.invalid` addresses, no real company, person, outcome or credential.
 */
import type { EvidenceView, OutcomeMetricView, RichText, SeoView } from "../content/types";

export const FIXTURE_LABEL = "(fixture)";

/** Far-future validity so open roles stay open for any clock the tests use. */
export const FIXTURE_FAR_FUTURE = "2099-12-31";

export const verifiedEvidence: EvidenceView = { status: "verified", verifiedAt: "2026-01-15" };
export const pendingEvidence: EvidenceView = { status: "pending" };

/** A paragraph of Portable Text. */
export function paragraph(text: string, key: string): RichText[number] {
  return {
    _type: "block",
    _key: key,
    style: "normal",
    children: [{ _type: "span", _key: `${key}-s`, text, marks: [] }],
    markDefs: [],
  };
}

export function richText(prefix: string, ...paragraphs: string[]): RichText {
  return paragraphs.map((text, index) => paragraph(text, `${prefix}-${index + 1}`));
}

export function seo(title: string): SeoView {
  return {
    title: `${title} ${FIXTURE_LABEL}`.slice(0, 60),
    description: `Artificial example description ${FIXTURE_LABEL}. Not real content.`,
  };
}

/** A clearly fixture-labelled metric with a fixture source. Never a real result. */
export function fixtureMetric(label: string): OutcomeMetricView {
  return {
    value: `99 ${FIXTURE_LABEL}`,
    descriptor: `Example metric ${label} ${FIXTURE_LABEL}`,
    source: `Fixture data, not a real measurement ${FIXTURE_LABEL}`,
    context: `Artificial example for layout testing ${FIXTURE_LABEL}`,
    timeframe: `Example period ${FIXTURE_LABEL}`,
    evidence: verifiedEvidence,
  };
}

/**
 * "strategyToProduction" or "what-we-do" -> "Strategy to production". Deterministic, so generated
 * fixture headings read naturally in screenshots and Storybook.
 */
export function humaniseKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim()
    .toLowerCase();
  const sentence = words.charAt(0).toUpperCase() + words.slice(1);
  return sentence.replace(/\bai\b/gi, "AI");
}

/** A readable, clearly artificial heading for a section or page key. */
export function fixtureHeading(key: string): string {
  return `${humaniseKey(key)} ${FIXTURE_LABEL}`;
}

export const exampleUrl = (path: string): string => `https://example.invalid/${path}`;
export const exampleEmail = (local: string): string => `${local}@example.invalid`;
