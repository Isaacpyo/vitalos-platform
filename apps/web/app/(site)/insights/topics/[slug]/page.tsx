import type { Metadata } from "next";
import {
  renderTopicPage,
  topicMetadata,
} from "../../../../../src/templates/insights/TopicTemplate";

type Params = { slug: string };

export const dynamicParams = true;
export const generateStaticParams = (): Params[] => [];

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  return topicMetadata((await params).slug, 1);
}

export default async function TopicPage({ params }: Readonly<{ params: Promise<Params> }>) {
  return renderTopicPage((await params).slug, 1);
}
