import { navLabels, routes } from "@vitalos/cms";
import { ArticleFeature, ArticleRow, Stack } from "@vitalos/ui";
import { PlaceholderNotice, hasPlaceholder } from "../../components/placeholder-notice";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeroBand } from "../institutional/layout";
import { ListFilter } from "../institutional/list-filter";
import { rowFilterAttributes } from "../institutional/list-filter-model";
import { PageMain } from "../institutional/page-main";
import type { InsightsIndexData } from "./load";
import { insightCardProps, insightFilterDimensions, insightFilterGroups } from "./map";
import { ClosingBand } from "../commercial/bands";

const LIST_ID = "insights-list";

/**
 * Insights index (gated): the newest insight as the featured piece, then an editorial list with
 * topic navigation as a client-side filter over crawlable rows (no query-string pages, no
 * infinite card wall).
 */
export function InsightsIndex({ data }: Readonly<{ data: InsightsIndexData }>) {
  const { page, insights } = data;
  const [featured, ...rest] = insights;
  const groups = insightFilterGroups(rest);
  const placeholder = hasPlaceholder(insights);
  return (
    <PageMain>
      <PageHeroBand
        full
        crumbs={
          <Breadcrumbs
            jsonLd={!placeholder}
            trail={[homeCrumb, { name: navLabels.insights, path: routes.insights() }]}
          />
        }
        title={page?.heading ?? navLabels.insights}
        lead={page?.intro}
      />
      <PlaceholderNotice show={placeholder} />
      <PageBand>
        <Stack gap={8}>
          <RichText value={page?.body} />
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
      <ClosingBand />
    </PageMain>
  );
}
