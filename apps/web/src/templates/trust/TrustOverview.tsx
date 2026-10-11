import { navLabels, routes } from "@vitalos/cms";
import { ContentGap, EvidenceRequestCTA, Stack, TrustTopicRow } from "@vitalos/ui";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import type { TrustOverviewData } from "./load";
import { evidenceRequestLink, topicRowProps, trustLabels } from "./map";

/**
 * Trust Centre overview: an assurance index of the published topics, with the controlled
 * evidence-request entry. No claims are made here: every statement comes from the CMS.
 */
export function TrustOverview({ data }: Readonly<{ data: TrustOverviewData }>) {
  const { page, topics, draft } = data;
  return (
    <PageMain>
      <PageHeroBand
        crumbs={
          <Breadcrumbs trail={[homeCrumb, { name: navLabels.trustCentre, path: routes.trust() }]} />
        }
        title={page?.heading ?? navLabels.trustCentre}
        lead={page?.intro}
      />
      <PageBand>
        <Stack gap={8}>
          <RichText value={page?.body} />
          <ContentGap
            draft={draft && !page && topics.length === 0}
            title="No Trust Centre content is published"
            description="Publish a Trust route page and trust topics in the Studio. Only verified, current statements belong here."
          />
          {topics.length > 0 ? (
            <ul className="m-0 list-none p-0">
              {topics.map((topic) => (
                <li key={topic.id}>
                  <TrustTopicRow {...topicRowProps(topic)} headingLevel={2} />
                </li>
              ))}
            </ul>
          ) : null}
          <EvidenceRequestCTA
            heading={trustLabels.requestEvidence}
            cta={evidenceRequestLink}
            headingLevel={2}
          />
        </Stack>
      </PageBand>
    </PageMain>
  );
}
