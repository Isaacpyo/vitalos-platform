import { brandName, routes } from "@vitalos/cms";
import { Breadcrumb } from "@vitalos/ui";
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
 * Visible breadcrumb trail plus BreadcrumbList JSON-LD from the same data. The last crumb is the
 * current page. Crumbs without a name are dropped; a trail shorter than two renders nothing.
 */
export function Breadcrumbs({ trail }: Readonly<{ trail: readonly Crumb[] }>) {
  const crumbs = trail.filter((crumb) => crumb.name.trim() !== "");
  if (crumbs.length < 2) return null;
  const items = crumbs.map((crumb, index) => ({
    label: crumb.name,
    ...(index < crumbs.length - 1 ? { href: crumb.path } : {}),
  }));
  return (
    <>
      <Breadcrumb items={items} />
      <JsonLd data={breadcrumbJsonLd(crumbs, { siteUrl: getSeoContext().siteUrl })} />
    </>
  );
}
