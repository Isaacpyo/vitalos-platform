import { labMaturityLabels, labTypeLabels, labTypes, routes } from "@vitalos/cms";
import type { LabAssetSummary, LabAssetView, LabMaturity, LabType } from "@vitalos/cms";
import { isNonEmpty } from "@vitalos/ui";
import type { LabAssetRowProps, NonEmptyArray, ResourceLink } from "@vitalos/ui";
import { isHttpsUrl } from "../institutional/format";
import { buildFilterGroups } from "../institutional/list-filter-model";
import type { FilterDimension, FilterGroup } from "../institutional/list-filter-model";

/** Lab view models to pattern props. Pure and framework-free. */

/** Structural labels (Stage 8 §15, Stage 9 §26 "Asset page"). */
export const labLabels = {
  categories: "Categories",
  maturity: "Maturity",
  whatItIs: "What it is",
  whatItIsNot: "What it is not",
  limitations: "Known limitations",
  resources: "Resources",
  repository: "Repository",
  demo: "Demo",
  updated: "Updated",
} as const;

export const isLabType = (value: string): value is LabType =>
  (labTypes as readonly string[]).includes(value);

export const labTypeLabel = (type: LabType): string => labTypeLabels[type];
export const maturityLabel = (maturity: LabMaturity): string => labMaturityLabels[maturity];

/** Props for one row of a Labs list: type, title, maturity badge directly under it, summary. */
export function labRowProps(asset: LabAssetSummary): Omit<LabAssetRowProps, "headingLevel"> {
  return {
    title: asset.title,
    href: routes.labAsset(asset.labType, asset.slug),
    ...(asset.summary ? { summary: asset.summary } : {}),
    eyebrow: labTypeLabel(asset.labType),
    maturity: asset.maturity,
    maturityLabel: maturityLabel(asset.maturity),
  };
}

/**
 * Repository and demo links, only when present and safe (https). The view contract carries them
 * only for maintained assets; this additionally refuses anything that is not a plain https URL.
 */
export function resourceLinks(asset: LabAssetView): NonEmptyArray<ResourceLink> | undefined {
  const links: ResourceLink[] = [];
  if (isHttpsUrl(asset.repoUrl)) {
    links.push({ label: labLabels.repository, href: asset.repoUrl, external: true });
  }
  if (isHttpsUrl(asset.demoUrl)) {
    links.push({ label: labLabels.demo, href: asset.demoUrl, external: true });
  }
  return isNonEmpty(links) ? links : undefined;
}

/** What it is / what it is not, as definition-list items. Absent statements are omitted. */
export function isIsNotItems(asset: LabAssetView): { term: string; description: string }[] {
  const items: { term: string; description: string }[] = [];
  if (asset.is?.trim()) items.push({ term: labLabels.whatItIs, description: asset.is });
  if (asset.isNot?.trim()) items.push({ term: labLabels.whatItIsNot, description: asset.isNot });
  return items;
}

/** Lab types that have at least one asset, in the order of the type list. */
export function typesWithAssets(assets: readonly LabAssetSummary[]): LabType[] {
  const present = new Set(assets.map((asset) => asset.labType));
  return labTypes.filter((type) => present.has(type));
}

/** Maturity filter for Labs lists (Stage 9 §26: maturity filters). */
export const labFilterDimensions: readonly FilterDimension<LabAssetSummary>[] = [
  {
    key: "maturity",
    label: labLabels.maturity,
    valuesOf: (asset) => [{ value: asset.maturity, label: maturityLabel(asset.maturity) }],
  },
];

export function labFilterGroups(assets: readonly LabAssetSummary[]): FilterGroup[] {
  return buildFilterGroups(assets, labFilterDimensions);
}
