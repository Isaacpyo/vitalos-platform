"use client";

import Image from "next/image";
import type { ImageLoaderProps } from "next/image";
import type { ImageView } from "@vitalos/cms";
import { classifyImageUrl, sanityImageUrl } from "../lib/cms/images";

/** next/image loader for the Sanity CDN: width and quality become CDN transform parameters. */
export function sanityLoader({ src, width, quality }: ImageLoaderProps): string {
  return sanityImageUrl(src, width, quality);
}

/** This project's images only, when a Sanity project is configured (public variables, inlined). */
function imageScope() {
  return {
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || undefined,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || undefined,
  };
}

export interface CmsImageProps {
  /** View-model image (approved rights only: mappers drop everything else). */
  image: ImageView | null | undefined;
  /** Responsive sizes hint; defaults to full width on small screens, half on large. */
  sizes?: string;
  /** Above-the-fold images only. */
  priority?: boolean;
  className?: string;
}

/**
 * Renders a CMS image, or nothing. Nothing is rendered when there is no image, when the image
 * carries a rights status other than approved, when meaningful content has no alt text, or when
 * the URL is not a Sanity CDN or same-origin URL (the CSP would block it). Decorative images
 * get an empty alt.
 */
export function CmsImage({ image, sizes, priority, className }: Readonly<CmsImageProps>) {
  if (!image) return null;
  const rights = (image as { rightsStatus?: unknown }).rightsStatus;
  if (rights !== undefined && rights !== "approved") return null;
  if (!image.decorative && image.alt.trim() === "") return null;
  if (!(image.width > 0) || !(image.height > 0)) return null;
  const origin = classifyImageUrl(image.url, imageScope());
  if (origin === null) return null;

  return (
    <Image
      src={image.url}
      alt={image.decorative ? "" : image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes ?? "(min-width: 1024px) 50vw, 100vw"}
      {...(origin === "sanity" ? { loader: sanityLoader } : { unoptimized: true })}
      {...(priority ? { priority: true } : {})}
      {...(className ? { className } : {})}
    />
  );
}
