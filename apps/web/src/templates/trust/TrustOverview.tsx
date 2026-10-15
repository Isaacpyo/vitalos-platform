import { ctas, navLabels, routes } from "@vitalos/cms";
import type { TrustTopic } from "@vitalos/cms";
import { FeatureGrid } from "@vitalos/ui";
import type { IconName } from "@vitalos/ui";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import type { TrustOverviewData } from "./load";
import { evidenceRequestLink, topicRowProps } from "./map";
import { contactHref } from "../../lib/view-mapping/hrefs";
import { Band, ClosingBand, renderBands } from "../commercial/bands";
import { bodyBands } from "../commercial/body-bands";

/** Icons for the topic cards, by topic. */
const topicIcons: Readonly<Record<TrustTopic, IconName>> = {
  security: "shield",
  privacy: "lock",
  "responsible-ai": "chip",
  accessibility: "eye",
  resilience: "server",
  subprocessors: "link",
  certifications: "success",
  procurement: "document",
};

/**
 * Trust Centre overview, in the homepage's design (pages redesign, 15 Oct 2026): the full dark
 * hero, the route page's body, the published topics as icon cards, and the closing card whose
 * action is the controlled evidence request. No claims are made here: every statement comes from
 * the CMS.
 */
export function TrustOverview({ data }: Readonly<{ data: TrustOverviewData }>) {
  const { page, topics } = data;
  return (
    <PageMain>
      <PageHeroBand
        full
        crumbs={
          <Breadcrumbs trail={[homeCrumb, { name: navLabels.trustCentre, path: routes.trust() }]} />
        }
        title={page?.heading ?? navLabels.trustCentre}
        lead={page?.intro}
      />
      {renderBands(
        [
          ...bodyBands(page?.body),
          (tone) =>
            topics.length > 0 ? (
              <Band tone={tone}>
                <FeatureGrid
                  headingLevel={2}
                  items={topics.map((topic) => {
                    const row = topicRowProps(topic);
                    return {
                      title: row.title,
                      href: row.href,
                      ...(row.summary ? { text: row.summary } : {}),
                      icon: topicIcons[topic.topic],
                    };
                  })}
                />
              </Band>
            ) : null,
        ],
        "light",
      )}
      <ClosingBand
        primary={evidenceRequestLink}
        secondary={{ label: ctas.primary, href: contactHref() }}
      />
    </PageMain>
  );
}
