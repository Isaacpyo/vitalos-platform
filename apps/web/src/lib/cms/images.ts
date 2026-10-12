import { isSafeRelativeRedirect } from "@vitalos/security/url";

/**
 * Image URL policy. The CSP only allows `img-src 'self' data:` (ADR-020), so only same-origin
 * paths are ever rendered; any other URL is refused rather than rendered and blocked at runtime.
 * Site images live in `apps/web/public` (ADR-028).
 */
export function isSameOriginImage(url: string): boolean {
  return url.startsWith("/") && isSafeRelativeRedirect(url);
}
