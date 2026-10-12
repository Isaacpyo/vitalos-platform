import { navLabels, offerNames, practiceNames, routes, solutionNames } from "@vitalos/cms";
import type { OfferSummary, PracticeSummary, RoutePageView, SolutionSummary } from "@vitalos/cms";
import { OfferRow, PracticeRow, SolutionCard, TextLink } from "@vitalos/ui";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import { toOfferRows, toRows, toSolutionCard } from "../../lib/view-mapping/patterns";
import { Band, CardGrid, RowList } from "../commercial/bands";
import { IndexLayout } from "../commercial/IndexLayout";

export interface WhatWeDoTemplateProps {
  page: RoutePageView | null;
  practices: readonly PracticeSummary[];
  solutions: readonly SolutionSummary[];
  offers: readonly OfferSummary[];
}

export const whatWeDoTrail = () => trail({ label: navLabels.whatWeDo, path: routes.whatWeDo() });

/**
 * What We Do (Stage 8 section 9): the three commercial layers in one overview. Practices answer
 * what capabilities Vitalos has, Solutions which problems it solves, Offers what you can start
 * with; How We Work links to how delivery is controlled. The page heading and introduction come
 * from the CMS route page, with the locked navigation label as the h1 fallback.
 */
export function WhatWeDoTemplate({
  page,
  practices,
  solutions,
  offers,
}: Readonly<WhatWeDoTemplateProps>) {
  const practiceRows = toRows("practice", orderByLockedNames(practices, practiceNames));
  const solutionCards = orderByLockedNames(solutions, solutionNames).flatMap((solution) => {
    const card = toSolutionCard(solution);
    return card ? [card] : [];
  });
  const offerRows = toOfferRows(orderByLockedNames(offers, offerNames));

  return (
    <IndexLayout
      crumbs={whatWeDoTrail()}
      title={page?.heading ?? navLabels.whatWeDo}
      lead={page?.intro}
      body={page?.body}
      bands={[
        (tone) =>
          practiceRows.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.practices}>
              <RowList>
                {practiceRows.map((row) => (
                  <PracticeRow key={row.href} {...row} />
                ))}
              </RowList>
            </Band>
          ) : null,
        (tone) =>
          solutionCards.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.solutions}>
              <CardGrid>
                {solutionCards.map((card) => (
                  <li key={card.href} className="min-w-0">
                    <SolutionCard {...card} />
                  </li>
                ))}
              </CardGrid>
            </Band>
          ) : null,
        (tone) =>
          offerRows.length > 0 ? (
            <Band tone={tone} heading={structuralLabels.offers}>
              <RowList>
                {offerRows.map((row) => (
                  <OfferRow key={row.href} {...row} />
                ))}
              </RowList>
            </Band>
          ) : null,
        (tone) => (
          <Band tone={tone}>
            <TextLink href={routes.howWeWork()}>{navLabels.howWeWork}</TextLink>
          </Band>
        ),
      ]}
    />
  );
}
