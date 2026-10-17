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

/** The listing band under the hero: a light band in the wide container. */
function ListingBand({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Section as="div" tone="light" spacing="default">
      <Container size="wide">{children}</Container>
    </Section>
  );
}

/**
 * The Insights index and its pages and format views (brief 5.1) in the site's design: the full
 * dark hero, format tabs and the topic links, the featured card (page 1 of the unfiltered list
 * only), the card grid, pagination, and the empty state; the closing card ends every page.
 */
export function IndexTemplate({
  title,
  intro,
  view,
  before,
}: Readonly<{ title: string; intro: string; view: IndexView; before?: ReactNode }>) {
  return (
    <PageMain>
      <InsightsHero full crumbs={before} title={title} intro={intro} />
      <ListingBand>
        {view.empty ? (
          <p className="m-0 text-body-l text-tone-text">{insightsCopy.empty}</p>
        ) : (
          <>
            {view.filters ? (
              <div className="mb-(--space-7) flex flex-wrap items-start justify-between gap-(--space-5)">
                <FormatTabs tabs={view.tabs} />
                <div className="flex flex-wrap items-center gap-(--space-5)">
                  <TopicLinks topics={view.topics} />
                  {view.feed ? (
                    <a
                      href={view.feed}
                      type="application/rss+xml"
                      className="text-body text-tone-link underline underline-offset-4"
                    >
                      {insightsCopy.feedLink}
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
            {view.featured ? (
              <div className="mb-(--space-7)">
                <FeaturedPost post={view.featured} />
              </div>
            ) : null}
            <PostGrid posts={view.items} covers={view.covers} />
            <PaginationNav pagination={view.pagination} />
          </>
        )}
      </ListingBand>
      <TalkBand />
    </PageMain>
  );
}

/** Topic and author pages: the compact dark hero of their own, then the same grid (brief 5.1). */
export function ListingTemplate({
  eyebrow,
  title,
  intro,
  posts,
  covers,
  crumbs,
  children,
  pagination,
}: Readonly<{
  eyebrow: string;
  title: string;
  intro?: string | undefined;
  posts: readonly PostSummary[];
  covers: boolean;
  /** Invisible BreadcrumbList JSON-LD. */
  crumbs?: ReactNode;
  /** Shown in the hero under the intro (the author's bio and profile link). */
  children?: ReactNode;
  pagination?: IndexView["pagination"];
}>) {
  return (
    <PageMain>
      <InsightsHero eyebrow={eyebrow} title={title} intro={intro} crumbs={crumbs}>
        {children}
      </InsightsHero>
      <ListingBand>
        {posts.length === 0 ? (
          <p className="m-0 text-body-l text-tone-text">{insightsCopy.empty}</p>
        ) : (
          <PostGrid posts={posts} covers={covers} />
        )}
        <PaginationNav pagination={pagination ?? null} />
      </ListingBand>
      <TalkBand />
    </PageMain>
  );
}
