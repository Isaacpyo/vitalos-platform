import type { Metadata, Viewport } from "next";
import { colors } from "@vitalos/design-tokens";
import { geistMono } from "../src/config/fonts";
import { GeistSans } from "geist/font/sans";
import { descriptor, brandName } from "@vitalos/cms";
import { readBuildEnv } from "@vitalos/config/build";
import { readPublicEnv } from "@vitalos/config/public";
import { RelayLauncher } from "@vitalos/relay-widget";
import { seoSite } from "../src/features/seo/site";
import { siteFeed } from "../src/features/seo/metadata";
import { SiteAnalytics } from "../src/components/analytics/site-analytics";
import "./globals.css";

const { siteVerification } = readBuildEnv();

export const metadata: Metadata = {
  // Resolves canonical, Open Graph and Twitter URLs. The site URL is injected by next.config.ts.
  metadataBase: new URL(readPublicEnv().siteUrl),
  // Search Console and Bing Webmaster Tools HTML-tag verification, when the tokens are set
  // (GOOGLE_SITE_VERIFICATION, BING_SITE_VERIFICATION; docs/seo/LAUNCH.md).
  verification: {
    ...(siteVerification.google ? { google: siteVerification.google } : {}),
    ...(siteVerification.bing ? { other: { "msvalidate.01": siteVerification.bing } } : {}),
  },
  title: { default: brandName, template: seoSite.titleTemplate },
  description: descriptor,
  // RSS autodiscovery on every page (C9). Pages that set their own `alternates` repeat it through
  // `composeMetadata`, because a page's `alternates` replaces the layout's.
  alternates: { types: siteFeed },
  // Defaults for pages outside the (site) group, such as the root 404. Every site page has its own
  // generated image (opengraph-image.tsx), which takes precedence (docs/seo/DECISIONS.md 21).
  openGraph: {
    type: "website",
    siteName: brandName,
    locale: seoSite.ogLocale,
    images: [{ ...seoSite.defaultOgImage, alt: brandName }],
  },
  twitter: { card: "summary_large_image" },
};

/** Browser UI colour (C8): the midnight ground of the header and heroes. */
export const viewport: Viewport = { themeColor: colors.midnight950 };

/*
 * Fonts: Geist Sans and Geist Mono from the installed `geist` package (self-hosted by next/font,
 * no request to Google). Geist Mono is loaded through `src/config/fonts.ts` without a preload, so
 * it does not compete with the hero image (docs/seo/DECISIONS.md 15). Provisional pending owner confirmation of the typography
 * (Stage 7 §15.1). The `.variable` classes on <html> expose --font-geist-sans and
 * --font-geist-mono; the design-token font stack (--font-sans, --font-mono) reads them first and
 * then falls back to system fonts. Source Serif 4 is not loaded yet (see token-reconciliation).
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Vitalos Relay (ADR-035): rendered only when RELAY_ENABLED is on for this deployment.
  const relay = readBuildEnv().relayEnabled;
  const turnstileSiteKey = readPublicEnv().turnstileSiteKey;
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        {children}
        <SiteAnalytics />
        {relay && (
          <RelayLauncher
            symbolSrc="/brand/vitalos-symbol.png"
            privacyUrl="/legal/privacy"
            turnstileSiteKey={turnstileSiteKey}
          />
        )}
      </body>
    </html>
  );
}
