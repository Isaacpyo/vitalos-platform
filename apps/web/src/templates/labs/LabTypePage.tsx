import { navLabels, routes } from "@vitalos/cms";
import { LabShowcase } from "@vitalos/ui";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import type { LabTypeData } from "./load";
import { labTypeLabel } from "./map";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { labShowcaseItems } from "../../lib/view-mapping/showcase";
import { ClosingBand } from "../commercial/bands";
import { heroArtwork } from "../../lib/view-mapping/hero-artwork";

/**
 * One Labs category, as the homepage Labs bench (pages redesign, 15 Oct 2026): specimen cards with
 * maturity in words, closing on the Labs index card. The heading is the locked type label
 * (Stage 8 §15).
 */
export function LabTypePage({ data }: Readonly<{ data: LabTypeData }>) {
  const { type, assets } = data;
  const label = labTypeLabel(type);
  return (
    <PageMain>
      <PageHeroBand
        artwork={heroArtwork("labs", type)}
        crumbs={
          <Breadcrumbs
            trail={[
              homeCrumb,
              { name: navLabels.labs, path: routes.labs() },
              { name: label, path: routes.labType(type) },
            ]}
            page={{ type: "CollectionPage" }}
          />
        }
        title={label}
      />
      <PageBand size="wide">
        <LabShowcase
          items={labShowcaseItems(assets, { headingLevel: 2 })}
          headingLevel={2}
          more={{ label: structuralLabels.allLabs, href: routes.labs() }}
        />
      </PageBand>
      <ClosingBand />
    </PageMain>
  );
}
