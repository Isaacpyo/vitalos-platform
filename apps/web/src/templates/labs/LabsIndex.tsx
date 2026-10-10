import { navLabels, routes } from "@vitalos/cms";
import { ContentGap, Stack, TextLink } from "@vitalos/ui";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { ContentSection, PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { LabList } from "./LabList";
import type { LabsIndexData } from "./load";
import { labLabels, labTypeLabel, typesWithAssets } from "./map";

/**
 * Labs index (gated): categories as crawlable links to their own pages, then every asset with its
 * maturity stated next to the title. Maturity filtering is a client-side enhancement.
 */
export function LabsIndex({ data }: Readonly<{ data: LabsIndexData }>) {
  const { page, assets, draft } = data;
  const types = typesWithAssets(assets);
  return (
    <PageMain>
      <PageHeroBand
        crumbs={<Breadcrumbs trail={[homeCrumb, { name: navLabels.labs, path: routes.labs() }]} />}
        title={page?.heading ?? navLabels.labs}
        lead={page?.intro}
      />
      <PageBand>
        <Stack gap={8}>
          <RichText value={page?.body} />
          <ContentGap
            draft={draft && !page}
            title="The Labs page heading and introduction are not set"
            description="Add a Labs route page in the Studio. Until then the page shows the navigation label as its heading."
          />
          {types.length > 0 ? (
            <ContentSection id="categories" heading={labLabels.categories}>
              <ul className="m-0 flex list-none flex-wrap gap-x-(--space-6) gap-y-(--space-3) p-0">
                {types.map((type) => (
                  <li key={type}>
                    <TextLink href={routes.labType(type)}>{labTypeLabel(type)}</TextLink>
                  </li>
                ))}
              </ul>
            </ContentSection>
          ) : null}
          <LabList id="labs-list" assets={assets} />
        </Stack>
      </PageBand>
    </PageMain>
  );
}
