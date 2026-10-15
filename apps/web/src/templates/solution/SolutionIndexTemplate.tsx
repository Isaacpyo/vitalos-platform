import { routes, solutionNames } from "@vitalos/cms";
import type { RoutePageView, SolutionSummary } from "@vitalos/cms";
import { SolutionShowcase } from "@vitalos/ui";
import { trail } from "../../lib/view-mapping/breadcrumbs";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import { solutionShowcaseItems } from "../../lib/view-mapping/showcase";
import { Band } from "../commercial/bands";
import { IndexLayout } from "../commercial/IndexLayout";

export interface SolutionIndexTemplateProps {
  page: RoutePageView | null;
  solutions: readonly SolutionSummary[];
}

export const solutionsTrail = () =>
  trail(
    { label: structuralLabels.whatWeDo, path: routes.whatWeDo() },
    { label: structuralLabels.solutions, path: routes.solutions() },
  );

/** Solutions index: problem-led propositions, in the order the specs fix, as the showcase. */
export function SolutionIndexTemplate({ page, solutions }: Readonly<SolutionIndexTemplateProps>) {
  const items = solutionShowcaseItems(orderByLockedNames(solutions, solutionNames), {
    headingLevel: 2,
  });
  return (
    <IndexLayout
      crumbs={solutionsTrail()}
      title={page?.heading ?? structuralLabels.solutions}
      lead={page?.intro}
      body={page?.body}
      bands={[
        (tone) =>
          items.length > 0 ? (
            <Band tone={tone}>
              <SolutionShowcase items={items} headingLevel={2} />
            </Band>
          ) : null,
      ]}
    />
  );
}
