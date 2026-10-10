import { industryNames, navLabels, routes } from "@vitalos/cms";
import type { IndustrySummary, RoutePageView } from "@vitalos/cms";
import { IndustryRow } from "@vitalos/ui";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import { toRows } from "../../lib/view-mapping/patterns";
import { Band, RowList, gapBand } from "../commercial/bands";
import { IndexLayout } from "../commercial/IndexLayout";

export interface IndustryIndexTemplateProps {
  page: RoutePageView | null;
  industries: readonly IndustrySummary[];
  draft: boolean;
}

export const industriesTrail = () =>
  trail({ label: navLabels.industries, path: routes.industries() });

/**
 * Industries index. The route is served only while the Industries gate is open (the page calls
 * `requireIndexGate`), so every row here links to a published, indexable industry page.
 */
export function IndustryIndexTemplate({
  page,
  industries,
  draft,
}: Readonly<IndustryIndexTemplateProps>) {
  const rows = toRows("industry", orderByLockedNames(industries, industryNames), {
    headingLevel: 2,
  });
  return (
    <IndexLayout
      crumbs={industriesTrail()}
      title={page?.heading ?? navLabels.industries}
      lead={page?.intro}
      body={page?.body}
      bands={[
        (tone) =>
          rows.length > 0 ? (
            <Band tone={tone}>
              <RowList>
                {rows.map((row) => (
                  <IndustryRow key={row.href} {...row} />
                ))}
              </RowList>
            </Band>
          ) : (
            gapBand(draft, structuralLabels.industries, tone)
          ),
      ]}
    />
  );
}
