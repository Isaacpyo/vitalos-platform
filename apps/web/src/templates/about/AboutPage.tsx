import { navLabels, routes } from "@vitalos/cms";
import { founderProfile } from "@vitalos/cms/repo";
import { DefinitionList, FeatureGrid, TextLink } from "@vitalos/ui";
import type { IconName } from "@vitalos/ui";
import { MediaSlot, mediaSlotRenders } from "../../components/media-slot";
import { Band, ClosingBand, renderBands } from "../commercial/bands";
import { bodyBands } from "../commercial/body-bands";
import { ProofApproachBand } from "../commercial/proof-band";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { authorHref as authorPath } from "../../features/content/insights/model";
import { founderPersonNode } from "../../features/seo/founder";
import { getSeoContext } from "../../features/seo/context";
import { PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import type { AboutData } from "./load";
import {
  aboutLabels,
  aboutLinks,
  companyFacts,
  exploreHeading,
  practicesHeading,
  splitAtPracticesSection,
} from "./map";
import { heroArtwork } from "../../lib/view-mapping/hero-artwork";

/** Icons for the onward links, by key. */
const linkIcons: Readonly<Record<string, IconName>> = {
  "how-we-work": "workflow",
  trust: "shield",
  careers: "users",
};

/**
 * About, in the homepage's design (pages redesign, 15 Oct 2026; rebuilt for finding B4, 17 Oct
 * 2026): the full dark hero with the `about.hero` image slot; the narrative from the About route
 * page as homepage bands, with its "Six practices, one firm" section shown as the six practices'
 * linked cards and a link to How We Work; "How we prove it"; the Founder (behind
 * ABOUT_FOUNDER_ENABLED, from the published author profile only); the company facts; the onward
 * links as icon cards with one line each; the closing card. Nothing here is written for the page:
 * the words are the route page's, the practices', the profile's and site settings'.
 */
export function AboutPage({ data }: Readonly<{ data: AboutData }>) {
  const { page, gates } = data;
  const links = aboutLinks(gates, data.intros);
  const { before, intro, after } = splitAtPracticesSection(page?.body);
  const facts = companyFacts(data.settings);
  const authorHref = gates.open.insights ? authorPath(founderProfile.authorSlug) : undefined;
  // The founder's Person (WS5's helper): only while the Founder section is shown.
  const founderPerson = data.founderEnabled
    ? founderPersonNode(
        {
          name: founderProfile.name,
          slug: founderProfile.authorSlug,
          roleTitle: founderProfile.role,
        },
        { siteUrl: getSeoContext().siteUrl },
      )
    : null;
  return (
    <PageMain>
      <PageHeroBand
        full
        artwork={heroArtwork("about")}
        crumbs={
          <Breadcrumbs
            trail={[homeCrumb, { name: navLabels.about, path: routes.about() }]}
            page={{
              type: "AboutPage",
              name: page?.heading,
              description: page?.intro,
              ...(founderPerson ? { mainEntity: founderPerson } : {}),
            }}
          />
        }
        title={page?.heading ?? navLabels.about}
        lead={page?.intro}
        media={mediaSlotRenders("about.hero") ? <MediaSlot id="about.hero" priority /> : undefined}
      />
      {renderBands(
        [
          ...bodyBands(before),
          (tone) =>
            data.practices.length > 0 && practicesHeading ? (
              <Band
                tone={tone}
                heading={practicesHeading}
                intro={intro}
                link={{ label: navLabels.howWeWork, href: routes.howWeWork() }}
              >
                <FeatureGrid
                  items={data.practices.map((item) => ({
                    title: item.title,
                    href: item.href,
                    ...(item.summary ? { text: item.summary } : {}),
                    ...(item.icon ? { icon: item.icon } : {}),
                  }))}
                />
              </Band>
            ) : null,
          ...bodyBands(after),
          (tone) => <ProofApproachBand items={data.proof} tone={tone} />,
          (tone) =>
            data.founderEnabled ? (
              <Band tone={tone} heading={aboutLabels.founder}>
                <div
                  className={
                    mediaSlotRenders("about.founder")
                      ? "grid items-start gap-(--space-7) md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"
                      : undefined
                  }
                >
                  {mediaSlotRenders("about.founder") ? (
                    <MediaSlot
                      id="about.founder"
                      itemName={founderProfile.name}
                      className="max-w-xs"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <h3 className="m-0 text-h3 text-tone-heading">{founderProfile.name}</h3>
                    <p className="m-0 mt-(--space-1) text-small text-tone-muted">
                      {founderProfile.role}
                    </p>
                    <p className="m-0 mt-(--space-4) max-w-(--container-prose) text-body-l text-pretty">
                      {founderProfile.bio}
                    </p>
                    {authorHref ? (
                      <p className="m-0 mt-(--space-4)">
                        <TextLink href={authorHref}>{aboutLabels.authorProfile}</TextLink>
                      </p>
                    ) : null}
                  </div>
                </div>
              </Band>
            ) : null,
          (tone) =>
            facts.length > 0 ? (
              <Band tone={tone} heading={aboutLabels.companyFacts}>
                <DefinitionList
                  items={facts}
                  className="max-w-(--container-content) border-b border-tone-border"
                />
              </Band>
            ) : null,
          (tone) =>
            links.length > 0 ? (
              <Band tone={tone} heading={exploreHeading}>
                <FeatureGrid
                  columns={3}
                  items={links.map((link) => ({
                    title: link.label,
                    href: link.href,
                    ...(link.description ? { text: link.description } : {}),
                    icon: linkIcons[link.key] ?? "link",
                  }))}
                />
              </Band>
            ) : null,
        ],
        "light",
      )}
      <ClosingBand />
    </PageMain>
  );
}
