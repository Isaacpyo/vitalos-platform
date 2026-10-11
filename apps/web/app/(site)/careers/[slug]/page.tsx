import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { routes } from "@vitalos/cms";
import { isDetailIndexableNow } from "../../../../src/features/publication-gates/gates";
import { JobPage } from "../../../../src/templates/careers/JobPage";
import { listJobParams, loadJob } from "../../../../src/templates/careers/load";
import { isOpenRole } from "../../../../src/templates/careers/map";
import { pageMetadata } from "../../../../src/templates/institutional/metadata";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return listJobParams();
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadJob(slug);
  if (!data) notFound();
  return pageMetadata({
    path: routes.job(slug),
    title: data.job.title,
    description: data.job.summary,
    seo: data.job.seo,
    // A closed or expired role keeps its page but is not indexed; so does any role while the
    // Careers section is below its gate.
    noindex:
      data.job.placeholder === true ||
      !isOpenRole(data.job, data.now) ||
      !(await isDetailIndexableNow("careers")),
  });
}

export default async function JobRoute({ params }: Readonly<{ params: Promise<Params> }>) {
  const { slug } = await params;
  const data = await loadJob(slug);
  if (!data) notFound();
  return <JobPage data={data} />;
}
