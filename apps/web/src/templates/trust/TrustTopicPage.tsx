import { navLabels, routes } from "@vitalos/cms";
import {
  CertificationItem,
  EvidenceRequestCTA,
  MetaRow,
  Stack,
  SubprocessorTable,
  TextLink,
} from "@vitalos/ui";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { formatDate } from "../institutional/format";
import { ContentSection, PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { hasRichText } from "../institutional/rich";
import type { TrustTopicData } from "./load";
import {
  evidenceRequestLink,
  evidenceTopics,
  publishableCertifications,
  safeEmail,
  subprocessorRows,
  trustLabels,
  trustTopicLabel,
} from "./map";

/**
 * One Trust Centre topic. Certification blocks are omitted when there are none; the subprocessor
 * table renders only with rows; the evidence request leads to the contact form with the
 * procurement intent and never links to controlled evidence.
 */
export function TrustTopicPage({ data }: Readonly<{ data: TrustTopicData }>) {
  const { topic, view } = data;
  const certifications = publishableCertifications(view);
  const subprocessors = subprocessorRows(view);
  const email = safeEmail(view.contactEmail);
  const updated = formatDate(view.updatedAt);

  return (
    <PageMain>
      <PageHeroBand
        crumbs={
          <Breadcrumbs
            trail={[
              homeCrumb,
              { name: navLabels.trustCentre, path: routes.trust() },
              { name: view.title, path: routes.trustTopic(topic) },
            ]}
          />
        }
        title={view.title}
        eyebrow={trustTopicLabel(topic)}
        lead={view.summary}
      >
        {updated ? (
          <MetaRow
            items={[
              {
                label: trustLabels.updated,
                value: <time dateTime={view.updatedAt}>{updated}</time>,
              },
            ]}
          />
        ) : null}
      </PageHeroBand>
      <PageBand>
        <Stack gap={8}>
          {hasRichText(view.publicSummary) ? <RichText value={view.publicSummary} /> : null}

          {certifications.length > 0 ? (
            <ContentSection id="certifications" heading={trustLabels.certifications}>
              <Stack gap={5}>
                {certifications.map((cert) => (
                  <CertificationItem
                    key={`${cert.name}-${cert.issuedAt}`}
                    name={cert.name}
                    scope={cert.scope}
                    issuedAt={cert.issuedAt}
                    expiresAt={cert.expiresAt}
                    headingLevel={3}
                  />
                ))}
              </Stack>
            </ContentSection>
          ) : null}

          {subprocessors.length > 0 ? (
            <SubprocessorTable caption={trustLabels.subprocessors} rows={subprocessors} />
          ) : null}

          {evidenceTopics.includes(topic) ? (
            <EvidenceRequestCTA
              heading={trustLabels.requestEvidence}
              cta={evidenceRequestLink}
              headingLevel={2}
            />
          ) : null}

          {email ? (
            <ContentSection id="contact" heading={trustLabels.contact}>
              <TextLink href={`mailto:${email}`} arrow={false}>
                {email}
              </TextLink>
            </ContentSection>
          ) : null}
        </Stack>
      </PageBand>
    </PageMain>
  );
}
