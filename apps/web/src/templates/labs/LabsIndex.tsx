import { navLabels, routes } from "@vitalos/cms";
import { FeatureGrid } from "@vitalos/ui";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { LabList } from "./LabList";
import type { LabsIndexData } from "./load";
import { labLabels, labTypeLabel, typesWithAssets } from "./map";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { Band, ClosingBand, renderBands } from "../commercial/bands";
import { bodyBands } from "../commercial/body-bands";
import { heroArtwork } from "../../lib/view-mapping/hero-artwork";

/**
 * Labs index (gated), in the homepage's design (pages redesign, 15 Oct 2026): the full dark hero;
 * the route page's body as bands; the categories as icon cards linking to their own pages; then
 * every asset with its maturity stated next to the title (maturity filtering is a client-side
 * enhancement); the closing card.
 */
export function LabsIndex({ data }: Readonly<{ data: LabsIndexData }>) {
  const { page, assets } = data;
  const types = typesWithAssets(assets);
  return (
    <PageMain>
      <PageHeroBand
        full
        artwork={heroArtwork("labs")}
        crumbs={
          <Breadcrumbs
            trail={[homeCrumb, { name: navLabels.labs, path: routes.labs() }]}
            page={{ type: "CollectionPage", name: page?.heading, description: page?.intro }}
          />
        }
        title={page?.heading ?? navLabels.labs}
        lead={page?.intro}
      />
      {renderBands(
        [
          ...bodyBands(page?.body),
          (tone) =>
            types.length > 0 ? (
              <Band tone={tone} heading={labLabels.categories} eyebrow={navLabels.labs}>
                <FeatureGrid
                  columns={types.length === 2 || types.length === 4 ? 2 : 3}
                  items={types.map((type) => ({
                    title: labTypeLabel(type),
                    href: routes.labType(type),
                    icon: "flask" as const,
                  }))}
                />
              </Band>
            ) : null,
          (tone) => (
            <Band tone={tone} heading={structuralLabels.labs} eyebrow={navLabels.labs}>
              <LabList id="labs-list" assets={assets} />
            </Band>
          ),
        ],
        "light",
      )}
      <ClosingBand />
    </PageMain>
  );
}
