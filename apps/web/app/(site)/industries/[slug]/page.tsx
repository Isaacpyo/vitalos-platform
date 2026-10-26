import type { Metadata } from "next";
import { isUnpublished, routes } from "@vitalos/cms";
import { JsonLd } from "../../../../src/components/json-ld";
import {
  loadDetailPage,
  loadDocument,
  staticParams,
} from "../../../../src/templates/commercial/load";
import { pageGraph, pageMetadata } from "../../../../src/templates/commercial/seo";
import {
  IndustryTemplate,
  industryTrail,
} from "../../../../src/templates/industry/IndustryTemplate";
import {
  IndustryLandingTemplate,
  hasLanding,
  landingCaseStudy,
} from "../../../../src/templates/industry/IndustryLandingTemplate";
import { loadCaseStudy } from "../../../../src/templates/work/load";
import { loadChromeContent } from "../../../../src/components/site-chrome/load";
import {
  isInsightPublished,
  loadLatestTopicPosts,
} from "../../../../src/features/content/topic-insights";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return staticParams("industry", "slug");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const industry = await loadDocument("industry", slug);
  if (!industry) return {};
  const landing = industry.landing;
  return pageMetadata({
    path: routes.industry(industry.slug),
    title: landing?.heading ?? industry.title,
    description: landing?.lead ?? industry.summary,
    seo: landing
      ? { ...landing.seo, ...(isUnpublished(landing) ? { noindex: true } : {}) }
      : industry.seo,
    // While the Industries gate is closed the page stays reachable but is noindex (ADR-022).
    gate: "industries",
  });
}

export default async function IndustryPage({ params }: Props) {
  const { slug } = await params;
  const { doc, gates } = await loadDetailPage("industry", slug);
  if (hasLanding(doc)) {
    const landing = doc.landing;
    const link = landing.guardrails.link;
    // The industry's own case studies once one is published; until then the fallback stories
    // this deployment serves (a missing or unpublished story is left out, never linked).
    const fallback = doc.work.length === 0;
    const [chrome, insights, linkPublished, fallbackStudies] = await Promise.all([
      loadChromeContent(),
      loadLatestTopicPosts(landing.insights.topicSlug),
      link ? isInsightPublished(link.insightSlug) : Promise.resolve(false),
      fallback
        ? Promise.all(landing.caseStudies.fallbackSlugs.map((slug) => loadCaseStudy(slug)))
        : Promise.resolve([]),
    ]);
    const caseStudies = fallback
      ? fallbackStudies.flatMap((data) => (data ? [landingCaseStudy(data.study)] : []))
      : doc.work.map(landingCaseStudy);
    return (
      <>
        <JsonLd
          data={pageGraph({
            trail: industryTrail(doc),
            name: landing.heading,
            description: landing.lead,
            faq: landing.faq,
            dateModified: doc.updatedAt,
          })}
        />
        <IndustryLandingTemplate
          industry={doc}
          offerSlugs={new Set(chrome.offers.map((offer) => offer.slug))}
          caseStudies={caseStudies}
          caseStudiesAreFallback={fallback}
          insights={insights}
          // Linked only once the briefing is published, so the page never links to a 404.
          showGuardrailLink={linkPublished}
        />
      </>
    );
  }
  return (
    <>
      <JsonLd
        data={pageGraph({
          trail: industryTrail(doc),
          name: doc.title,
          description: doc.summary,
          dateModified: doc.updatedAt,
        })}
      />
      <IndustryTemplate industry={doc} gates={gates} />
    </>
  );
}
