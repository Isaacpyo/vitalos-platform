import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { draftContent } from "@vitalos/cms/draft";
import type {
  CaseStudyView,
  IndustryView,
  LandingPoint,
  LandingSection,
  OfferView,
} from "@vitalos/cms";
import { pointIcon } from "../../lib/view-mapping/icons";
import { OfferTemplate } from "../offer/OfferTemplate";
import {
  IndustryLandingTemplate,
  hasLanding,
  landingCaseStudy,
  landingLabels,
} from "./IndustryLandingTemplate";

vi.mock("../../features/seo/context", () => ({
  getSeoContext: () => ({ siteUrl: "https://www.example.invalid", indexable: false }),
}));

const { documents } = draftContent.set;
const industry = (documents.industry as IndustryView[]).find((doc) => doc.slug === "health-care");
const offers = (documents.offer as OfferView[]).filter((doc) =>
  ["clinic-admin-audit", "nhs-assurance-readiness", "medical-logistics-digitisation"].includes(
    doc.slug,
  ),
);
if (!industry || !hasLanding(industry)) throw new Error("Health & Care lead page not drafted");
const landing = industry.landing;

const flatten = (points: readonly LandingPoint[]): LandingPoint[] =>
  points.flatMap((point) => [point, ...flatten(point.points ?? [])]);
const sections: LandingSection[] = [
  landing.audiences,
  landing.painPoints,
  landing.offers,
  landing.automation,
  landing.steps,
  ...landing.guardrails.columns,
  ...(landing.pilots.benefits ? [landing.pilots.benefits] : []),
  landing.systems,
  landing.trust,
];
const keys = new Set(
  [
    ...landing.proof,
    ...sections.flatMap((section) => section.points),
    ...landing.pilots.products,
    landing.caseStudies.fallback,
    ...offers.flatMap((offer) => (offer.sections ?? []).flatMap((section) => section.points)),
  ]
    .flatMap((point) => flatten([point]))
    .map((point) => point.key),
);

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

describe("Health & Care pages (revision 2)", () => {
  it("maps every point's icon key onto the site's own icons", () => {
    // "check" is the fallback for an unknown key, so only the check key itself may resolve to it.
    const unmapped = [...keys].filter((key) => key !== "check" && pointIcon(key) === "check");
    expect(unmapped).toEqual([]);
  });

  const fauward = (documents.caseStudy as CaseStudyView[]).find(
    (study) => study.slug === "fauward-white-label-logistics-platform",
  );
  const markup = renderToStaticMarkup(
    <IndustryLandingTemplate
      industry={industry}
      offerSlugs={new Set(offers.map((offer) => offer.slug).concat("systems-integration"))}
      caseStudies={fauward ? [landingCaseStudy(fauward)] : []}
      caseStudiesAreFallback
      insights={[]}
      showGuardrailLink={false}
    />,
  );

  it("renders every section heading and every point's title and line", () => {
    for (const section of sections) expect(markup).toContain(escape(section.heading));
    for (const point of sections.flatMap((section) => section.points)) {
      if (point.title) expect(markup).toContain(escape(point.title));
      expect(markup).toContain(escape(point.text));
    }
    expect(markup).toContain(escape(landing.closing.line));
    expect(markup).toContain(landingLabels.youGet);
    expect(markup).toContain(landingLabels.youLeaveWith);
  });

  it("shows the Fauward story and the design-partner card while no healthcare story is published", () => {
    expect(markup).toContain("Built and run by Vitalos");
    expect(markup).toContain(escape(landing.caseStudies.fallback.title ?? ""));
  });

  it("links the MHRA briefing only once it is published", () => {
    expect(markup).not.toContain(escape(landing.guardrails.link?.label ?? "never"));
  });

  it.each(offers.map((offer) => [offer.slug, offer] as const))(
    "renders the %s offer's sections and FAQ",
    (_slug, offer) => {
      const page = renderToStaticMarkup(<OfferTemplate offer={offer} />);
      for (const section of offer.sections ?? []) {
        expect(page).toContain(escape(section.heading));
        for (const point of section.points) expect(page).toContain(escape(point.text));
      }
      for (const entry of offer.faq ?? []) expect(page).toContain(escape(entry.question));
      // The points layout replaces the engagement summary's definition list.
      expect(page).not.toContain("<dl");
    },
  );
});
