import "server-only";
import { cache } from "react";
import type {
  LabAssetSummary,
  LabAssetView,
  LabType,
  PublicationGates,
  RoutePageView,
} from "@vitalos/cms";
import { getContentSource } from "../../lib/cms/get-content-source";
import { isLabType } from "./map";

export interface LabsIndexData {
  page: RoutePageView | null;
  assets: LabAssetSummary[];
}

export const loadLabsIndex = cache(async (): Promise<LabsIndexData> => {
  const source = await getContentSource();
  const [page, assets] = await Promise.all([
    source.getRoutePage("labs"),
    source.listSummaries("labAsset"),
  ]);
  return { page, assets };
});

export interface LabTypeData {
  type: LabType;
  assets: LabAssetSummary[];
}

/** Null (a 404) for an unknown type or a type with no published assets. */
export const loadLabType = cache(async (type: string): Promise<LabTypeData | null> => {
  if (!isLabType(type)) return null;
  const source = await getContentSource();
  const all = await source.listSummaries("labAsset");
  const assets = all.filter((asset) => asset.labType === type);
  return assets.length > 0 ? { type, assets } : null;
});

export interface LabAssetData {
  type: LabType;
  asset: LabAssetView;
  gates: PublicationGates;
}

/**
 * Null (a 404) for an unknown type, a missing asset, or an asset without stated limitations:
 * every lab asset states its limitations, so one without them is not public.
 */
export const loadLabAsset = cache(
  async (type: string, slug: string): Promise<LabAssetData | null> => {
    if (!isLabType(type)) return null;
    const source = await getContentSource();
    const [asset, gates] = await Promise.all([
      source.getDocument("labAsset", slug, { labType: type }),
      source.getPublicationGates(),
    ]);
    if (!asset || asset.labType !== type) return null;
    if (asset.limitations.trim() === "") return null;
    return { type, asset, gates };
  },
);

export async function listLabTypeParams(): Promise<{ type: string }[]> {
  const source = await getContentSource();
  const types = new Set(
    (await source.listParams("labAsset")).flatMap((p) => (p.type ? [p.type] : [])),
  );
  return [...types].map((type) => ({ type }));
}

export async function listLabAssetParams(): Promise<{ type: string; slug: string }[]> {
  const source = await getContentSource();
  return (await source.listParams("labAsset")).flatMap((p) =>
    p.type && p.slug ? [{ type: p.type, slug: p.slug }] : [],
  );
}
