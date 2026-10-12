import { brandName, routes } from "@vitalos/cms";
import { JsonLd } from "../../components/json-ld";
import { breadcrumbJsonLd } from "../../features/seo/json-ld";
import { getSeoContext } from "../../features/seo/context";

export interface Crumb {
  name: string;
  /** Site path from routes.ts. */
  path: string;
}

/** Home crumb: the brand name (locked copy), never an invented label. */
export const homeCrumb: Crumb = { name: brandName, path: routes.home() };

/**
 * BreadcrumbList JSON-LD only. The visible breadcrumb trail was removed (owner decision
 * 2026-10-12); the structured data stays for search. The last crumb is the current page. Crumbs
 * without a name are dropped; a trail shorter than two renders nothing.
 */
export function Breadcrumbs({
  trail,
  jsonLd = true,
}: Readonly<{
  trail: readonly Crumb[];
  /** False on placeholder pages (ADR-025): no structured data. */ jsonLd?: boolean;
}>) {
  const crumbs = trail.filter((crumb) => crumb.name.trim() !== "");
  if (crumbs.length < 2) return null;
  if (!jsonLd) return null;
  return <JsonLd data={breadcrumbJsonLd(crumbs, { siteUrl: getSeoContext().siteUrl })} />;
}
