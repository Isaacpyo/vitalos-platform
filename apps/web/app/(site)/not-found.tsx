import { NotFoundContent } from "../../src/components/site-chrome/NotFoundContent";

/**
 * 404 for every `notFound()` inside the site (missing documents, closed publication gates). It
 * lives in the `(site)` group, so it renders inside the site layout with the header and footer.
 * Next.js sends the 404 status and `noindex`. Unmatched URLs are handled by `app/not-found.tsx`.
 */
export default function NotFound() {
  return <NotFoundContent />;
}
