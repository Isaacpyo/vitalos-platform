import type { MetadataRoute } from "next";
import { brandName, descriptor } from "@vitalos/cms";
import { colors } from "@vitalos/design-tokens";

/**
 * `/manifest.webmanifest` (finding C8): the name, the brand colours (midnight, the header and hero
 * ground) and the two app icons that already exist in `app/`. Static at build.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brandName,
    short_name: brandName,
    description: descriptor,
    start_url: "/",
    scope: "/",
    display: "browser",
    lang: "en-GB",
    background_color: colors.midnight950,
    theme_color: colors.midnight950,
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
