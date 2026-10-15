import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brandName } from "@vitalos/cms";
import { loadTopicPageN } from "../../features/content/insights/load";
import {
  gridHasCovers,
  pagination,
  topicHref,
  topicPageHref,
} from "../../features/content/insights/model";
import { isSlug } from "../../features/content/readers";
import { INSIGHTS_BASE } from "../../features/content/routes";
import { Breadcrumbs } from "../institutional/breadcrumbs";
import { ListingTemplate } from "./IndexTemplate";
import { insightsMetadata } from "./metadata";

/** Topic and sector pages (brief 5.1): the topic's posts in the index grid, paginated. */
async function loadTopic(slug: string, page: number) {
  if (!isSlug(slug)) notFound();
  return loadTopicPageN(slug, page);
}

export async function topicMetadata(slug: string, page: number): Promise<Metadata> {
  const { topic } = await loadTopic(slug, page);
  return insightsMetadata({
    path: topicPageHref(slug, page),
    title: page > 1 ? `${topic.topic.name}, page ${page}` : topic.topic.name,
    description: topic.topic.description,
  });
}

export async function renderTopicPage(slug: string, page: number) {
  const { topic } = await loadTopic(slug, page);
  const posts = topic.posts.items;
  return (
    <ListingTemplate
      eyebrow={topic.topic.kind === "sector" ? "SECTOR" : "TOPIC"}
      title={topic.topic.name}
      intro={topic.topic.description}
      posts={posts}
      covers={gridHasCovers(posts)}
      pagination={pagination(page, topic.posts.totalPages, (n) => topicPageHref(slug, n))}
    >
      <Breadcrumbs
        trail={[
          { name: brandName, path: "/" },
          { name: "Insights", path: INSIGHTS_BASE },
          { name: topic.topic.name, path: topicHref(slug) },
        ]}
      />
    </ListingTemplate>
  );
}
