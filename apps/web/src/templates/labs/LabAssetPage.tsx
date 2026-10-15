import { navLabels, routes } from "@vitalos/cms";
import { DefinitionList, MaturityBadge, MetaRow, ResourceLinks, Stack } from "@vitalos/ui";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import type { Crumb } from "../institutional/breadcrumbs";
import { formatDate } from "../institutional/format";
import { ContentSection, PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { hasRichText } from "../institutional/rich";
import type { LabAssetData } from "./load";
import { isIsNotItems, labLabels, labTypeLabel, maturityLabel, resourceLinks } from "./map";
import { MediaSlot } from "../../components/media-slot";
import { ClosingBand } from "../commercial/bands";

/**
 * Lab asset page. The maturity badge sits directly under the title so it is the first thing read
 * after it; limitations are always shown; repository and demo links appear only when present.
 */
export function LabAssetPage({ data }: Readonly<{ data: LabAssetData }>) {
  const { type, asset, gates } = data;
  const typeLabel = labTypeLabel(type);
  const links = resourceLinks(asset);
  const isIsNot = isIsNotItems(asset);
  const updated = formatDate(asset.updatedAt);
  // Index and category pages do not exist below the Labs gate, so they are not crumbs then.
  const trail: Crumb[] = [
    homeCrumb,
    ...(gates.open.labs
      ? [
          { name: navLabels.labs, path: routes.labs() },
          { name: typeLabel, path: routes.labType(type) },
        ]
      : []),
    { name: asset.title, path: routes.labAsset(type, asset.slug) },
  ];

  return (
    <PageMain>
      <PageHeroBand
        media={<MediaSlot id="labs.asset" item={asset.slug} priority />}
        crumbs={<Breadcrumbs trail={trail} />}
        title={asset.title}
        eyebrow={typeLabel}
        lead={asset.summary}
        afterTitle={
          <MaturityBadge maturity={asset.maturity} label={maturityLabel(asset.maturity)} />
        }
      >
        {updated ? (
          <MetaRow
            items={[
              {
                label: labLabels.updated,
                value: <time dateTime={asset.updatedAt}>{updated}</time>,
              },
            ]}
          />
        ) : null}
      </PageHeroBand>
      <PageBand>
        <Stack gap={8}>
          {isIsNot.length > 0 ? <DefinitionList items={isIsNot} /> : null}

          {hasRichText(asset.body) ? <RichText value={asset.body} /> : null}

          <ContentSection id="limitations" heading={labLabels.limitations}>
            <p className="m-0 max-w-(--container-prose) text-body text-tone-text">
              {asset.limitations}
            </p>
          </ContentSection>

          {links ? (
            <ResourceLinks heading={labLabels.resources} headingLevel={2} links={links} />
          ) : null}
        </Stack>
      </PageBand>
      <ClosingBand />
    </PageMain>
  );
}
