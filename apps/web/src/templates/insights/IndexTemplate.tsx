import { Container, Section } from "@vitalos/ui";
import type { ReactNode } from "react";
import type { IndexView, PostSummary } from "../../features/content/insights/model";
import { insightsCopy } from "../../features/content/insights/model";
import { PageMain } from "../institutional/page-main";
import {
  FeaturedPost,
  FormatTabs,
  InsightsHero,
  PaginationNav,
  PostGrid,
  TalkBand,
  TopicLinks,
} from "./parts";

/**
 * The Insights index and its pages and format views (brief 5.1): hero, format tabs and the topic
 * links, the featured row (page 1 of the unfiltered list only), the grid, pagination, and the
 * empty state; the closing band ends every page.
 */
export function IndexTemplate({
  title,
  intro,
  view,
  before,
}: Readonly<{ title: string; intro: string; view: IndexView; before?: ReactNode }>) {
  return (
    <PageMain>
      {before}
      <InsightsHero title={title} intro={intro} />
      <Section as="div" tone="light" spacing="default">
        <Container size="wide">
          {view.empty ? (
            <p className="m-0 text-body-l text-tone-text">{insightsCopy.empty}</p>
          ) : (
            <>
              <div className="mb-(--space-7) flex flex-wrap items-start justify-between gap-(--space-5)">
                <FormatTabs tabs={view.tabs} />
                <TopicLinks topics={view.topics} />
              </div>
              {view.featured ? (
                <div className="mb-(--space-8)">
                  <FeaturedPost post={view.featured} />
                </div>
              ) : null}
              <PostGrid posts={view.items} covers={view.covers} />
              <PaginationNav pagination={view.pagination} />
            </>
          )}
        </Container>
      </Section>
      <TalkBand />
    </PageMain>
  );
}

/** Topic and author pages: a hero of their own, then the same grid (brief 5.1). */
export function ListingTemplate({
  eyebrow,
  title,
  intro,
  posts,
  covers,
  children,
  pagination,
}: Readonly<{
  eyebrow: string;
  title: string;
  intro?: string | undefined;
  posts: readonly PostSummary[];
  covers: boolean;
  children?: ReactNode;
  pagination?: IndexView["pagination"];
}>) {
  return (
    <PageMain>
      <InsightsHero eyebrow={eyebrow} title={title} intro={intro}>
        {children}
      </InsightsHero>
      <Section as="div" tone="light" spacing="default">
        <Container size="wide">
          {posts.length === 0 ? (
            <p className="m-0 text-body-l text-tone-text">{insightsCopy.empty}</p>
          ) : (
            <PostGrid posts={posts} covers={covers} />
          )}
          <PaginationNav pagination={pagination ?? null} />
        </Container>
      </Section>
      <TalkBand />
    </PageMain>
  );
}
