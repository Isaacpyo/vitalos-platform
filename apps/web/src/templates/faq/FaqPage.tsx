import { navLabels, routes } from "@vitalos/cms";
import { Disclosure, Stack, TextLink } from "@vitalos/ui";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import type { Crumb } from "../institutional/breadcrumbs";
import { ContentSection, PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import type { FaqGroup } from "./load";
import { ClosingBand } from "../commercial/bands";

export const faqTrail = (): Crumb[] => [homeCrumb, { name: navLabels.faq, path: routes.faq() }];

const groupId = (index: number) => `faq-${index}`;

/**
 * FAQ (Support menu). One section per solution, its questions as disclosures and a link to the
 * solution page that answers them in context. The questions and answers are the solution pages'
 * own; the page adds only structural labels.
 */
export function FaqPage({ groups }: Readonly<{ groups: readonly FaqGroup[] }>) {
  return (
    <PageMain>
      <PageHeroBand full crumbs={<Breadcrumbs trail={faqTrail()} />} title={structuralLabels.faq} />
      <PageBand>
        <Stack gap={8}>
          {groups.map((group, index) => (
            <ContentSection key={group.href} id={groupId(index)} heading={group.title}>
              <div className="grid max-w-(--container-content) gap-(--space-3)">
                {group.entries.map((entry, entryIndex) => (
                  <Disclosure key={`${entry.question}-${entryIndex}`} summary={entry.question}>
                    <p className="m-0 max-w-(--container-prose) text-pretty">{entry.answer}</p>
                  </Disclosure>
                ))}
              </div>
              <p className="m-0 mt-(--space-4)">
                <TextLink href={group.href}>{group.title}</TextLink>
              </p>
            </ContentSection>
          ))}
        </Stack>
      </PageBand>
      <ClosingBand />
    </PageMain>
  );
}
