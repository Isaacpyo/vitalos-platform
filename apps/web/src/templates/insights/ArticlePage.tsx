import { navLabels, routes } from "@vitalos/cms";
import { ArticleRow, AuthorMeta, PersonCard, Stack, TableOfContents } from "@vitalos/ui";
import { JsonLd } from "../../components/json-ld";
import { PlaceholderNotice, hasPlaceholder } from "../../components/placeholder-notice";
import { getSeoContext } from "../../features/seo/context";
import { articleJsonLd } from "../../features/seo/json-ld";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { ContentSection, PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { hasRichText } from "../institutional/rich";
import { ArticleBody } from "./ArticleBody";
import { buildArticleBody, tocForDisplay } from "./body-model";
import { formatLabel, insightLabels } from "./labels";
import type { InsightData } from "./load";
import { authorCardProps, authorLinks, insightCardProps } from "./map";

/**
 * Article page. Structured data (Article) is emitted only with a real author and date (the
 * builder returns null otherwise). The contents list is derived from the body's own headings and
 * shown for longer pieces; code blocks use the copy-button island.
 */
export function ArticlePage({ data }: Readonly<{ data: InsightData }>) {
  const { insight, gates } = data;
  const model = buildArticleBody(insight.body);
  const toc = tocForDisplay(model);
  const authors = insight.authors.filter((author) => author.title.trim() !== "");
  const related = insight.related.filter((item) => item.slug !== insight.slug);

  const placeholder = hasPlaceholder(insight, insight.authors, related);

  return (
    <PageMain>
      <PlaceholderNotice show={placeholder} />
      <JsonLd data={articleJsonLd(insight, { siteUrl: getSeoContext().siteUrl })} />
      <PageHeroBand
        crumbs={
          <Breadcrumbs
            jsonLd={!placeholder}
            trail={[
              homeCrumb,
              // The Insights index does not exist below its gate, so it is not a crumb then.
              ...(gates.open.insights
                ? [{ name: navLabels.insights, path: routes.insights() }]
                : []),
              { name: insight.title, path: routes.insight(insight.slug) },
            ]}
          />
        }
        title={insight.title}
        eyebrow={formatLabel(insight.format)}
        lead={insight.summary}
      >
        <AuthorMeta
          authors={authorLinks(insight.authors)}
          publishedAt={insight.publishedAt}
          updatedAt={insight.updatedAt}
        />
      </PageHeroBand>
      <PageBand>
        <Stack gap={8}>
          <div className="grid min-w-0 gap-(--space-7) lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
            {toc.length > 0 ? (
              <div className="min-w-0 lg:order-first">
                <div className="lg:sticky lg:top-(--space-6)">
                  <TableOfContents
                    label={insightLabels.contents}
                    items={toc.map((entry) => ({
                      id: entry.id,
                      label: entry.label,
                      level: entry.level,
                    }))}
                  />
                </div>
              </div>
            ) : null}
            <div className={`min-w-0 ${toc.length > 0 ? "" : "lg:col-span-2"}`}>
              {hasRichText(insight.body) ? <ArticleBody body={insight.body} model={model} /> : null}
            </div>
          </div>

          {authors.length > 0 ? (
            <ContentSection
              id="authors"
              heading={authors.length === 1 ? insightLabels.author : insightLabels.authors}
            >
              <ul className="m-0 grid list-none grid-cols-1 gap-(--space-6) p-0 sm:grid-cols-2 lg:grid-cols-3">
                {authors.map((author) => (
                  <li key={author.id} className="min-w-0">
                    <PersonCard {...authorCardProps(author)} headingLevel={3} />
                  </li>
                ))}
              </ul>
            </ContentSection>
          ) : null}

          {related.length > 0 ? (
            <ContentSection id="related" heading={insightLabels.related}>
              <ul className="m-0 list-none p-0">
                {related.map((item) => (
                  <li key={item.id}>
                    <ArticleRow {...insightCardProps(item)} headingLevel={3} />
                  </li>
                ))}
              </ul>
            </ContentSection>
          ) : null}
        </Stack>
      </PageBand>
    </PageMain>
  );
}
