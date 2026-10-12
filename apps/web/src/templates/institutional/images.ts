import type { ImageView } from "@vitalos/cms";
import type { PatternImage } from "@vitalos/ui";
import { isSameOriginImage } from "../../lib/cms/images";

/**
 * The image as a pattern image, or undefined when it must not be shown: no alt text on a
 * meaningful image, no intrinsic size, or a URL the CSP would block (only same-origin paths are renderable). Layouts work without the image.
 */
export function toPatternImage(image: ImageView | undefined): PatternImage | undefined {
  if (!image) return undefined;
  if (!image.decorative && image.alt.trim() === "") return undefined;
  if (!(image.width > 0) || !(image.height > 0)) return undefined;
  if (!isSameOriginImage(image.url)) return undefined;
  return {
    url: image.url,
    alt: image.alt,
    width: image.width,
    height: image.height,
    ...(image.decorative ? { decorative: true } : {}),
    ...(image.credit ? { credit: image.credit } : {}),
  };
}
