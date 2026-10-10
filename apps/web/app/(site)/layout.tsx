import { SiteFooter } from "@vitalos/ui";
import { ActiveSectionHeader } from "../../src/components/active-section";
import { loadSiteChrome } from "../../src/components/site-chrome/load";

/**
 * Site shell: header, page content, footer. Navigation is driven by the publication gates (a
 * gated section appears only once its gate is open) and the mega-menu and footer columns by the
 * content source. Pages render their own `<main id="main">` (see PageMain), so the shell never
 * wraps content in a second landmark.
 */
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { header, footer } = await loadSiteChrome();
  return (
    <>
      <ActiveSectionHeader {...header} />
      {children}
      <SiteFooter {...footer} />
    </>
  );
}
