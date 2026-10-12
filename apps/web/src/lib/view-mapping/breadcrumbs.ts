import { routes } from "@vitalos/cms";
import { structuralLabels } from "./labels";

/** One step of a trail. Every step, including the current page, has a site path from routes.ts. */
export interface Crumb {
  label: string;
  path: string;
}

/** Home, then the given steps. The last step is the current page. */
export function trail(...steps: readonly Crumb[]): Crumb[] {
  return [{ label: structuralLabels.home, path: routes.home() }, ...steps];
}

/** Items for `breadcrumbJsonLd` (name + path). */
export function crumbsToJsonLd(crumbs: readonly Crumb[]): { name: string; path: string }[] {
  return crumbs.map((crumb) => ({ name: crumb.label, path: crumb.path }));
}
