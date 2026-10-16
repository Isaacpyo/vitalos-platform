import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
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

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return staticParams("industry", "slug");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const industry = await loadDocument("industry", slug);
  if (!industry) return {};
  return pageMetadata({
    path: routes.industry(industry.slug),
    title: industry.title,
    description: industry.summary,
    seo: industry.seo,
    // While the Industries gate is closed the page stays reachable but is noindex (ADR-022).
    gate: "industries",
  });
}

export default async function IndustryPage({ params }: Props) {
  const { slug } = await params;
  const { doc, gates } = await loadDetailPage("industry", slug);
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
