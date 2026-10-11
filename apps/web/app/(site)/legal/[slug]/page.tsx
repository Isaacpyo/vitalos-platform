import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routes } from "@vitalos/cms";
import { isDraftModeEnabled } from "../../../../src/lib/cms/draft";
import { pageMetadata } from "../../../../src/templates/institutional/metadata";
import { LegalPage } from "../../../../src/templates/legal/LegalPage";
import { listLegalParams, loadLegalPage } from "../../../../src/templates/legal/load";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return listLegalParams();
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadLegalPage(slug);
  if (!page) notFound();
  return pageMetadata({ path: routes.legal(page.slug), title: page.title, seo: page.seo });
}

export default async function LegalRoute({ params }: Readonly<{ params: Promise<Params> }>) {
  const { slug } = await params;
  // Unknown slug or unpublished page: 404.
  const page = await loadLegalPage(slug);
  if (!page) notFound();
  return <LegalPage page={page} draft={await isDraftModeEnabled()} />;
}
