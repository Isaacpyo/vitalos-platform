import type { Metadata } from "next";
import { navLabels, routes } from "@vitalos/cms";
import { JsonLd } from "../../../src/components/json-ld";
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
  const page = await loadRoutePage("how-we-work");
  return (
    <>
      <JsonLd data={breadcrumbNode(howWeWorkTrail())} />
      <HowWeWorkTemplate page={page} />
    </>
  );
}
