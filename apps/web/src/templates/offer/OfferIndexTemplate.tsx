import { offerNames, routes } from "@vitalos/cms";
import type { OfferSummary, RoutePageView } from "@vitalos/cms";
import { OfferRow } from "@vitalos/ui";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import { toOfferRows } from "../../lib/view-mapping/patterns";
import { Band, RowList } from "../commercial/bands";
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

/** Offers index: defined ways to start, in the order the specs fix. No prices. */
export function OfferIndexTemplate({ page, offers }: Readonly<OfferIndexTemplateProps>) {
  const rows = toOfferRows(orderByLockedNames(offers, offerNames), { headingLevel: 2 });
  return (
    <IndexLayout
      crumbs={offersTrail()}
      title={page?.heading ?? structuralLabels.offers}
      lead={page?.intro}
      body={page?.body}
      bands={[
        (tone) =>
          rows.length > 0 ? (
            <Band tone={tone}>
              <RowList>
                {rows.map((row) => (
                  <OfferRow key={row.href} {...row} />
                ))}
              </RowList>
            </Band>
          ) : null,
      ]}
    />
  );
}
