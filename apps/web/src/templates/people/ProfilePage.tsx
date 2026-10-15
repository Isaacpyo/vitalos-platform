import { navLabels, routes } from "@vitalos/cms";
import { PersonHero, Stack } from "@vitalos/ui";
import { JsonLd } from "../../components/json-ld";
import { PlaceholderNotice, hasPlaceholder } from "../../components/placeholder-notice";
import { RichText } from "../../components/rich-text";
import { getSeoContext } from "../../features/seo/context";
import { profilePageJsonLd } from "../../features/seo/json-ld";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import type { Crumb } from "../institutional/breadcrumbs";
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
  const { person } = data;
  const credentials = verifiedCredentials(person);
  // Insights now come from the Super Admin (ADR-035); the CMS person's insights are not linked.
  const trail: Crumb[] = person.isLeadership
    ? [
        homeCrumb,
        { name: navLabels.about, path: routes.about() },
        { name: navLabels.leadership, path: routes.leadership() },
        { name: person.name, path: routes.person(person.slug) },
      ]
    : [homeCrumb, { name: person.name, path: routes.person(person.slug) }];

  const placeholder = hasPlaceholder(person);

  return (
    <PageMain>
      <PlaceholderNotice show={placeholder} />
      <JsonLd data={profilePageJsonLd(person, { siteUrl: getSeoContext().siteUrl })} />
      <PageBand>
        <Stack gap={8}>
          <Breadcrumbs trail={trail} jsonLd={!placeholder} />
          <PersonHero {...personHeroProps(person)}>
            {hasRichText(person.bio) ? <RichText value={person.bio} /> : null}
          </PersonHero>

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
        </Stack>
      </PageBand>
    </PageMain>
  );
}
