import { navLabels, routes } from "@vitalos/cms";
import { ArticleFeature, ArticleRow, ContentGap, Stack } from "@vitalos/ui";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeader } from "../institutional/layout";
import { ListFilter } from "../institutional/list-filter";
import { rowFilterAttributes } from "../institutional/list-filter-model";
import { PageMain } from "../institutional/page-main";
import type { InsightsIndexData } from "./load";
import { insightCardProps, insightFilterDimensions, insightFilterGroups } from "./map";

const LIST_ID = "insights-list";

/**
 * Insights index (gated): the newest insight as the featured piece, then an editorial list with
 * topic navigation as a client-side filter over crawlable rows (no query-string pages, no
 * infinite card wall).
 */
export function InsightsIndex({ data }: Readonly<{ data: InsightsIndexData }>) {
  const { page, insights, draft } = data;
  const [featured, ...rest] = insights;
  const groups = insightFilterGroups(rest);
  return (
    <PageMain>
      <PageBand>
        <Stack gap={8}>
          <Breadcrumbs trail={[homeCrumb, { name: navLabels.insights, path: routes.insights() }]} />
          <PageHeader title={page?.heading ?? navLabels.insights} lead={page?.intro} />
          <RichText value={page?.body} />
          <ContentGap
            draft={draft && !page}
            title="The Insights page heading and introduction are not set"
            description="Add an Insights route page in the Studio. Until then the page shows the navigation label as its heading."
          />
          {featured ? <ArticleFeature {...insightCardProps(featured)} headingLevel={2} /> : null}
          <ListFilter listId={LIST_ID} groups={groups} total={rest.length} />
          <ul id={LIST_ID} className="m-0 list-none p-0">
            {rest.map((insight) => (
              <li
                key={insight.id}
                {...rowFilterAttributes(insight, insightFilterDimensions, groups)}
              >
                <ArticleRow {...insightCardProps(insight)} headingLevel={2} />
              </li>
            ))}
          </ul>
        </Stack>
      </PageBand>
    </PageMain>
  );
}
