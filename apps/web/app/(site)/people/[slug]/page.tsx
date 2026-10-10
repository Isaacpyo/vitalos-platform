import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routes } from "@vitalos/cms";
import { pageMetadata } from "../../../../src/templates/institutional/metadata";
import { listPersonParams, loadPerson } from "../../../../src/templates/people/load";
import { ProfilePage } from "../../../../src/templates/people/ProfilePage";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return listPersonParams();
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPerson(slug);
  if (!data) notFound();
  return pageMetadata({
    path: routes.person(slug),
    title: data.person.name,
    description: data.person.summary,
    seo: data.person.seo,
    type: "profile",
  });
}

export default async function PersonRoute({ params }: Readonly<{ params: Promise<Params> }>) {
  const { slug } = await params;
  const data = await loadPerson(slug);
  if (!data) notFound();
  return <ProfilePage data={data} />;
}
