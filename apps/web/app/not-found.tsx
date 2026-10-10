import { NotFoundContent } from "../src/components/site-chrome/NotFoundContent";
import { SiteShell } from "../src/components/site-chrome/SiteShell";

/**
 * 404 for URLs that match no route, and the app-wide fallback. Next.js renders the root
 * `not-found` inside the root layout only, never inside the `(site)` layout, so this file wraps
 * the same content in the same shell (header and footer). A `notFound()` raised inside the site is
 * answered by `(site)/not-found.tsx`, which gets the shell from the `(site)` layout instead.
 * Next.js sends the 404 status and `noindex`.
 */
export default function RootNotFound() {
  return (
    <SiteShell>
      <NotFoundContent />
    </SiteShell>
  );
}
