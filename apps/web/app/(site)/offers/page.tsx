import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routes } from "@vitalos/cms";
import { JsonLd } from "../../../src/components/json-ld";
import { loadChromeContent } from "../../../src/components/site-chrome/load";
import { isDraftModeEnabled } from "../../../src/lib/cms/draft";
import { structuralLabels } from "../../../src/lib/view-mapping/labels";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { breadcrumbNode, pageMetadata } from "../../../src/templates/commercial/seo";
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
  const [page, { offers }, draft] = await Promise.all([
    loadRoutePage("offers"),
    loadChromeContent(),
    isDraftModeEnabled(),
  ]);
  if (!page && offers.length === 0 && !draft) notFound();
  return (
    <>
      <JsonLd data={breadcrumbNode(offersTrail())} />
      <OfferIndexTemplate page={page} offers={offers} draft={draft} />
    </>
  );
}
