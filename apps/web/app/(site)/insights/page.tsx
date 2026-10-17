import type { Metadata } from "next";
import { buildIndexView, postHref } from "../../../src/features/content/insights/model";
import { loadIndexPage } from "../../../src/features/content/insights/load";
import { INSIGHTS_BASE } from "../../../src/features/content/routes";
import { Breadcrumbs, homeCrumb } from "../../../src/templates/institutional/breadcrumbs";
import { IndexTemplate } from "../../../src/templates/insights/IndexTemplate";
import { insightsMetadata } from "../../../src/templates/insights/metadata";

/** `/insights` (brief 5.1), behind `insights_open`. Static, refreshed by tags and the TTL. */
export async function generateMetadata(): Promise<Metadata> {
  const { state } = await loadIndexPage(1);
  return insightsMetadata({ path: INSIGHTS_BASE, title: "", description: state.insights.intro });
}

export default async function InsightsPage() {
  const { state, posts } = await loadIndexPage(1);
  const view = buildIndexView(posts);
  // The posts on the page, featured first, as the CollectionPage's ItemList (C11).
  const listed = [...(view.featured ? [view.featured] : []), ...view.items];
  return (
    <IndexTemplate
      title={state.insights.heading}
      intro={state.insights.intro}
      view={view}
      before={
        <Breadcrumbs
          trail={[homeCrumb, { name: "Insights", path: INSIGHTS_BASE }]}
          page={{
            type: "CollectionPage",
            name: state.insights.heading,
            description: state.insights.intro,
            items: listed.map((post) => ({ name: post.title, path: postHref(post.slug) })),
          }}
        />
      }
    />
  );
}
