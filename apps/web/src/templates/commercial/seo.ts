import "server-only";
import type { Metadata } from "next";
import { isDetailIndexable } from "@vitalos/cms";
import type { GateKey, SeoView } from "@vitalos/cms";
import { breadcrumbJsonLd } from "../../features/seo/json-ld";
import { jsonLdGraph, serviceNode, softwareNode, webPageNode } from "../../features/seo/graph";
import type { FaqItem, SoftwareInput, WebPageType } from "../../features/seo/graph";
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

export interface PageGraphInput {
  /** The page's trail; the last step is the page itself. */
  trail: readonly Crumb[];
  /** The visible h1. */
  name: string;
  /** The visible lead or summary. */
  description?: string | undefined;
  type?: WebPageType | undefined;
  /** Practice, solution and offer pages: the Service they describe (docs/seo/DECISIONS.md 22). */
  serviceType?: string | undefined;
  /** Questions and answers shown on the page. */
  faq?: readonly FaqItem[] | undefined;
  dateModified?: string | undefined;
  /** Product pages: the SoftwareApplication they describe. */
  software?: Omit<SoftwareInput, "path"> | undefined;
}

/** One JSON-LD graph for a commercial page: WebPage, BreadcrumbList and, for services, Service. */
export function pageGraph(input: PageGraphInput): JsonLdNode {
  const ctx = { siteUrl: getSeoContext().siteUrl };
  const path = input.trail.at(-1)?.path ?? "/";
  return jsonLdGraph([
    webPageNode(
      {
        path,
        name: input.name,
        description: input.description,
        type: input.type,
        breadcrumb: input.trail.length >= 2,
        aboutService: input.serviceType !== undefined,
        aboutSoftware: input.software !== undefined,
        faq: input.faq,
        dateModified: input.dateModified,
      },
      ctx,
    ),
    breadcrumbJsonLd(crumbsToJsonLd(input.trail), ctx),
    input.serviceType !== undefined
      ? serviceNode(
          {
            path,
            name: input.name,
            description: input.description,
            serviceType: input.serviceType,
          },
          ctx,
        )
      : null,
    input.software !== undefined
      ? softwareNode({ ...input.software, path, description: input.description }, ctx)
      : null,
  ]);
}
