/**
 * URL rule 1 (docs/seo/URL-RULES.md): page URLs are lowercase. A request with capital letters in
 * its path gets a 308 to the lowercase path, query kept, so a mistyped backlink never splits
 * signals or lands on a 404. Framework assets and API routes are left alone.
 */
export function lowercasePath(pathname: string): string | null {
  if (!/[A-Z]/.test(pathname)) return null;
  if (pathname.startsWith("/_next/") || pathname.startsWith("/api/")) return null;
  return pathname.toLowerCase();
}
