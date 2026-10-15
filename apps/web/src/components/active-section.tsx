"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@vitalos/ui";
import type { SiteHeaderProps } from "@vitalos/ui";
import { activeSectionForPath } from "./site-chrome/section-for-path";

/**
 * The site header with the current section marked.
 *
 * A layout cannot read the URL, so this is the one small client boundary of the shell: it reads
 * the pathname and passes `activeSection` to the header pattern (`aria-current`, weight and
 * underline, never colour alone). The header is still rendered into the HTML on the server;
 * only the pathname lookup and the MegaMenu island run in the browser. The bar is clear over every
 * page's dark hero until the page scrolls (`overlay`; each hero starts under the bar; pages
 * redesign, 15 Oct 2026).
 */
export function ActiveSectionHeader(
  props: Readonly<Omit<SiteHeaderProps, "activeSection" | "overlay">>,
) {
  const pathname = usePathname();
  const activeSection = activeSectionForPath(pathname);
  return <SiteHeader {...props} {...(activeSection ? { activeSection } : {})} overlay />;
}
