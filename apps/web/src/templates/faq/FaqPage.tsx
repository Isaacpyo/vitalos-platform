import { navLabels, routes } from "@vitalos/cms";
import { Disclosure, Heading, Stack, TextLink } from "@vitalos/ui";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import type { Crumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import type { FaqGroup } from "./load";
import { FaqNav } from "./FaqNav";
import { ClosingBand } from "../commercial/bands";

export const faqTrail = (): Crumb[] => [homeCrumb, { name: navLabels.faq, path: routes.faq() }];

const groupId = (index: number) => `faq-${index}`;

/**
 * FAQ (Support menu). One section per solution: its questions as disclosures and a link to the
 * solution page that answers them in context. From lg the left column is one sticky list of every
 * group title (FaqNav) that highlights the group in view. The questions and answers are the solution pages' own; the page adds only
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
        <div className="grid min-w-0 gap-(--space-8) lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-start">
          {/* One sticky panel listing every group title; the one in view is highlighted (owner
              direction, 17 Oct 2026). Small screens show the groups stacked with their own titles. */}
          <div className="hidden min-w-0 lg:sticky lg:top-[calc(var(--size-header)+var(--space-5))] lg:block">
            <FaqNav
              label={structuralLabels.faqGroups}
              items={groups.map((group, index) => ({ id: groupId(index), title: group.title }))}
            />
          </div>
          <Stack gap={8} className="min-w-0">
            {groups.map((group, index) => (
              <section
                key={group.href}
                id={groupId(index)}
                aria-labelledby={`${groupId(index)}-title`}
                className="min-w-0 scroll-mt-[calc(var(--size-header)+var(--space-5))]"
              >
                <Heading
                  id={`${groupId(index)}-title`}
                  level={2}
                  size="h3"
                  className="mb-(--space-5) lg:sr-only"
                >
                  {group.title}
                </Heading>
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
              </section>
            ))}
          </Stack>
        </div>
      </PageBand>
      <ClosingBand />
    </PageMain>
  );
}
