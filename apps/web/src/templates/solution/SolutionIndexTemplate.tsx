import { routes, solutionNames } from "@vitalos/cms";
import type { RoutePageView, SolutionSummary } from "@vitalos/cms";
import { SolutionCard } from "@vitalos/ui";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import { toSolutionCard } from "../../lib/view-mapping/patterns";
import { Band, CardGrid, gapBand } from "../commercial/bands";
import { IndexLayout } from "../commercial/IndexLayout";

export interface SolutionIndexTemplateProps {
  page: RoutePageView | null;
  solutions: readonly SolutionSummary[];
  draft: boolean;
}

export const solutionsTrail = () =>
  trail(
    { label: structuralLabels.whatWeDo, path: routes.whatWeDo() },
    { label: structuralLabels.solutions, path: routes.solutions() },
  );

/** Solutions index: problem-led propositions, in the order the specs fix. */
export function SolutionIndexTemplate({
  page,
  solutions,
  draft,
}: Readonly<SolutionIndexTemplateProps>) {
  const cards = orderByLockedNames(solutions, solutionNames).flatMap((solution) => {
    const card = toSolutionCard(solution);
    return card ? [card] : [];
  });
  return (
    <IndexLayout
      crumbs={solutionsTrail()}
      title={page?.heading ?? structuralLabels.solutions}
      lead={page?.intro}
      body={page?.body}
      bands={[
        (tone) =>
          cards.length > 0 ? (
            <Band tone={tone}>
              <CardGrid>
                {cards.map((card) => (
                  <li key={card.href} className="min-w-0">
                    <SolutionCard {...card} headingLevel={2} />
                  </li>
                ))}
              </CardGrid>
            </Band>
          ) : (
            gapBand(draft, structuralLabels.solutions, tone)
          ),
      ]}
    />
  );
}
