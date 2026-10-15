import { PreviewBar } from "../../src/components/preview-bar";
import { SiteShell } from "../../src/components/site-chrome/SiteShell";

/**
 * Site shell (header, content, footer) for every page in the `(site)` group, plus the preview bar
 * in Draft Mode only (brief 3.6; it renders nothing otherwise and keeps pages static).
 */
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteShell>{children}</SiteShell>
      <PreviewBar />
    </>
  );
}
