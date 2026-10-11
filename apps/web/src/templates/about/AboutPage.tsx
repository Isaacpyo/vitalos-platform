import { navLabels, routes } from "@vitalos/cms";
import { ContentGap, PersonCard, Stack, TextLink } from "@vitalos/ui";
import { PlaceholderNotice, hasPlaceholder } from "../../components/placeholder-notice";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { ContentSection, PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import type { AboutData } from "./load";
import { aboutLinks, exploreHeading, leaderCardProps } from "./map";

/**
 * About. The heading, introduction and narrative come from the About route page in the CMS; the
 * locked navigation label is the only fallback heading. Leadership appears when profiles exist,
 * onward links use locked labels.
 */
export function AboutPage({ data }: Readonly<{ data: AboutData }>) {
  const { page, leaders, gates, draft } = data;
  return (
    <PageMain>
      <PlaceholderNotice show={hasPlaceholder(leaders)} />
      <PageHeroBand
        crumbs={
          <Breadcrumbs trail={[homeCrumb, { name: navLabels.about, path: routes.about() }]} />
        }
        title={page?.heading ?? navLabels.about}
        lead={page?.intro}
      />
      <PageBand>
        <Stack gap={8}>
          <RichText value={page?.body} />
          <ContentGap
            draft={draft && !page}
            title="The About page content is not set"
            description="Add an About route page (heading, introduction, narrative) in the Studio. Until then the page shows the navigation label as its heading and is not indexed."
          />

          {leaders.length > 0 ? (
            <ContentSection id="leadership" heading={navLabels.leadership}>
              <Stack gap={6}>
                <ul className="m-0 grid list-none grid-cols-1 gap-(--space-6) p-0 sm:grid-cols-2 lg:grid-cols-3">
                  {leaders.map((leader) => (
                    <li key={leader.id} className="min-w-0">
                      <PersonCard {...leaderCardProps(leader)} headingLevel={3} />
                    </li>
                  ))}
                </ul>
                <p className="m-0">
                  <TextLink href={routes.leadership()}>{navLabels.leadership}</TextLink>
                </p>
              </Stack>
            </ContentSection>
          ) : null}

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
