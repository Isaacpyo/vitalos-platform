import { SiteShell } from "../../src/components/site-chrome/SiteShell";

/** Site shell (header, content, footer) for every page in the `(site)` group. */
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <SiteShell>{children}</SiteShell>;
}
