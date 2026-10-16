import "server-only";
import { getEnv } from "@vitalos/config";

/** Hosts whose links the renderer treats as internal: the production site and this deployment. */
export function siteHosts(): string[] {
  return [...new Set(["vitalos.co.uk", "www.vitalos.co.uk", new URL(getEnv().siteUrl).hostname])];
}

/** The media origin images may come from (`CONTENT_MEDIA_HOST`), or undefined. */
export const mediaOrigin = (): string | undefined => getEnv().content.mediaOrigin;
