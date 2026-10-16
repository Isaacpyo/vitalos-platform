import localFont from "next/font/local";

/*
 * Geist Mono, the same file and settings as `geist/font/mono`, but not preloaded. It only sets
 * the short mono eyebrows and labels, and preloading its 71 KB competed with the hero image, the
 * LCP element on every page (docs/seo/AUDIT.md). `display: swap` with the system monospace stack
 * first; Geist Sans stays preloaded through the `geist` package.
 */
export const geistMono = localFont({
  src: "../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  adjustFontFallback: false,
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Roboto Mono",
    "Menlo",
    "Monaco",
    "Liberation Mono",
    "DejaVu Sans Mono",
    "Courier New",
    "monospace",
  ],
  weight: "100 900",
  display: "swap",
  preload: false,
});
