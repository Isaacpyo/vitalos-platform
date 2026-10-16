import type { PageHeroBackdrop } from "@vitalos/ui";

/**
 * The hero photograph (owner-supplied, 15 Oct 2026; docs/brand/asset-approval.md): the homepage
 * hero under a 72% black overlay, and every other page's dark hero under a heavier one, static.
 * Served from apps/web/public as pre-sized WebP, so it skips the image optimiser.
 *
 * It is the LCP element of every page (docs/seo/AUDIT.md). Below lg, `sizes` asks for half the
 * viewport width, so phones load the 640 or 960 file rather than the 1672 one: under a black
 * overlay of 72% or more the difference cannot be seen, and it is the largest early download.
 * The 640 and 960 files are re-encoded from the 1672 master (docs/seo/DECISIONS.md).
 */
export const heroPhotograph = {
  src: "/images/hero/cloud-infrastructure-1672.webp",
  srcSet:
    "/images/hero/cloud-infrastructure-640.webp 640w, /images/hero/cloud-infrastructure-960.webp 960w, /images/hero/cloud-infrastructure-1672.webp 1672w",
  sizes: "(max-width: 63.99rem) 50vw, 100vw",
  width: 1672,
  height: 941,
} as const satisfies PageHeroBackdrop;
