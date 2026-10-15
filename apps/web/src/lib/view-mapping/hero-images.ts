import type { PageHeroBackdrop } from "@vitalos/ui";

/**
 * The hero photograph (owner-supplied, 15 Oct 2026; docs/brand/asset-approval.md): the homepage
 * hero under a 72% black overlay, and every other page's dark hero under a heavier one, static.
 * Served from apps/web/public as pre-sized WebP, so it skips the image optimiser.
 */
export const heroPhotograph = {
  src: "/images/hero/cloud-infrastructure-1672.webp",
  srcSet:
    "/images/hero/cloud-infrastructure-960.webp 960w, /images/hero/cloud-infrastructure-1672.webp 1672w",
  width: 1672,
  height: 941,
} as const satisfies PageHeroBackdrop;
