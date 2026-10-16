import { routes } from "@vitalos/cms";
import { Container, PersonHero, Section, Stack } from "@vitalos/ui";
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
import { ClosingBand } from "../commercial/bands";

/**
 * Person profile (ProfilePage structured data). Works without a portrait (monogram) and without a
 * biography: sections without data are not rendered.
 */
export function ProfilePage({ data }: Readonly<{ data: PersonData }>) {
  const { person } = data;
  const credentials = verifiedCredentials(person);
  const trail: Crumb[] = [homeCrumb, { name: person.name, path: routes.person(person.slug) }];

  const placeholder = hasPlaceholder(person);

  return (
    <PageMain>
      <JsonLd data={profilePageJsonLd(person, { siteUrl: getSeoContext().siteUrl })} />
      <Breadcrumbs trail={trail} jsonLd={!placeholder} />
      {/* The dark hero of every page (pages redesign, 15 Oct 2026), around the person heading. */}
      <Section
        as="div"
        tone="dark"
        className="relative isolate -mt-(--size-header) overflow-hidden rounded-b-[1.75rem] pt-[calc(var(--section-compact)+var(--size-header))] pb-(--section-compact) lg:rounded-b-[3rem]"
      >
        <Container size="content">
          <PersonHero {...personHeroProps(person)} />
        </Container>
      </Section>
      <PlaceholderNotice show={placeholder} />
      <PageBand>
        <Stack gap={8}>
          {hasRichText(person.bio) ? <RichText value={person.bio} /> : null}

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
      <ClosingBand />
    </PageMain>
  );
}
