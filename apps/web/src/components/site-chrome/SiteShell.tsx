import { getEnv } from "@vitalos/config";
import { SiteFooter } from "@vitalos/ui";
import { ActiveSectionHeader } from "../active-section";
import { DraftContentRibbon } from "../draft-content-ribbon";
import { loadSiteChrome } from "./load";

/**
 * Site shell: header, page content, footer. Navigation is driven by the publication gates (a
 * gated section appears only once its gate is open) and the mega-menu and footer columns by the
 * content source. Pages render their own `<main id="main">` (see PageMain), so the shell never
 * wraps content in a second landmark. Section entrances need no controller here: each Reveal
 * island manages itself (ADR-024).
 *
 * Used by the `(site)` layout and by the root `not-found.tsx` (the 404 for unmatched URLs, which
 * Next.js renders outside the `(site)` layout).
 */
export async function SiteShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const { header, footer } = await loadSiteChrome();
  return (
    <>
      {/* "Draft content, pending approval" while VITALOS_CONTENT_SOURCE=draft (ADR-025); else nothing. */}
      <DraftContentRibbon kind={getEnv().contentSource} />
      <ActiveSectionHeader {...header} />
      {children}
      <SiteFooter {...footer} />
    </>
  );
}
