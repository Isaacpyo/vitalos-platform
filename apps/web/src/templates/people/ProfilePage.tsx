import { navLabels, routes } from "@vitalos/cms";
import { ArticleRow, ContentGap, PersonHero, Stack } from "@vitalos/ui";
import { JsonLd } from "../../components/json-ld";
import { RichText } from "../../components/rich-text";
import { getSeoContext } from "../../features/seo/context";
import { profilePageJsonLd } from "../../features/seo/json-ld";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import type { Crumb } from "../institutional/breadcrumbs";
import { insightCardProps } from "../insights/map";
import { ContentSection, PageBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { hasRichText } from "../institutional/rich";
import type { PersonData } from "./load";
import { personHeroProps, personLabels, verifiedCredentials } from "./map";

/**
 * Person profile (ProfilePage structured data). Works without a portrait (monogram) and without a
 * biography: sections without data are not rendered.
 */
export function ProfilePage({ data }: Readonly<{ data: PersonData }>) {
  const { person, gates, draft } = data;
  const credentials = verifiedCredentials(person);
  // Insights are linked only while their section is public (a closed section is noindex).
  const insights = gates.open.insights ? person.insights : [];
  const trail: Crumb[] = person.isLeadership
    ? [
        homeCrumb,
        { name: navLabels.about, path: routes.about() },
        { name: navLabels.leadership, path: routes.leadership() },
        { name: person.name, path: routes.person(person.slug) },
      ]
    : [homeCrumb, { name: person.name, path: routes.person(person.slug) }];

  return (
    <PageMain>
      <JsonLd data={profilePageJsonLd(person, { siteUrl: getSeoContext().siteUrl })} />
      <PageBand>
        <Stack gap={8}>
          <Breadcrumbs trail={trail} />
          <PersonHero {...personHeroProps(person)}>
            {hasRichText(person.bio) ? <RichText value={person.bio} /> : null}
          </PersonHero>
          <ContentGap
            draft={draft && !hasRichText(person.bio)}
            title="This profile has no biography"
            description="Add a biography in the Studio. Profiles should communicate judgement, track record and areas of responsibility."
          />

          {credentials.length > 0 ? (
            <ContentSection id="credentials" heading={personLabels.credentials}>
              <ul className="m-0 list-disc pl-(--space-5)">
                {credentials.map((label) => (
                  <li key={label} className="my-(--space-2)">
                    {label}
                  </li>
                ))}
              </ul>
            </ContentSection>
          ) : null}

          {insights.length > 0 ? (
            <ContentSection id="insights" heading={navLabels.insights}>
              <ul className="m-0 list-none p-0">
                {insights.map((insight) => (
                  <li key={insight.id}>
                    <ArticleRow {...insightCardProps(insight)} headingLevel={3} />
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
