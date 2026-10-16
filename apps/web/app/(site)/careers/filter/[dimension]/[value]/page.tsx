import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadCareersPage } from "../../../../../../src/features/content/careers/load";
import {
  FILTER_THRESHOLD,
  filterLabel,
  isFilterDimension,
} from "../../../../../../src/features/content/careers/model";
import type { CareersFilter } from "../../../../../../src/features/content/careers/model";
import { CAREERS_BASE } from "../../../../../../src/features/content/routes";
import { CareersTemplate } from "../../../../../../src/templates/careers/CareersTemplate";
import { careersMetadata } from "../../../../../../src/templates/careers/metadata";

type Params = { dimension: string; value: string };

/**
 * `/careers?practice=…` (and `workModel`, `employmentType`), rewritten here by `next.config.ts` so
 * the view stays static. Filtered views are `noindex, follow` with the canonical on `/careers`;
 * they exist only while more than six roles are open, and only for values a role has.
 */
export const dynamicParams = true;
export const generateStaticParams = (): Params[] => [];

async function load(params: Promise<Params>) {
  const { dimension, value } = await params;
  if (!isFilterDimension(dimension) || !/^[a-z0-9_-]{1,40}$/.test(value)) notFound();
  const filter: CareersFilter = { dimension, value };
  const view = await loadCareersPage();
  const label = filterLabel(view.page, filter);
  if (view.page.total <= FILTER_THRESHOLD || !label) notFound();
  return { view, filter, label };
}

export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<Params> }>): Promise<Metadata> {
  const { label, view } = await load(params);
  return careersMetadata({
    path: CAREERS_BASE,
    title: label,
    description: view.page.copy.intro,
    noindex: true,
    follow: true,
  });
}

export default async function CareersFilterPage({ params }: Readonly<{ params: Promise<Params> }>) {
  const { view, filter } = await load(params);
  return <CareersTemplate view={view} filter={filter} />;
}
