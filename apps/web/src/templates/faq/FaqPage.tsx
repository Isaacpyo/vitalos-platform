import { navLabels, routes } from "@vitalos/cms";
import { Disclosure, Heading, Stack, TextLink } from "@vitalos/ui";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import type { Crumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import type { FaqGroup } from "./load";
import { ClosingBand } from "../commercial/bands";

export const faqTrail = (): Crumb[] => [homeCrumb, { name: navLabels.faq, path: routes.faq() }];

const groupId = (index: number) => `faq-${index}`;

/**
 * FAQ (Support menu). One section per solution: its questions as disclosures and a link to the
 * solution page that answers them in context. From lg the section's title sticks in the left column
 * beside its questions. The questions and answers are the solution pages' own; the page adds only
 * structural labels.
 */
export function FaqPage({ groups }: Readonly<{ groups: readonly FaqGroup[] }>) {
  return (
    <PageMain>
      <PageHeroBand
        full
        crumbs={
          <Breadcrumbs
            trail={faqTrail()}
            page={{ type: "CollectionPage", name: structuralLabels.faq }}
          />
        }
        title={structuralLabels.faq}
      />
      <PageBand>
        <Stack gap={8}>
          {groups.map((group, index) => (
            <section
              key={group.href}
              aria-labelledby={groupId(index)}
              className="grid min-w-0 gap-(--space-5) lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-(--space-8)"
            >
              {/* The group's title stays in view on the left while its questions scroll (owner
                  direction, 17 Oct 2026); stacked above them on smaller screens. */}
              <div className="min-w-0 lg:sticky lg:top-[calc(var(--size-header)+var(--space-5))] lg:self-start">
                <Heading id={groupId(index)} level={2} size="h3">
                  {group.title}
                </Heading>
              </div>
              <div className="min-w-0">
                <div className="grid gap-(--space-3)">
                  {group.entries.map((entry, entryIndex) => (
                    <Disclosure key={`${entry.question}-${entryIndex}`} summary={entry.question}>
                      <p className="m-0 max-w-(--container-prose) text-pretty">{entry.answer}</p>
                    </Disclosure>
                  ))}
                </div>
                <p className="m-0 mt-(--space-4)">
                  <TextLink href={group.href}>{group.title}</TextLink>
                </p>
              </div>
            </section>
          ))}
        </Stack>
      </PageBand>
      <ClosingBand />
    </PageMain>
  );
}
