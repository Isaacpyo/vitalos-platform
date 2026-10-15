import { navLabels, routes } from "@vitalos/cms";
import { Stack, TableOfContents, TextLink } from "@vitalos/ui";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { ContentSection, PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { ArticleBody } from "../insights/ArticleBody";
import { buildArticleBody, tocForDisplay } from "../insights/body-model";
import { hasRichText } from "../institutional/rich";
import type { AboutData } from "./load";
import { aboutLinks, exploreHeading } from "./map";

/**
 * About. The heading, introduction and narrative come from the About route page in the CMS; the
 * locked navigation label is the only fallback heading; onward links use locked labels.
 */
export function AboutPage({ data }: Readonly<{ data: AboutData }>) {
  const { page, gates } = data;
  const model = buildArticleBody(page?.body ?? []);
  const toc = tocForDisplay(model);
  return (
    <PageMain>
      <PageHeroBand
        crumbs={
          <Breadcrumbs trail={[homeCrumb, { name: navLabels.about, path: routes.about() }]} />
        }
        title={page?.heading ?? navLabels.about}
        lead={page?.intro}
      />
      <PageBand>
        <Stack gap={8}>
          {/* Section index first when stacked, then the narrative; side by side from `lg`. */}
          <div className="grid min-w-0 gap-(--space-7) lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
            {toc.length > 0 ? (
              <div className="min-w-0 lg:order-last">
                <div className="lg:sticky lg:top-[calc(var(--size-header)+var(--space-4))]">
                  <TableOfContents
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
              {hasRichText(page?.body) ? (
                <ArticleBody body={page?.body ?? []} model={model} />
              ) : null}
            </div>
          </div>

          <ContentSection id="explore" heading={exploreHeading}>
            <ul className="m-0 flex list-none flex-wrap gap-x-(--space-6) gap-y-(--space-3) p-0">
              {aboutLinks(gates).map((link) => (
                <li key={link.key}>
                  <TextLink href={link.href}>{link.label}</TextLink>
                </li>
              ))}
            </ul>
          </ContentSection>
        </Stack>
      </PageBand>
    </PageMain>
  );
}
