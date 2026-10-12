import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { navLabels, routes } from "@vitalos/cms";
import { JsonLd } from "../../../src/components/json-ld";
import { loadChromeContent } from "../../../src/components/site-chrome/load";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { breadcrumbNode, pageMetadata } from "../../../src/templates/commercial/seo";
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
  const [page, content] = await Promise.all([loadRoutePage("what-we-do"), loadChromeContent()]);
  const { practices, solutions, offers } = content;
  // Nothing to show: no introduction and no documents. A page of only a heading would be a
  // dead end, so the route answers 404 until there is content.
  if (!page && practices.length + solutions.length + offers.length === 0) notFound();
  return (
    <>
      <JsonLd data={breadcrumbNode(whatWeDoTrail())} />
      <WhatWeDoTemplate page={page} practices={practices} solutions={solutions} offers={offers} />
    </>
  );
}
