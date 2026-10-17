import { brandName, routes } from "@vitalos/cms";
import { JsonLd } from "../../components/json-ld";
import { breadcrumbJsonLd } from "../../features/seo/json-ld";
import { jsonLdGraph, webPageNode } from "../../features/seo/graph";
import type { FaqItem, ListedItem, WebPageType } from "../../features/seo/graph";
import type { JsonLdNode } from "../../features/seo/json-ld";
import { getSeoContext } from "../../features/seo/context";

export interface Crumb {
  name: string;
  /** Site path from routes.ts. */
  path: string;
}

/** Home crumb: the brand name (locked copy), never an invented label. */
export const homeCrumb: Crumb = { name: brandName, path: routes.home() };

/**
 * The page's JSON-LD graph: its WebPage and BreadcrumbList, linked by `@id` (docs/seo/DECISIONS.md
 * 22). The last crumb is the current page and gives the WebPage its URL and name (the h1).
 * `PageHeroBand` reads `trail` from this element to show the visible trail below the top level.
 * Crumbs without a name are dropped; a trail shorter than two renders nothing.
 */
export function Breadcrumbs({
  trail,
  page,
  jsonLd = true,
}: Readonly<{
  trail: readonly Crumb[];
  /** The WebPage's type, its h1 (when it differs from the crumb) and its visible lead. */
  page?:
    | {
        type?: WebPageType | undefined;
        name?: string | undefined;
        description?: string | undefined;
        /** Questions and answers the page shows (FAQPage). */
        faq?: readonly FaqItem[] | undefined;
        /** Index pages: the items listed, in page order (ItemList). */
        items?: readonly ListedItem[] | undefined;
        /** What the page is about, for example the Person on a profile page. */
        mainEntity?: JsonLdNode | undefined;
      }
    | undefined;
  /** False on placeholder pages (ADR-025): no structured data. */ jsonLd?: boolean;
}>) {
  const crumbs = trail.filter((crumb) => crumb.name.trim() !== "");
  if (crumbs.length < 2) return null;
  if (!jsonLd) return null;
  const ctx = { siteUrl: getSeoContext().siteUrl };
  const current = crumbs.at(-1)!;
  return (
    <JsonLd
      data={jsonLdGraph([
        webPageNode(
          {
            path: current.path,
            name: page?.name ?? current.name,
            description: page?.description,
            type: page?.type,
            breadcrumb: true,
            faq: page?.faq,
            items: page?.items,
            mainEntity: page?.mainEntity,
          },
          ctx,
        ),
        breadcrumbJsonLd(crumbs, ctx),
      ])}
    />
  );
}
