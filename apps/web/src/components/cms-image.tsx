import Image from "next/image";
import type { ImageView } from "@vitalos/cms";
import { isSameOriginImage } from "../lib/cms/images";

export interface CmsImageProps {
  /** View-model image (approved rights only). */
  image: ImageView | null | undefined;
  /** Responsive sizes hint; defaults to full width on small screens, half on large. */
  sizes?: string;
  /** Above-the-fold images only. */
  priority?: boolean;
  className?: string;
}

/**
 * Renders a content image, or nothing. Nothing is rendered when there is no image, when the image
 * carries a rights status other than approved, when meaningful content has no alt text, or when
 * the URL is not a same-origin path (the CSP would block it). Decorative images get an empty alt.
 */
export function CmsImage({ image, sizes, priority, className }: Readonly<CmsImageProps>) {
  if (!image) return null;
  const rights = (image as { rightsStatus?: unknown }).rightsStatus;
  if (rights !== undefined && rights !== "approved") return null;
  if (!image.decorative && image.alt.trim() === "") return null;
  if (!(image.width > 0) || !(image.height > 0)) return null;
  if (!isSameOriginImage(image.url)) return null;

  return (
    <Image
      src={image.url}
      alt={image.decorative ? "" : image.alt}
      width={image.width}
      height={image.height}
      sizes={sizes ?? "(min-width: 1024px) 50vw, 100vw"}
      unoptimized
      {...(priority ? { priority: true } : {})}
      {...(className ? { className } : {})}
    />
  );
}
