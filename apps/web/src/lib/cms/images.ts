import { isSafeRelativeRedirect } from "@vitalos/security/url";

/**
 * Image URL policy. The CSP only allows `img-src 'self' data: https://cdn.sanity.io`
 * (ADR-020), so only Sanity CDN images and same-origin paths are ever rendered; any other URL
 * is refused rather than rendered and blocked at runtime.
 */
export const SANITY_IMAGE_HOST = "cdn.sanity.io";

export type ImageOrigin = "sanity" | "local";

export interface ImageScope {
  /** When set, Sanity images must live under `/images/<projectId>/` (this project only). */
  projectId?: string | undefined;
  /** When set (with a project id), under `/images/<projectId>/<dataset>/`. */
  dataset?: string | undefined;
}

export function classifyImageUrl(url: string, scope: ImageScope = {}): ImageOrigin | null {
  if (url.startsWith("/")) return isSafeRelativeRedirect(url) ? "local" : null;
  if (!URL.canParse(url)) return null;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== SANITY_IMAGE_HOST) return null;
  if (parsed.username || parsed.password || parsed.port) return null;
  if (scope.projectId) {
    const prefix = scope.dataset
      ? `/images/${scope.projectId}/${scope.dataset}/`
      : `/images/${scope.projectId}/`;
    if (!parsed.pathname.startsWith(prefix)) return null;
  }
  return "sanity";
}

/** Sanity image CDN transform: responsive width, quality, automatic modern format. */
export function sanityImageUrl(url: string, width: number, quality = 75): string {
  const parsed = new URL(url);
  parsed.searchParams.set("w", String(Math.max(1, Math.round(width))));
  parsed.searchParams.set("q", String(Math.min(100, Math.max(1, Math.round(quality)))));
  parsed.searchParams.set("auto", "format");
  parsed.searchParams.set("fit", "max");
  parsed.searchParams.delete("h");
  return parsed.toString();
}
