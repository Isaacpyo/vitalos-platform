import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { GateKey, PublicationGates, RoutePageKey, RoutePageView, ViewFor } from "@vitalos/cms";
import { requireGateOpen } from "../../features/publication-gates/gates";
import { isDraftModeEnabled } from "../../lib/cms/draft";
import { getContentSource, getPublishedContentSource } from "../../lib/cms/get-content-source";
import { loadChromeContent } from "../../components/site-chrome/load";

/** The commercial detail kinds served by these templates. */
export type CommercialKind = "practice" | "solution" | "offer" | "industry";

/** Commercial kinds are addressed by plain slugs, which the generic `getDocument` cannot express. */
interface PlainSlugReader {
  getDocument(kind: CommercialKind, slug: string): Promise<unknown>;
}

const readDocument = cache(async (kind: CommercialKind, slug: string): Promise<unknown> => {
  const source = (await getContentSource()) as unknown as PlainSlugReader;
  return source.getDocument(kind, slug);
});

/** One detail document (draft-aware), read once per request even when metadata also reads it. */
export async function loadDocument<K extends CommercialKind>(
  kind: K,
  slug: string,
): Promise<ViewFor<K> | null> {
  return (await readDocument(kind, slug)) as ViewFor<K> | null;
}

export interface DetailData<K extends CommercialKind> {
  doc: ViewFor<K>;
  gates: PublicationGates;
  draft: boolean;
}

/** Document, gates and draft flag for a detail page. A missing document is a 404. */
export async function loadDetailPage<K extends CommercialKind>(
  kind: K,
  slug: string,
): Promise<DetailData<K>> {
  const [doc, { gates }, draft] = await Promise.all([
    loadDocument(kind, slug),
    loadChromeContent(),
    isDraftModeEnabled(),
  ]);
  if (!doc) notFound();
  return { doc, gates, draft };
}

/** Static params from the PUBLISHED source (never drafts), mapped onto the route's param name. */
export async function staticParams(
  kind: CommercialKind,
  paramName: string,
): Promise<Record<string, string>[]> {
  const source = await getPublishedContentSource();
  const params = await source.listParams(kind);
  return params.flatMap((entry) => {
    const slug = entry["slug"];
    return slug ? [{ [paramName]: slug }] : [];
  });
}

/** The route page (index copy) for a key, read once per request. */
export const loadRoutePage = cache(async (key: RoutePageKey): Promise<RoutePageView | null> => {
  const source = await getContentSource();
  return source.getRoutePage(key);
});

/**
 * Gate check for an index page: 404 while the section's gate is closed (editors in Draft Mode
 * may preview it). Ungated sections pass through.
 */
export async function requireIndexGate(gate: GateKey | undefined): Promise<PublicationGates> {
  return gate ? requireGateOpen(gate) : (await loadChromeContent()).gates;
}
