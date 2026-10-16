import type { Metadata } from "next";
import { geistMono } from "../src/config/fonts";
import { GeistSans } from "geist/font/sans";
import { descriptor, brandName } from "@vitalos/cms";
import { readBuildEnv } from "@vitalos/config/build";
import { readPublicEnv } from "@vitalos/config/public";
import { RelayLauncher } from "@vitalos/relay-widget";
import { relayFontClassName } from "../src/features/relay/fonts";
import "./globals.css";

export const metadata: Metadata = {
  // Resolves canonical, Open Graph and Twitter URLs. The site URL is injected by next.config.ts.
  metadataBase: new URL(readPublicEnv().siteUrl),
  title: { default: brandName, template: `%s | ${brandName}` },
  description: descriptor,
};

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
        {relay && (
          <RelayLauncher
            symbolSrc="/brand/vitalos-symbol.png"
            privacyUrl="/legal/privacy"
            turnstileSiteKey={turnstileSiteKey}
            fontClassName={relayFontClassName}
          />
        )}
      </body>
    </html>
  );
}
