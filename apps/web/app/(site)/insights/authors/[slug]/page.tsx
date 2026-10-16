import type { Metadata } from "next";
import {
  authorMetadata,
  renderAuthorPage,
} from "../../../../../src/templates/insights/AuthorTemplate";

type Params = { slug: string };

export const dynamicParams = true;
export const generateStaticParams = (): Params[] => [];

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  return authorMetadata((await params).slug);
}

export default async function AuthorPage({ params }: Readonly<{ params: Promise<Params> }>) {
  return renderAuthorPage((await params).slug);
}
