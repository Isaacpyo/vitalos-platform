import { navLabels, routes, solutionNames } from "@vitalos/cms";
import type { ContactIntent } from "@vitalos/cms";
import { AskRelayButton } from "../../components/ask-relay";
import { FaqFilter } from "./FaqFilter";
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

/** Structural labels of the FAQ page's filter and per-section routes (finding B10). */
export const faqLabels = {
  filter: "Filter questions",
  count: "{shown} of {total} questions",
  none: "No questions match. Try fewer words, or contact us.",
  askRelay: "Ask Relay",
} as const;

/** The enquiry topic a section's Contact link opens: AI questions open the AI topic. */
export const faqContactIntent = (title: string): ContactIntent =>
  title === solutionNames[0] ? "ai" : "project";

const FAQ_LIST_ID = "faq-list";

/**
 * FAQ (Support menu). One section per solution, its questions as disclosures and a link to the
 * solution page that answers them in context. The questions and answers are the solution pages'
 * own; the page adds only structural labels.
 */
export function FaqPage({
  groups,
  relayEnabled = false,
}: Readonly<{ groups: readonly FaqGroup[]; relayEnabled?: boolean }>) {
  return (
    <PageMain>
      <PageHeroBand
        full
        crumbs={
          <Breadcrumbs
            trail={faqTrail()}
            page={{
              type: "CollectionPage",
              name: structuralLabels.faq,
              // FAQPage (finding B10): the questions and answers exactly as the page shows them.
              faq: groups.flatMap((group) => group.entries),
            }}
          />
        }
        title={structuralLabels.faq}
      />
      <PageBand>
        <FaqFilter
          targetId={FAQ_LIST_ID}
          labels={{ label: faqLabels.filter, count: faqLabels.count, none: faqLabels.none }}
        />
        <Stack gap={8} id={FAQ_LIST_ID} className="mt-(--space-6)">
          {groups.map((group, index) => (
            // Stable section anchor (the solution slug) and the filter's group marker.
            <div key={group.href} id={group.id} data-faq-group="">
              <ContentSection id={groupId(index)} heading={group.title}>
                <div className="grid max-w-(--container-content) gap-(--space-3)">
                  {group.entries.map((entry, entryIndex) => (
                    <Disclosure
                      key={`${entry.question}-${entryIndex}`}
                      id={entry.id}
                      data-faq-entry=""
                      summary={entry.question}
                    >
                      <p className="m-0 max-w-(--container-prose) text-pretty">{entry.answer}</p>
                    </Disclosure>
                  ))}
                </div>
                <p className="m-0 mt-(--space-4) flex flex-wrap items-center gap-x-(--space-5) gap-y-(--space-2)">
                  <TextLink href={group.href}>{group.title}</TextLink>
                  {/* Still a question? Per section: the contact form on the matching topic, and
                    Relay where it is enabled (finding B10). */}
                  <TextLink href={routes.contact(faqContactIntent(group.title))}>
                    {navLabels.contact}
                  </TextLink>
                  {relayEnabled ? <AskRelayButton label={faqLabels.askRelay} /> : null}
                </p>
              </ContentSection>
            </div>
          ))}
        </Stack>
      </PageBand>
      <ClosingBand />
    </PageMain>
  );
}
