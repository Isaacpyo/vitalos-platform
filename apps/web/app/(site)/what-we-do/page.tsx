import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { howWeWorkStages, navLabels, routes } from "@vitalos/cms";
import { JsonLd } from "../../../src/components/json-ld";
import { loadChromeContent } from "../../../src/components/site-chrome/load";
import { lifecycleStages } from "../../../src/lib/view-mapping/showcase";
import { deriveStages } from "../../../src/lib/view-mapping/stages";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { pageGraph, pageMetadata } from "../../../src/templates/commercial/seo";
import { WhatWeDoTemplate, whatWeDoTrail } from "../../../src/templates/practice/WhatWeDoTemplate";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadRoutePage("what-we-do");
  return pageMetadata({
    path: routes.whatWeDo(),
    title: page?.heading ?? navLabels.whatWeDo,
    seo: page?.seo,
  });
}

export default async function WhatWeDoPage() {
  const [page, content, howWeWork] = await Promise.all([
    loadRoutePage("what-we-do"),
    loadChromeContent(),
    loadRoutePage("how-we-work"),
  ]);
  const { practices, solutions, offers } = content;
  // Nothing to show: no introduction and no documents. A page of only a heading would be a
  // dead end, so the route answers 404 until there is content.
  if (!page && practices.length + solutions.length + offers.length === 0) notFound();
  return (
    <>
      <JsonLd
        data={pageGraph({
          trail: whatWeDoTrail(),
          name: page?.heading ?? navLabels.whatWeDo,
          description: page?.intro,
          type: "CollectionPage",
        })}
      />
      <WhatWeDoTemplate
        page={page}
        practices={practices}
        solutions={solutions}
        offers={offers}
        howWeWorkIntro={howWeWork?.intro}
        {...(howWeWork
          ? {
              howWeWorkStages: lifecycleStages(
                deriveStages(howWeWork.body, howWeWorkStages).stages,
              ),
            }
          : {})}
      />
    </>
  );
}
