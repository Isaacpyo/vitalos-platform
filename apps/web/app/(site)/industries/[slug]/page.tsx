import type { Metadata } from "next";
import { isUnpublished, routes } from "@vitalos/cms";
import { getEnv } from "@vitalos/config";
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
} from "../../../../src/templates/industry/IndustryLandingTemplate";
import { loadChromeContent } from "../../../../src/components/site-chrome/load";
import {
  isInsightPublished,
  loadLatestTopicPosts,
} from "../../../../src/features/content/topic-insights";
import { includesUnpublished } from "../../../../src/lib/cms/content-source-factory";

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
    const [chrome, insights, linkPublished] = await Promise.all([
      loadChromeContent(),
      loadLatestTopicPosts(landing.insights.topicSlug),
      link ? isInsightPublished(link.insightSlug) : Promise.resolve(false),
    ]);
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
          caseStudies={doc.work}
          insights={insights}
          // A preview links the briefing before it is published, so reviewers see where it leads.
          showGuardrailLink={linkPublished || includesUnpublished(getEnv().deployEnv)}
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
