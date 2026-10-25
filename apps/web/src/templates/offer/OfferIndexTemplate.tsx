import { offerNames, routes } from "@vitalos/cms";
import type { OfferSummary, RoutePageView } from "@vitalos/cms";
import { FeatureGrid } from "@vitalos/ui";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { durationGroups, structuralLabels } from "../../lib/view-mapping/labels";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import { offerFeatureItems } from "../../lib/view-mapping/showcase";
import { Band } from "../commercial/bands";
import type { BandFactory } from "../commercial/bands";
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

/**
 * Offers index: defined ways to start, grouped by duration (short, medium, long, ongoing; Website
 * Build Pack, 25 Oct 2026), each group in the order the specs fix, as icon cards. An offer with an
 * unknown duration is listed last, under no group heading. No prices.
 */
export function OfferIndexTemplate({ page, offers }: Readonly<OfferIndexTemplateProps>) {
  const ordered = orderByLockedNames(offers, offerNames);
  const known = new Set(durationGroups.map((group) => group.category));
  const groups = [
    ...durationGroups.map((group) => ({
      heading: group.heading as string | undefined,
      offers: ordered.filter((offer) => offer.durationCategory === group.category),
    })),
    {
      heading: undefined,
      offers: ordered.filter((offer) => !known.has(offer.durationCategory ?? "")),
    },
  ].filter((group) => group.offers.length > 0);
  return (
    <IndexLayout
      crumbs={offersTrail()}
      title={page?.heading ?? structuralLabels.offers}
      lead={page?.intro}
      body={page?.body}
      bands={groups.map(groupBand)}
    />
  );
}

/** One duration group as a band: its heading, then its offers as icon cards. */
function groupBand(group: { heading: string | undefined; offers: OfferSummary[] }): BandFactory {
  return function GroupBand(tone) {
    return (
      <Band tone={tone} heading={group.heading}>
        <FeatureGrid items={offerFeatureItems(group.offers)} headingLevel={group.heading ? 3 : 2} />
      </Band>
    );
  };
}
