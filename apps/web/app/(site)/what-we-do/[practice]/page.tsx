import type { Metadata } from "next";
import { routes } from "@vitalos/cms";
import { JsonLd } from "../../../../src/components/json-ld";
import {
  loadDetailPage,
  loadDocument,
  staticParams,
} from "../../../../src/templates/commercial/load";
import { pageGraph, pageMetadata } from "../../../../src/templates/commercial/seo";
import {
  PracticeTemplate,
  practiceTrail,
} from "../../../../src/templates/practice/PracticeTemplate";

type Props = { params: Promise<{ practice: string }> };

export async function generateStaticParams() {
  return staticParams("practice", "practice");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { practice: slug } = await params;
  const practice = await loadDocument("practice", slug);
  if (!practice) return {};
  return pageMetadata({
    path: routes.practice(practice.slug),
    title: practice.title,
    description: practice.summary ?? practice.proposition,
    seo: practice.seo,
  });
}

export default async function PracticePage({ params }: Props) {
  const { practice: slug } = await params;
  const { doc, gates } = await loadDetailPage("practice", slug);
  return (
    <>
      <JsonLd
        data={pageGraph({
          trail: practiceTrail(doc),
          name: doc.title,
          description: doc.proposition,
          serviceType: doc.title.replace(/^Vitaloss+/, ""),
          dateModified: doc.updatedAt,
        })}
      />
      <PracticeTemplate practice={doc} gates={gates} />
    </>
  );
}
