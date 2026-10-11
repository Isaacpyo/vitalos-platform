import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routes } from "@vitalos/cms";
import { pageMetadata } from "../../../../src/templates/institutional/metadata";
import { listTrustTopicParams, loadTrustTopic } from "../../../../src/templates/trust/load";
import { TrustTopicPage } from "../../../../src/templates/trust/TrustTopicPage";

type Params = { topic: string };

export async function generateStaticParams(): Promise<Params[]> {
  return listTrustTopicParams();
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const { topic } = await params;
  const data = await loadTrustTopic(topic);
  if (!data) notFound();
  return pageMetadata({
    path: routes.trustTopic(data.topic),
    title: data.view.title,
    description: data.view.summary,
    seo: data.view.seo,
  });
}

export default async function TrustTopicRoute({ params }: Readonly<{ params: Promise<Params> }>) {
  const { topic } = await params;
  // Unknown topic or no published document for it: 404.
  const data = await loadTrustTopic(topic);
  if (!data) notFound();
  return <TrustTopicPage data={data} />;
}
