import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { topicHref } from "../../../../../../../src/features/content/insights/model";
import {
  renderTopicPage,
  topicMetadata,
} from "../../../../../../../src/templates/insights/TopicTemplate";

type Params = { slug: string; n: string };

export const dynamicParams = true;
export const generateStaticParams = (): Params[] => [];

async function resolve(params: Promise<Params>): Promise<{ slug: string; page: number }> {
  const { slug, n } = await params;
  if (!/^[1-9][0-9]{0,3}$/.test(n)) notFound();
  const page = Number(n);
  if (page === 1) permanentRedirect(topicHref(slug));
  return { slug, page };
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const { slug, page } = await resolve(params);
  return topicMetadata(slug, page);
}

export default async function TopicPageN({ params }: Readonly<{ params: Promise<Params> }>) {
  const { slug, page } = await resolve(params);
  return renderTopicPage(slug, page);
}
