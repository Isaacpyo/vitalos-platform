import { Breadcrumb } from "@vitalos/ui";

/**
 * Visible breadcrumbs below the top level (docs/seo/DECISIONS.md 13). The owner removed the
 * visible trail on 12 Oct 2026 and kept only the BreadcrumbList JSON-LD; the SEO brief (16 Oct
 * 2026) asks for visible breadcrumbs below the top level, so structured data matches what the
 * page shows. Shown only for trails of three or more steps (Home › Section › Page): a top-level
 * page's "Home › About" adds nothing. Turn the whole trail off with this one switch.
 */
export const showVisibleBreadcrumbs = true;

export interface TrailStep {
  /** The step's name; the same text as the BreadcrumbList item. */
  name: string;
  path: string;
}

export function VisibleBreadcrumb({ trail }: Readonly<{ trail: readonly TrailStep[] }>) {
  const steps = trail.filter((step) => step.name.trim() !== "");
  if (!showVisibleBreadcrumbs || steps.length < 3) return null;
  return (
    <Breadcrumb
      items={steps.map((step, index) =>
        index === steps.length - 1 ? { label: step.name } : { label: step.name, href: step.path },
      )}
    />
  );
}
