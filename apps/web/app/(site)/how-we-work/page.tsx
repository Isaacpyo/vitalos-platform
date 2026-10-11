import type { Metadata } from "next";
import { navLabels, routes } from "@vitalos/cms";
import { JsonLd } from "../../../src/components/json-ld";
import { isDraftModeEnabled } from "../../../src/lib/cms/draft";
import { loadRoutePage } from "../../../src/templates/commercial/load";
import { breadcrumbNode, pageMetadata } from "../../../src/templates/commercial/seo";
import {
  HowWeWorkTemplate,
  howWeWorkTrail,
} from "../../../src/templates/how-we-work/HowWeWorkTemplate";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadRoutePage("how-we-work");
  return pageMetadata({
    path: routes.howWeWork(),
    title: page?.heading ?? navLabels.howWeWork,
    seo: page?.seo,
  });
}

export default async function HowWeWorkPage() {
  const [page, draft] = await Promise.all([loadRoutePage("how-we-work"), isDraftModeEnabled()]);
  return (
    <>
      <JsonLd data={breadcrumbNode(howWeWorkTrail())} />
      <HowWeWorkTemplate page={page} draft={draft} />
    </>
  );
}
