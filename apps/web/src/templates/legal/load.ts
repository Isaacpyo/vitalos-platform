import "server-only";
import { cache } from "react";
import type { LegalPageView } from "@vitalos/cms";
import { getContentSource, getPublishedContentSource } from "../../lib/cms/get-content-source";
import { isLegalSlug } from "./map";

/** Null (a 404) for an unknown slug or an unpublished page. */
export const loadLegalPage = cache(async (slug: string): Promise<LegalPageView | null> => {
  if (!isLegalSlug(slug)) return null;
  return (await getContentSource()).getDocument("legalPage", slug);
});

export async function listLegalParams(): Promise<{ slug: string }[]> {
  const source = await getPublishedContentSource();
  return (await source.listParams("legalPage")).flatMap((params) =>
    params.slug ? [{ slug: params.slug }] : [],
  );
}
