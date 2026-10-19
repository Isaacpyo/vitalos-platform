import { navLabels, routes } from "@vitalos/cms";
import { FeatureGrid } from "@vitalos/ui";
import type { IconName } from "@vitalos/ui";
import { Band, ClosingBand, renderBands } from "../commercial/bands";
import { bodyBands } from "../commercial/body-bands";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import type { AboutData } from "./load";
import { aboutLinks, exploreHeading } from "./map";

/** Icons for the onward links, by key. */
const linkIcons: Readonly<Record<string, IconName>> = {
  "how-we-work": "workflow",
  trust: "shield",
  careers: "users",
};

/**
 * About, in the homepage's design (pages redesign, 15 Oct 2026): the full dark hero, with no image
 * until there is a real team photograph (owner direction, 19 Oct 2026); the narrative from the
 * About route page as homepage bands (short headed paragraphs as cards, lists as rows); the onward
 * links as icon cards; the closing card.
 * The heading, introduction and narrative come from the CMS; the locked navigation label is the
 * only fallback heading; onward links use locked labels.
 */
export function AboutPage({ data }: Readonly<{ data: AboutData }>) {
  const { page, gates } = data;
  const links = aboutLinks(gates);
  return (
    <PageMain>
      <PageHeroBand
        full
        crumbs={
          <Breadcrumbs
            trail={[homeCrumb, { name: navLabels.about, path: routes.about() }]}
            page={{ type: "AboutPage", name: page?.heading, description: page?.intro }}
          />
        }
        title={page?.heading ?? navLabels.about}
        lead={page?.intro}
      />
      {renderBands(
        [
          ...bodyBands(page?.body),
          (tone) =>
            links.length > 0 ? (
              <Band tone={tone} heading={exploreHeading}>
                <FeatureGrid
                  columns={3}
                  items={links.map((link) => ({
                    title: link.label,
                    href: link.href,
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
