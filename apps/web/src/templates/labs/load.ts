import "server-only";
import { cache } from "react";
import type {
  LabAssetSummary,
  LabAssetView,
  LabType,
  PublicationGates,
  RoutePageView,
} from "@vitalos/cms";
import { isDraftModeEnabled } from "../../lib/cms/draft";
import { getContentSource, getPublishedContentSource } from "../../lib/cms/get-content-source";
import { isLabType } from "./map";

export interface LabsIndexData {
  page: RoutePageView | null;
  assets: LabAssetSummary[];
  draft: boolean;
}

export const loadLabsIndex = cache(async (): Promise<LabsIndexData> => {
  const source = await getContentSource();
  const [page, assets, draft] = await Promise.all([
    source.getRoutePage("labs"),
    source.listSummaries("labAsset"),
    isDraftModeEnabled(),
  ]);
  return { page, assets, draft };
});

export interface LabTypeData {
  type: LabType;
  assets: LabAssetSummary[];
  draft: boolean;
}

/** Null (a 404) for an unknown type or a type with no published assets (outside Draft Mode). */
export const loadLabType = cache(async (type: string): Promise<LabTypeData | null> => {
  if (!isLabType(type)) return null;
  const source = await getContentSource();
  const [all, draft] = await Promise.all([source.listSummaries("labAsset"), isDraftModeEnabled()]);
  const assets = all.filter((asset) => asset.labType === type);
  return assets.length > 0 || draft ? { type, assets, draft } : null;
});

export interface LabAssetData {
  type: LabType;
  asset: LabAssetView;
  gates: PublicationGates;
  draft: boolean;
}

/**
 * Null (a 404) for an unknown type, a missing asset, or an asset without stated limitations:
 * every lab asset states its limitations, so one without them is not public (outside Draft Mode).
 */
export const loadLabAsset = cache(
  async (type: string, slug: string): Promise<LabAssetData | null> => {
    if (!isLabType(type)) return null;
    const source = await getContentSource();
    const [asset, gates, draft] = await Promise.all([
      source.getDocument("labAsset", slug, { labType: type }),
      source.getPublicationGates(),
      isDraftModeEnabled(),
    ]);
    if (!asset || asset.labType !== type) return null;
    if (!draft && asset.limitations.trim() === "") return null;
    return { type, asset, gates, draft };
  },
);

export async function listLabTypeParams(): Promise<{ type: string }[]> {
  const source = await getPublishedContentSource();
  const types = new Set(
    (await source.listParams("labAsset")).flatMap((p) => (p.type ? [p.type] : [])),
  );
  return [...types].map((type) => ({ type }));
}

export async function listLabAssetParams(): Promise<{ type: string; slug: string }[]> {
  const source = await getPublishedContentSource();
  return (await source.listParams("labAsset")).flatMap((p) =>
    p.type && p.slug ? [{ type: p.type, slug: p.slug }] : [],
  );
}
