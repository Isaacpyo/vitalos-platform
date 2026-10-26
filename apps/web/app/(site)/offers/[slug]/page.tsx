import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { JsonLd } from "../../../../src/components/json-ld";
import {
  loadDetailPage,
  loadDocument,
  staticParams,
} from "../../../../src/templates/commercial/load";
import { pageGraph, pageMetadata } from "../../../../src/templates/commercial/seo";
import { OfferTemplate, offerTrail } from "../../../../src/templates/offer/OfferTemplate";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return staticParams("offer", "slug");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const offer = await loadDocument("offer", slug);
  if (!offer) return {};
  return pageMetadata({
    path: routes.offer(offer.slug),
    title: offer.title,
    description: offer.summary ?? offer.scope,
    seo: offer.seo,
  });
}

export default async function OfferPage({ params }: Props) {
  const { slug } = await params;
  const { doc } = await loadDetailPage("offer", slug);
  return (
    <>
      <JsonLd
        data={pageGraph({
          trail: offerTrail(doc),
          name: doc.title,
          description: doc.summary,
          serviceType: doc.title,
          ...(doc.faq && doc.faq.length > 0 ? { faq: doc.faq } : {}),
          dateModified: doc.updatedAt,
        })}
      />
      <OfferTemplate offer={doc} />
    </>
  );
}
