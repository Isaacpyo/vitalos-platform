import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { structuralSeo } from "@vitalos/cms/repo";
import { structuralLabels } from "../../../src/lib/view-mapping/labels";
import { FaqPage } from "../../../src/templates/faq/FaqPage";
import { loadFaq } from "../../../src/templates/faq/load";
import { pageMetadata } from "../../../src/templates/institutional/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const groups = await loadFaq();
  return pageMetadata({
    path: routes.faq(),
    title: structuralLabels.faq,
    description: structuralSeo.faq.description,
    // Nothing to index until a solution answers a question.
    noindex: groups.length === 0,
  });
}

export default async function FaqRoute() {
  return <FaqPage groups={await loadFaq()} />;
}
