import { offerNames, routes } from "@vitalos/cms";
import type { OfferSummary, RoutePageView } from "@vitalos/cms";
import { FeatureGrid } from "@vitalos/ui";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import { offerFeatureItems } from "../../lib/view-mapping/showcase";
import { Band } from "../commercial/bands";
import { IndexLayout } from "../commercial/IndexLayout";

export interface OfferIndexTemplateProps {
  page: RoutePageView | null;
  offers: readonly OfferSummary[];
}

export const offersTrail = () =>
  trail(
    { label: structuralLabels.whatWeDo, path: routes.whatWeDo() },
    { label: structuralLabels.offers, path: routes.offers() },
  );

/** Offers index: defined ways to start, in the order the specs fix, as icon cards. No prices. */
export function OfferIndexTemplate({ page, offers }: Readonly<OfferIndexTemplateProps>) {
  const items = offerFeatureItems(orderByLockedNames(offers, offerNames));
  return (
    <IndexLayout
      crumbs={offersTrail()}
      title={page?.heading ?? structuralLabels.offers}
      lead={page?.intro}
      body={page?.body}
      bands={[
        (tone) =>
          items.length > 0 ? (
            <Band tone={tone}>
              <FeatureGrid items={items} headingLevel={2} />
            </Band>
          ) : null,
      ]}
    />
  );
}
