import "server-only";
import type { Metadata } from "next";
import { isDetailIndexable } from "@vitalos/cms";
import type { GateKey, SeoView } from "@vitalos/cms";
import { breadcrumbJsonLd } from "../../features/seo/json-ld";
import type { JsonLdNode } from "../../features/seo/json-ld";
import { getSeoContext } from "../../features/seo/context";
import { buildMetadata } from "../../features/seo/metadata";
import { loadChromeContent } from "../../components/site-chrome/load";
import { crumbsToJsonLd } from "../../lib/view-mapping/breadcrumbs";
import type { Crumb } from "../../lib/view-mapping/breadcrumbs";

export interface PageSeoInput {
  /** Canonical path from routes.ts. */
  path: string;
  /** Document title; used when the document's SEO has none. */
  title?: string | undefined;
  /** Document summary; used when the document's SEO has no description. */
  description?: string | undefined;
  seo?: SeoView | undefined;
  /** Gate of the section a detail page belongs to: the page is noindex while it is closed. */
  gate?: GateKey | undefined;
}

/** `generateMetadata` result for a commercial page: document SEO, then fields, then site defaults. */
export async function pageMetadata(input: PageSeoInput): Promise<Metadata> {
  const { settings, gates } = await loadChromeContent();
  return buildMetadata({
    path: input.path,
    title: input.title,
    description: input.description,
    seo: input.seo,
    defaultSeo: settings.defaultSeo,
    ...(input.gate && !isDetailIndexable(input.gate, gates) ? { noindex: true } : {}),
  });
}

/** BreadcrumbList for a trail (null for fewer than two steps). */
export function breadcrumbNode(crumbs: readonly Crumb[]): JsonLdNode | null {
  return breadcrumbJsonLd(crumbsToJsonLd(crumbs), { siteUrl: getSeoContext().siteUrl });
}
