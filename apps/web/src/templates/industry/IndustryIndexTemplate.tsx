import { industryNames, navLabels, routes } from "@vitalos/cms";
import type { IndustrySummary, RoutePageView } from "@vitalos/cms";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import { industryShowcaseItems } from "../../lib/view-mapping/showcase";
import { IndustryBand } from "../commercial/dark-bands";
import { IndexLayout } from "../commercial/IndexLayout";

export interface IndustryIndexTemplateProps {
  page: RoutePageView | null;
  industries: readonly IndustrySummary[];
}

export const industriesTrail = () =>
  trail({ label: navLabels.industries, path: routes.industries() });

/**
 * Industries index, as the homepage's dark aurora showcase (pages redesign, 15 Oct 2026). The
 * route is served only while the Industries gate is open (the page calls
 * `requireIndexGate`), so every row here links to a published, indexable industry page.
 */
export function IndustryIndexTemplate({ page, industries }: Readonly<IndustryIndexTemplateProps>) {
  const items = industryShowcaseItems(orderByLockedNames(industries, industryNames), {
    headingLevel: 2,
  });
  return (
    <IndexLayout
      crumbs={industriesTrail()}
      title={page?.heading ?? navLabels.industries}
      lead={page?.intro}
      body={page?.body}
      bands={[() => <IndustryBand title={undefined} items={items} link={null} />]}
    />
  );
}
