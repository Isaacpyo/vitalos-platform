import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routes } from "@vitalos/cms";
import { JsonLd } from "../../../src/components/json-ld";
import { loadChromeContent } from "../../../src/components/site-chrome/load";
import { structuralLabels } from "../../../src/lib/view-mapping/labels";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { pageGraph, pageMetadata } from "../../../src/templates/commercial/seo";
import { OfferIndexTemplate, offersTrail } from "../../../src/templates/offer/OfferIndexTemplate";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadRoutePage("offers");
  return pageMetadata({
    path: routes.offers(),
    title: page?.heading ?? structuralLabels.offers,
    seo: page?.seo,
  });
}

export default async function OffersPage() {
  const [page, { offers }] = await Promise.all([loadRoutePage("offers"), loadChromeContent()]);
  if (!page && offers.length === 0) notFound();
  return (
    <>
      <JsonLd
        data={pageGraph({
          trail: offersTrail(),
          name: page?.heading ?? structuralLabels.offers,
          description: page?.intro,
          type: "CollectionPage",
        })}
      />
      <OfferIndexTemplate page={page} offers={offers} />
    </>
  );
}
